import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin login: password from the ADMIN_PASSWORD env var; session = signed, httpOnly cookie.
 * CSRF: POSTs must carry X-CSRF, an HMAC tied to the session.
 */
const COOKIE = "basst_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export function checkPassword(pw: string) {
  const real = process.env.ADMIN_PASSWORD || "";
  return real.length > 0 && safeEq(sign(`pw:${pw}`), sign(`pw:${real}`));
}

export async function createSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  const sid = `${exp}.${Math.random().toString(36).slice(2)}`;
  (await cookies()).set(COOKIE, `${sid}.${sign(sid)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return csrfFor(sid);
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function sessionId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !secret()) return null;
  const i = raw.lastIndexOf(".");
  const sid = raw.slice(0, i);
  if (!safeEq(raw.slice(i + 1), sign(sid))) return null;
  if (Number(sid.split(".")[0]) < Date.now()) return null;
  return sid;
}

const csrfFor = (sid: string) => sign(`csrf:${sid}`);

export async function currentCsrf() {
  const sid = await sessionId();
  return sid ? csrfFor(sid) : null;
}

export async function isAdmin(req?: Request) {
  const sid = await sessionId();
  if (!sid) return false;
  if (req && req.method === "POST") return safeEq(req.headers.get("x-csrf") || "", csrfFor(sid));
  return true;
}
