import type { BookingRow, Settings } from "./booking";
import { niceDate, niceTime } from "./time";

export type SendResult = { sent: boolean; error?: string | null; wa_link?: string };

export const siteUrl = (req: Request) => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

type Msg = Partial<BookingRow> & { start_at: string };

export function fillMessage(tpl: string, b: Msg, base: string) {
  const map: Record<string, string> = {
    "{name}": b.customer_name ?? "",
    "{phone}": b.phone ?? "",
    "{service}": b.service_name ?? "",
    "{date}": niceDate(b.start_at),
    "{time}": niceTime(b.start_at),
    "{code}": b.code ?? "",
    "{price}": b.price ?? "",
    "{note}": b.note ?? "",
    "{admin_url}": `${base}/admin/`,
    "{site_url}": `${base}/booking/`,
  };
  return tpl.replace(/\{[a-z_]+\}/g, (k) => map[k] ?? k);
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D+/g, "")}?text=${encodeURIComponent(text)}`;

/** Send a WhatsApp message through the configured driver. */
export async function sendWhatsApp(
  s: Settings,
  to: string,
  text: string,
  template = "",
  params: string[] = [],
  toBarber = false
): Promise<SendResult> {
  to = to.replace(/\D+/g, "");
  if (!to) return { sent: false, error: "No phone number" };
  const signal = AbortSignal.timeout(12000);
  try {
    if (s.notify_driver === "callmebot") {
      // CallMeBot can only message the number that registered the key (the barber).
      if (!toBarber || !s.callmebot_apikey) return { sent: false, error: "CallMeBot only notifies the barber" };
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(s.callmebot_apikey)}`;
      const r = await fetch(url, { signal });
      const body = await r.text();
      const ok = r.ok && !/error/i.test(body);
      return { sent: ok, error: ok ? null : `CallMeBot HTTP ${r.status}` };
    }
    if (s.notify_driver === "cloud") {
      if (!s.cloud_token || !s.cloud_phone_id) return { sent: false, error: "Cloud API not configured" };
      const payload: Record<string, unknown> = { messaging_product: "whatsapp", to };
      if (template) {
        payload.type = "template";
        payload.template = {
          name: template,
          language: { code: s.cloud_lang || "en" },
          components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }],
        };
      } else {
        payload.type = "text";
        payload.text = { body: text, preview_url: false };
      }
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(s.cloud_phone_id)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.cloud_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      if (r.ok) return { sent: true };
      const err = await r.json().catch(() => null);
      return { sent: false, error: err?.error?.message || `Cloud API HTTP ${r.status}` };
    }
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
  return { sent: false, error: "Manual mode" };
}

export function notifyBarberNew(s: Settings, b: Msg, base: string) {
  const text = fillMessage(s.msg_barber, b, base);
  return sendWhatsApp(
    s,
    s.barber_whatsapp,
    text,
    s.cloud_tpl_barber,
    [b.customer_name ?? "", `+${b.phone}`, b.service_name ?? "", niceDate(b.start_at), niceTime(b.start_at)],
    true
  );
}

export async function notifyClient(s: Settings, b: BookingRow, which: "approved" | "rejected", base: string): Promise<SendResult> {
  const text = fillMessage(which === "approved" ? s.msg_approved : s.msg_rejected, b, base);
  const tpl = which === "approved" ? s.cloud_tpl_approved : s.cloud_tpl_rejected;
  const res = await sendWhatsApp(s, b.phone, text, tpl, [b.customer_name, b.service_name, niceDate(b.start_at), niceTime(b.start_at)]);
  return { ...res, wa_link: waLink(b.phone, text) };
}
