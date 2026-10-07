/**
 * Health check: GET /api/health
 * Shows whether the server, settings and database work — never the values of secrets.
 */
import { dbConfigured, rows } from "@/lib/server/db";
import { adminConfigured } from "@/lib/server/auth";
import { fmt, nowWall } from "@/lib/server/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    DB_HOST: !!process.env.DB_HOST,
    DB_USER: !!process.env.DB_USER,
    DB_PASSWORD: !!process.env.DB_PASSWORD,
    DB_NAME: !!process.env.DB_NAME,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
  };
  let database: { ok: boolean; error?: string; services?: number } = { ok: false, error: "not configured" };
  if (dbConfigured()) {
    try {
      const { db } = await import("@/lib/server/db");
      const [{ n }] = await rows<{ n: number }>(await db(), "SELECT COUNT(*) AS n FROM bc_services");
      database = { ok: true, services: Number(n) };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      database = { ok: false, error: [err.code, err.message].filter(Boolean).join(": ").slice(0, 300) };
    }
  }
  return Response.json(
    { ok: database.ok && adminConfigured(), node: process.version, beirutTime: fmt(nowWall()), env, database },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
