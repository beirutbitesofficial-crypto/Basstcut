/**
 * Wall-clock time helpers for Asia/Beirut.
 * All booking times are stored as local strings "YYYY-MM-DD HH:MM:SS". Internally we do the
 * arithmetic on Date objects whose *UTC fields* hold the Beirut wall-clock time, so the server's
 * own timezone never matters.
 */
export const TZ = process.env.BUSINESS_TIMEZONE || "Asia/Beirut";

export type Wall = Date; // UTC fields = local wall clock

export function nowWall(): Wall {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")));
}

export const addMin = (d: Wall, m: number): Wall => new Date(d.getTime() + m * 60000);
export const addDays = (d: Wall, n: number): Wall => new Date(d.getTime() + n * 86400000);

const p2 = (n: number) => String(n).padStart(2, "0");
export const fmt = (d: Wall) =>
  `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
export const fmtDate = (d: Wall) => fmt(d).slice(0, 10);
export const fmtHM = (d: Wall) => fmt(d).slice(11, 16);

export function at(date: string, hhmm: string): Wall {
  if (hhmm === "24:00") return addDays(at(date, "00:00"), 1);
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi, 0));
}

export const parseWall = (s: string): Wall => new Date(s.replace(" ", "T") + "Z");

export function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = at(s, "00:00");
  return !isNaN(d.getTime()) && fmtDate(d) === s;
}

/** ISO weekday 1 = Monday … 7 = Sunday */
export const isoDow = (d: Wall) => ((d.getUTCDay() + 6) % 7) + 1;

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function niceDate(s: string) {
  const d = parseWall(s);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function niceTime(s: string) {
  const d = parseWall(s);
  const h = d.getUTCHours();
  return `${((h + 11) % 12) + 1}:${p2(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
}
