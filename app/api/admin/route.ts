/** Barber admin API (cookie session + CSRF header). Used by /admin. */
import { db, dbConfigured, rows, withBookingLock } from "@/lib/server/db";
import {
  adminBooking, at, busyRanges, DEFAULT_SETTINGS, fmt, getSettings, insertBooking, normalizePhone, nowWall,
  randomCode, randomToken, saveSettings, type BookingRow, type Settings,
} from "@/lib/server/booking";
import { addDays, addMin, validDate } from "@/lib/server/time";
import { adminConfigured, checkPassword, createSession, currentCsrf, destroySession, isAdmin } from "@/lib/server/auth";
import { body, clientIp, Conflict, fail, json, str } from "@/lib/server/http";
import { notifyBarberNew, notifyClient, siteUrl } from "@/lib/server/whatsapp";

export const dynamic = "force-dynamic";

const SECRET_MASK = "••••••••";

async function handle(req: Request) {
  const action = new URL(req.url).searchParams.get("action") || "";
  const q = new URL(req.url).searchParams;

  // Which screen the admin should show
  if (action === "session") {
    const installed = dbConfigured() && adminConfigured();
    const csrf = installed ? await currentCsrf() : null;
    return json({ ok: true, installed, loggedIn: !!csrf, csrf });
  }
  if (!dbConfigured() || !adminConfigured()) return fail("Not set up: add the database and ADMIN_PASSWORD environment variables.", 503);

  if (action === "login" && req.method === "POST") {
    const inp = await body(req);
    if (!checkPassword(String(inp.password ?? ""))) {
      await new Promise((r) => setTimeout(r, 800));
      return fail("Wrong password", 401);
    }
    return json({ ok: true, csrf: await createSession() });
  }

  if (!(await isAdmin(req))) return fail(req.method === "POST" ? "Session expired, reload the page" : "Please log in", req.method === "POST" ? 403 : 401);

  const pool = await db();
  const s = await getSettings(pool);
  const inp = req.method === "POST" ? await body(req) : {};

  switch (action) {
    case "logout":
      await destroySession();
      return json({ ok: true });

    case "poll": {
      const [{ pending }] = await rows<{ pending: number }>(pool, "SELECT COUNT(*) AS pending FROM bc_bookings WHERE status = 'pending' AND kind = 'booking'");
      const [{ latest }] = await rows<{ latest: number }>(pool, "SELECT COALESCE(MAX(id), 0) AS latest FROM bc_bookings WHERE kind = 'booking'");
      return json({ ok: true, pending: Number(pending), latestId: Number(latest) });
    }

    case "bookings": {
      const from = q.get("from") || fmt(nowWall()).slice(0, 10);
      const days = Math.max(1, Math.min(62, Number(q.get("days") || 14)));
      if (!validDate(from)) return fail("Bad date");
      const list = await rows<BookingRow>(
        pool,
        `SELECT * FROM bc_bookings WHERE (status = 'pending' AND end_at >= ?) OR (start_at >= ? AND start_at < ?) ORDER BY start_at`,
        [fmt(nowWall()), fmt(at(from, "00:00")), fmt(addDays(at(from, "00:00"), days))]
      );
      return json({ ok: true, bookings: list.map(adminBooking) });
    }

    case "approve":
    case "reject":
    case "cancel": {
      const id = Number(inp.id);
      const reason = str(inp.reason, 200);
      const b = await withBookingLock(async (c) => {
        const [row] = await rows<BookingRow>(c, "SELECT * FROM bc_bookings WHERE id = ?", [id]);
        if (!row) throw new Conflict("Booking not found");
        if (action === "approve") {
          if (row.status !== "pending") throw new Conflict("This request was already handled.");
          if ((await busyRanges(c, row.start_at, row.end_at, Number(row.id))).length) {
            throw new Conflict("Time conflict: another booking overlaps this time.");
          }
        }
        const status = ({ approve: "approved", reject: "rejected", cancel: "cancelled" } as const)[action];
        await c.query("UPDATE bc_bookings SET status = ?, reason = ?, decided_at = ? WHERE id = ?", [status, reason || null, fmt(nowWall()), id]);
        return { ...row, status };
      });
      const notice = b.kind === "booking" ? await notifyClient(s, b, action === "approve" ? "approved" : "rejected", siteUrl(req)) : null;
      return json({ ok: true, booking: adminBooking(b), notice });
    }

    case "block": {
      const date = str(inp.date, 10);
      const time = str(inp.time, 5);
      const minutes = Math.max(5, Math.min(24 * 60, Number(inp.minutes) || 30));
      const label = str(inp.label, 80) || "Blocked";
      if (!validDate(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Choose a date and time");
      const start = at(date, time);
      const end = addMin(start, minutes);
      await withBookingLock(async (c) => {
        if ((await busyRanges(c, fmt(start), fmt(end))).length) throw new Conflict("Time conflict: there is already a booking in that time.");
        await insertBooking(c, {
          code: randomCode(), token: randomToken(), service_id: null, service_name: label, duration_min: minutes, price: null,
          customer_name: label, phone: "", note: null, start_at: fmt(start), end_at: fmt(end), status: "approved", kind: "block",
          ip: clientIp(req), created_at: fmt(nowWall()), decided_at: fmt(nowWall()),
        });
      });
      return json({ ok: true });
    }

    case "services": {
      const list = await rows<{ id: number; name: string; duration_min: number; price: string | null; active: number; sort: number }>(
        pool, "SELECT * FROM bc_services ORDER BY sort, id"
      );
      return json({
        ok: true,
        services: list.map((r) => ({ id: Number(r.id), name: r.name, duration: Number(r.duration_min), price: r.price, active: !!Number(r.active), sort: Number(r.sort) })),
      });
    }

    case "service_save": {
      const name = str(inp.name, 80);
      const duration = Number(inp.duration);
      const price = str(inp.price, 32);
      if (!name || !(duration >= 5 && duration <= 600)) return fail("Name and a duration between 5 and 600 minutes are required");
      const args = [name, duration, price || null, inp.active ? 1 : 0, Number(inp.sort) || 0];
      if (inp.id) await pool.query("UPDATE bc_services SET name = ?, duration_min = ?, price = ?, active = ?, sort = ? WHERE id = ?", [...args, Number(inp.id)]);
      else await pool.query("INSERT INTO bc_services (name, duration_min, price, active, sort) VALUES (?, ?, ?, ?, ?)", args);
      return json({ ok: true });
    }

    case "service_delete":
      await pool.query("DELETE FROM bc_services WHERE id = ?", [Number(inp.id)]);
      return json({ ok: true });

    case "settings":
      return json({
        ok: true,
        settings: { ...s, cloud_token: s.cloud_token ? SECRET_MASK : "", callmebot_apikey: s.callmebot_apikey ? SECRET_MASK : "" },
      });

    case "settings_save": {
      const v = { ...((inp.settings as Partial<Settings>) || {}) } as Record<string, unknown>;
      for (const k of ["cloud_token", "callmebot_apikey"]) if (v[k] === SECRET_MASK) delete v[k];
      if (typeof v.barber_whatsapp === "string" && v.barber_whatsapp !== "") {
        const n = normalizePhone(v.barber_whatsapp);
        if (!n) return fail("Barber WhatsApp number looks invalid");
        v.barber_whatsapp = n;
      }
      const clamp: Record<string, [number, number]> = { slot_step: [5, 120], lead_minutes: [0, 1440], days_ahead: [1, 60], max_pending_per_phone: [1, 10] };
      for (const [k, [mn, mx]] of Object.entries(clamp)) if (k in v) v[k] = Math.max(mn, Math.min(mx, Number(v[k]) || mn));
      if ("notify_driver" in v && !["manual", "callmebot", "cloud"].includes(String(v.notify_driver))) return fail("Unknown notification method");
      for (const k of Object.keys(v)) if (!(k in DEFAULT_SETTINGS)) delete v[k];
      await saveSettings(pool, v as Partial<Settings>);
      return json({ ok: true });
    }

    case "test_notify": {
      const fake = { customer_name: "Test Client", phone: s.barber_whatsapp, service_name: "Haircut", start_at: fmt(addMin(nowWall(), 60)), code: "BC-TEST" };
      return json({ ok: true, result: await notifyBarberNew(s, fake, siteUrl(req)) });
    }

    case "password":
      return fail("The admin password is set with the ADMIN_PASSWORD environment variable in Hostinger.", 400);
  }
  return fail("Unknown action", 404);
}

async function safe(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof Conflict) return fail(e.message, 409);
    console.error("[admin]", e);
    return fail(`Server error: ${(e as Error).message}`, 500);
  }
}

export const GET = safe;
export const POST = safe;
