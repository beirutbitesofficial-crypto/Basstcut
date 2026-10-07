export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export const fail = (error: string, status = 400) => json({ ok: false, error }, status);

/** Thrown for user-facing problems (conflicts, validation) → 409 with the message. */
export class Conflict extends Error {}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}

export const clientIp = (req: Request) =>
  (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "").trim().slice(0, 45);

export const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
