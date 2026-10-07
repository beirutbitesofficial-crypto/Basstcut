/**
 * Public booking API used by /booking.
 *   GET  ?action=config                       → services + bookable days
 *   GET  ?action=slots&date=Y-m-d&service=ID  → free start times
 *   POST ?action=book   {service, date, time, name, phone, note}
 *   GET  ?action=status&code=BC-XXXXX&token=… → current status (the client page polls this)
 */
import { db, dbConfigured, rows, withBookingLock } from "@/lib/server/db";
import {
  addMin, at, availableSlots, bookableDays, fmt, getSettings, insertBooking, normalizePhone, nowWall, publicBooking,
  randomCode, randomToken, type BookingRow,
} from "@/lib/server/booking";
import { body, clientIp, Conflict, fail, json, str } from "@/lib/server/http";
import { fillMessage, notifyBarberNew, sendWhatsApp, siteUrl } from "@/lib/server/whatsapp";
import { validDate } from "@/lib/server/time";

export const dynamic = "force-dynamic";

type ServiceRow = { id: number; name: string; duration_min: number; price: string | null };

async function serviceById(id: number) {
  const [sv] = await rows<ServiceRow>(await db(), "SELECT * FROM bc_services WHERE id = ? AND active = 1", [id]);
  if (!sv) throw new Conflict("Please choose a service.");
  return sv;
}

export async function GET(req: Request) {
  if (!dbConfigured()) return fail("Online booking is being set up.", 503);
  const q = new URL(req.url).searchParams;
  try {
    const pool = await db();
    const s = await getSettings(pool);
    switch (q.get("action")) {
      case "config": {
        const services = await rows<ServiceRow>(pool, "SELECT id, name, duration_min, price FROM bc_services WHERE active = 1 ORDER BY sort, id");
        return json({
          ok: true,
          services: services.map((x) => ({ id: Number(x.id), name: x.name, duration: Number(x.duration_min), price: x.price })),
          days: bookableDays(s),
          leadMinutes: Number(s.lead_minutes),
        });
      }
      case "slots": {
        const sv = await serviceById(Number(q.get("service")));
        const date = q.get("date") || "";
        return json({ ok: true, date, slots: await availableSlots(pool, s, date, Number(sv.duration_min)) });
      }
      case "status": {
        const [b] = await rows<BookingRow>(pool, "SELECT * FROM bc_bookings WHERE code = ? AND token = ?", [q.get("code") || "", q.get("token") || ""]);
        if (!b) return fail("Booking not found", 404);
        return json({ ok: true, booking: publicBooking(b) });
      }
    }
    return fail("Unknown action", 404);
  } catch (e) {
    if (e instanceof Conflict) return fail(e.message, 409);
    console.error("[booking]", e);
    return fail("Something went wrong. Please try again or message us on WhatsApp.", 500);
  }
}

export async function POST(req: Request) {
  if (!dbConfigured()) return fail("Online booking is being set up.", 503);
  if (new URL(req.url).searchParams.get("action") !== "book") return fail("Unknown action", 404);
  try {
    const pool = await db();
    const s = await getSettings(pool);
    const inp = await body(req);
    if (inp.website) return fail("Invalid request"); // honeypot

    const name = str(inp.name, 80).replace(/\s+/g, " ");
    const phone = normalizePhone(String(inp.phone ?? ""));
    const note = str(inp.note, 300);
    const date = str(inp.date, 10);
    const time = str(inp.time, 5);
    const sv = await serviceById(Number(inp.service));

    if (name.length < 2) return fail("Please enter your name.");
    if (!phone) return fail("Please enter a valid WhatsApp number.");
    if (!validDate(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Please choose a date and time.");

    const lead = Number(s.lead_minutes) || 0;
    if (at(date, time) < addMin(nowWall(), lead)) {
      return fail(`Bookings must be at least ${lead} minutes from now. Please pick a later time.`, 409);
    }

    // Light abuse protection
    const [{ n: pendingForPhone }] = await rows<{ n: number }>(
      pool, "SELECT COUNT(*) AS n FROM bc_bookings WHERE phone = ? AND status = 'pending' AND start_at >= ?", [phone, fmt(nowWall())]
    );
    if (Number(pendingForPhone) >= Math.max(1, Number(s.max_pending_per_phone) || 2)) {
      return fail("You already have a request waiting for confirmation. Please wait for the barber to reply.");
    }
    const ip = clientIp(req);
    const [{ n: recent }] = await rows<{ n: number }>(
      pool, "SELECT COUNT(*) AS n FROM bc_bookings WHERE ip = ? AND created_at >= ?", [ip, fmt(addMin(nowWall(), -60))]
    );
    if (ip && Number(recent) >= 6) return fail("Too many requests. Please try again later.", 429);

    const duration = Number(sv.duration_min);
    const booking = await withBookingLock(async (c) => {
      // Re-check inside the lock: lead time, opening hours and conflicts.
      if (!(await availableSlots(c, s, date, duration)).includes(time)) {
        throw new Conflict("Sorry, that time was just taken or is no longer available. Please pick another.");
      }
      const start = at(date, time);
      const b = {
        code: randomCode(),
        token: randomToken(),
        service_id: Number(sv.id),
        service_name: sv.name,
        duration_min: duration,
        price: sv.price,
        customer_name: name,
        phone,
        note: note || null,
        start_at: fmt(start),
        end_at: fmt(addMin(start, duration)),
        status: "pending" as const,
        kind: "booking" as const,
        ip,
        created_at: fmt(nowWall()),
      };
      await insertBooking(c, b);
      return b;
    });

    // Notify after commit — a notification failure must never lose the booking.
    const base = siteUrl(req);
    const notified = await notifyBarberNew(s, booking, base);
    if (s.notify_driver === "cloud") await sendWhatsApp(s, phone, fillMessage(s.msg_received, booking, base));

    return json({
      ok: true,
      booking: publicBooking({ ...booking, id: 0, reason: null, decided_at: null }),
      token: booking.token,
      barberNotified: notified.sent,
    });
  } catch (e) {
    if (e instanceof Conflict) return fail(e.message, 409);
    console.error("[booking]", e);
    return fail("Something went wrong. Please try again or message us on WhatsApp.", 500);
  }
}
