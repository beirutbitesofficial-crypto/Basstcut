/** Tiny client for the admin API route (app/api/admin/route.ts). */

let csrf: string | null = null;
export const setCsrf = (t: string | null) => {
  csrf = t;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function adminApi<T = Record<string, unknown>>(action: string, body?: unknown, query = ""): Promise<T> {
  const init: RequestInit = { credentials: "same-origin" };
  if (body !== undefined) {
    init.method = "POST";
    init.headers = { "Content-Type": "application/json", ...(csrf ? { "X-CSRF": csrf } : {}) };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(`/api/admin/?action=${action}${query}`, init);
  const d = await r.json().catch(() => ({ ok: false, error: "Network error — check your connection." }));
  if (!d.ok) throw new ApiError(d.error || "Something went wrong", r.status);
  return d as T;
}

export type AdminBooking = {
  id: number;
  code: string;
  kind: "booking" | "block";
  status: "pending" | "approved" | "rejected" | "cancelled";
  name: string;
  phone: string;
  service: string;
  duration: number;
  price: string | null;
  note: string | null;
  start: string;
  end: string;
  dateLabel: string;
  timeLabel: string;
  created: string;
  chat: string | null;
};

export type AdminService = { id: number | null; name: string; duration: number; price: string | null; active: boolean; sort: number };

export type Settings = {
  hours: Record<string, [string, string][]>;
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

export type Notice = { sent: boolean; error?: string | null; wa_link?: string } | null;
