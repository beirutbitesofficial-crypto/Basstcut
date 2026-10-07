import type { Pool, PoolConnection } from "mysql2/promise";
import { randomBytes, randomInt } from "node:crypto";
import { rows } from "./db";
import { addDays, addMin, at, fmt, fmtDate, fmtHM, isoDow, niceDate, niceTime, nowWall, validDate } from "./time";

type Q = Pool | PoolConnection;

/* ------------------------------------------------------------------ settings */

export type Hours = Record<string, [string, string][]>;
export type Settings = {
  hours: Hours;
  closed_dates: string[];
  slot_step: number;
  lead_minutes: number;
  days_ahead: number;
  max_pending_per_phone: number;
  barber_whatsapp: string;
  notify_driver: "manual" | "callmebot" | "cloud";
  callmebot_apikey: string;
  cloud_token: string;
  cloud_phone_id: string;
  cloud_lang: string;
  cloud_tpl_barber: string;
  cloud_tpl_approved: string;
  cloud_tpl_rejected: string;
  msg_barber: string;
  msg_approved: string;
  msg_rejected: string;
  msg_received: string;
};

const DAY: [string, string][] = [["08:00", "20:00"]]; // default 8 AM – 8 PM, every day
export const DEFAULT_SETTINGS: Settings = {
  hours: { "1": DAY, "2": DAY, "3": DAY, "4": DAY, "5": DAY, "6": DAY, "7": DAY },
  closed_dates: [],
  slot_step: 30,
  lead_minutes: 30,
  days_ahead: 14,
  max_pending_per_phone: 2,
  barber_whatsapp: process.env.BARBER_WHATSAPP || "",
  notify_driver: "manual",
  callmebot_apikey: "",
  cloud_token: "",
  cloud_phone_id: "",
  cloud_lang: "en",
  cloud_tpl_barber: "",
  cloud_tpl_approved: "",
  cloud_tpl_rejected: "",
  msg_barber: "✂️ New booking request — BASST CUT\n{name} · +{phone}\n{service} · {date} at {time}\n\nApprove: {admin_url}",
  msg_approved: "Hi {name}! ✅ Your appointment at BASST CUT is confirmed.\n{service} · {date} at {time}\nAbra, Sidon — see you soon!",
  msg_rejected: "Hi {name}, sorry — we can't take your booking on {date} at {time}. Please pick another time: {site_url}",
  msg_received: "Hi {name}! We received your BASST CUT request for {date} at {time}. ⏳ Waiting for the barber's confirmation.",
};

export async function getSettings(q: Q): Promise<Settings> {
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const r of await rows<{ k: string; v: string }>(q, "SELECT k, v FROM bc_settings")) {
    if (r.k in out) {
      try {
        (out as Record<string, unknown>)[r.k] = JSON.parse(r.v);
      } catch {
        (out as Record<string, unknown>)[r.k] = r.v;
      }
    }
  }
  return out;
}

export async function saveSettings(q: Q, values: Partial<Settings>) {
  for (const [k, v] of Object.entries(values)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    await q.query("REPLACE INTO bc_settings (k, v) VALUES (?, ?)", [k, JSON.stringify(v)]);
  }
}

/* ------------------------------------------------------------------ availability */

export type BookingRow = {
  id: number;
  code: string;
  token: string;
  service_id: number | null;
  service_name: string;
  duration_min: number;
  price: string | null;
  customer_name: string;
  phone: string;
  note: string | null;
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  kind: "booking" | "block";
  reason: string | null;
  ip: string | null;
  created_at: string;
  decided_at: string | null;
};

/** Bookings that block time (pending or approved) overlapping [from, to). */
export async function busyRanges(q: Q, from: string, to: string, exceptId?: number) {
  return rows<{ id: number; start_at: string; end_at: string }>(
    q,
    `SELECT id, start_at, end_at FROM bc_bookings
     WHERE status IN ('pending','approved') AND start_at < ? AND end_at > ? ${exceptId ? "AND id <> ?" : ""}`,
    exceptId ? [to, from, exceptId] : [to, from]
  );
}

export function openingFor(s: Settings, date: string) {
  if ((s.closed_dates || []).includes(date)) return [];
  const ranges = s.hours[String(isoDow(at(date, "00:00")))] || [];
  const out: [Date, Date][] = [];
  for (const r of ranges) {
    if (!Array.isArray(r) || r.length !== 2 || !/^\d{2}:\d{2}$/.test(r[0]) || !/^\d{2}:\d{2}$/.test(r[1])) continue;
    const open = at(date, r[0]);
    const close = at(date, r[1]);
    if (close > open) out.push([open, close]);
  }
  return out;
}

export function bookableDays(s: Settings) {
  const today = at(fmtDate(nowWall()), "00:00");
  const n = Math.max(1, Math.min(60, Number(s.days_ahead) || 14));
  return Array.from({ length: n }, (_, i) => {
    const date = fmtDate(addDays(today, i));
    return { date, open: openingFor(s, date).length > 0 };
  });
}

/**
 * Free start times on `date` for a service lasting `duration` minutes:
 * inside opening hours, on the time grid, at least `lead_minutes` from now,
 * and not overlapping any pending or approved booking.
 */
export async function availableSlots(q: Q, s: Settings, date: string, duration: number): Promise<string[]> {
  if (!validDate(date) || !bookableDays(s).some((d) => d.date === date)) return [];
  const ranges = openingFor(s, date);
  if (!ranges.length) return [];
  const step = Math.max(5, Number(s.slot_step) || 30);
  const earliest = addMin(nowWall(), Math.max(0, Number(s.lead_minutes) || 0));
  const busy = await busyRanges(q, fmt(at(date, "00:00")), fmt(addDays(at(date, "24:00"), 1)));

  const slots = new Set<string>();
  for (const [open, close] of ranges) {
    for (let t = open; addMin(t, duration) <= close; t = addMin(t, step)) {
      if (t < earliest) continue;
      const a = fmt(t);
      const b = fmt(addMin(t, duration));
      if (!busy.some((x) => x.start_at < b && x.end_at > a)) slots.add(fmtHM(t));
    }
  }
  return [...slots];
}

/* ------------------------------------------------------------------ helpers */

/** Normalize to international digits (Lebanon default). Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D+/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) d = "961" + d.slice(3).replace(/^0+/, "");
  else if (d.length <= 8) d = "961" + d.replace(/^0+/, "");
  if (d.length < 10 || d.length > 15) return null;
  if (d.startsWith("961") && (d.length < 10 || d.length > 11)) return null;
  return d;
}

export function randomCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "BC-" + Array.from({ length: 5 }, () => A[randomInt(A.length)]).join("");
}
export const randomToken = () => randomBytes(12).toString("hex");

export function publicBooking(b: BookingRow) {
  return {
    code: b.code,
    status: b.status,
    service: b.service_name,
    date: b.start_at.slice(0, 10),
    time: b.start_at.slice(11, 16),
    dateLabel: niceDate(b.start_at),
    timeLabel: niceTime(b.start_at),
  };
}

export function adminBooking(b: BookingRow) {
  const client = b.kind === "booking" && b.phone !== "";
  return {
    id: Number(b.id),
    code: b.code,
    kind: b.kind,
    status: b.status,
    name: b.customer_name,
    phone: b.phone,
    service: b.service_name,
    duration: Number(b.duration_min),
    price: b.price,
    note: b.note,
    start: b.start_at,
    end: b.end_at,
    dateLabel: niceDate(b.start_at),
    timeLabel: `${niceTime(b.start_at)} – ${niceTime(b.end_at)}`,
    created: b.created_at,
    chat: client ? `https://wa.me/${b.phone}` : null,
  };
}

export async function insertBooking(q: Q, b: Omit<BookingRow, "id" | "reason" | "decided_at"> & { decided_at?: string | null }) {
  const cols = Object.keys(b);
  await q.query(`INSERT INTO bc_bookings (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, Object.values(b));
}

export { niceDate, niceTime, nowWall, fmt, at, addMin };
