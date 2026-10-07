import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";

/**
 * MySQL connection (Hostinger: hPanel → Databases → MySQL).
 * Configure with environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 */
declare global {
  // eslint-disable-next-line no-var
  var __basstPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __basstMigrated: Promise<void> | undefined;
}

export const dbConfigured = () => Boolean(process.env.DB_NAME && process.env.DB_USER);

export function pool(): Pool {
  if (!dbConfigured()) throw new Error("Database is not configured (set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
  globalThis.__basstPool ??= mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    charset: "utf8mb4",
    dateStrings: true,
  });
  return globalThis.__basstPool;
}

export async function db(): Promise<Pool> {
  const p = pool();
  globalThis.__basstMigrated ??= migrate(p).catch((e) => {
    globalThis.__basstMigrated = undefined;
    throw e;
  });
  await globalThis.__basstMigrated;
  return p;
}

export async function rows<T>(q: Pool | PoolConnection, sql: string, args: unknown[] = []): Promise<T[]> {
  const [r] = await q.query<RowDataPacket[]>(sql, args);
  return r as T[];
}

async function migrate(p: Pool) {
  await p.query(`CREATE TABLE IF NOT EXISTS bc_settings (
    k VARCHAR(64) NOT NULL PRIMARY KEY,
    v TEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await p.query(`CREATE TABLE IF NOT EXISTS bc_services (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    duration_min INT NOT NULL,
    price VARCHAR(32) NULL,
    active TINYINT NOT NULL DEFAULT 1,
    sort INT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await p.query(`CREATE TABLE IF NOT EXISTS bc_bookings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(16) NOT NULL,
    token VARCHAR(40) NOT NULL,
    service_id INT NULL,
    service_name VARCHAR(80) NOT NULL,
    duration_min INT NOT NULL,
    price VARCHAR(32) NULL,
    customer_name VARCHAR(80) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    note VARCHAR(300) NULL,
    start_at VARCHAR(19) NOT NULL,
    end_at VARCHAR(19) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    kind VARCHAR(12) NOT NULL DEFAULT 'booking',
    reason VARCHAR(200) NULL,
    ip VARCHAR(45) NULL,
    created_at VARCHAR(19) NOT NULL,
    decided_at VARCHAR(19) NULL,
    UNIQUE KEY bc_bookings_code (code),
    KEY bc_bookings_start (start_at),
    KEY bc_bookings_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [{ n }] = await rows<{ n: number }>(p, "SELECT COUNT(*) AS n FROM bc_services");
  const seeded = await rows(p, "SELECT 1 FROM bc_settings WHERE k = 'seeded'");
  if (Number(n) === 0 && seeded.length === 0) {
    const seed: [string, number][] = [
      ["Haircut", 30], ["Fade", 45], ["Beard Trim", 30], ["Haircut + Beard", 60], ["Kids Cut", 30], ["Styling", 30],
    ];
    for (const [i, [name, d]] of seed.entries()) {
      await p.query("INSERT INTO bc_services (name, duration_min, price, active, sort) VALUES (?, ?, NULL, 1, ?)", [name, d, i]);
    }
    await p.query("INSERT INTO bc_settings (k, v) VALUES ('seeded', '1')");
  }
}

/** Serialize every booking write so two people can never grab the same or overlapping time. */
export async function withBookingLock<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await (await db()).getConnection();
  try {
    const [[{ got }]] = await c.query<RowDataPacket[]>("SELECT GET_LOCK('basst_cut_booking', 10) AS got");
    if (Number(got) !== 1) throw new Error("Busy, please try again.");
    try {
      await c.beginTransaction();
      const r = await fn(c);
      await c.commit();
      return r;
    } catch (e) {
      await c.rollback().catch(() => {});
      throw e;
    } finally {
      await c.query("SELECT RELEASE_LOCK('basst_cut_booking')").catch(() => {});
    }
  } finally {
    c.release();
  }
}
