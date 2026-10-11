/**
 * Web Push notifications to the barber's phone (works with the admin app closed).
 * VAPID keys are generated once and stored in the database — no setup needed.
 */
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import type { Pool } from "mysql2/promise";
import { rows } from "./db";
import { fmt, nowWall } from "./time";

type Vapid = { publicKey: string; privateKey: string };

async function vapid(q: Pool): Promise<Vapid> {
  const [row] = await rows<{ v: string }>(q, "SELECT v FROM bc_settings WHERE k = 'vapid'");
  if (row) {
    try {
      const v = JSON.parse(row.v) as Vapid;
      if (v.publicKey && v.privateKey) return v;
    } catch {}
  }
  const keys = webpush.generateVAPIDKeys();
  // INSERT IGNORE: if two requests race, the first stored key pair wins.
  await q.query("INSERT IGNORE INTO bc_settings (k, v) VALUES ('vapid', ?)", [JSON.stringify(keys)]);
  const [stored] = await rows<{ v: string }>(q, "SELECT v FROM bc_settings WHERE k = 'vapid'");
  return JSON.parse(stored.v) as Vapid;
}

export async function pushPublicKey(q: Pool) {
  return (await vapid(q)).publicKey;
}

const hash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export async function saveSubscription(q: Pool, sub: PushSubscription, device: string) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Invalid subscription");
  await q.query(
    `INSERT INTO bc_push_subs (endpoint_hash, endpoint, p256dh, auth, device, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), device = VALUES(device)`,
    [hash(sub.endpoint), sub.endpoint, sub.keys.p256dh, sub.keys.auth, device.slice(0, 120), fmt(nowWall())]
  );
}

export async function removeSubscription(q: Pool, endpoint: string) {
  await q.query("DELETE FROM bc_push_subs WHERE endpoint_hash = ?", [hash(endpoint)]);
}

export async function countSubscriptions(q: Pool) {
  const [{ n }] = await rows<{ n: number }>(q, "SELECT COUNT(*) AS n FROM bc_push_subs");
  return Number(n);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send to every subscribed device. Dead subscriptions (404/410) are removed. */
export async function pushToBarber(q: Pool, payload: PushPayload) {
  const subs = await rows<{ endpoint: string; p256dh: string; auth: string }>(q, "SELECT endpoint, p256dh, auth FROM bc_push_subs");
  if (!subs.length) return { sent: 0, failed: 0 };
  const keys = await vapid(q);
  const subject = process.env.SITE_URL || "https://basstcut.com";
  const body = JSON.stringify({ url: "/admin/", ...payload });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 6,
          urgency: "high", // deliver immediately, even when the phone is idle
          timeout: 8000,
        });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removeSubscription(q, s.endpoint).catch(() => {});
        else console.error("[push]", code, (e as Error).message);
      }
    })
  );
  return { sent, failed };
}
