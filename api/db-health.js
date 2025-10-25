export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    const { DATABASE_URL } = process.env;
    if (!DATABASE_URL) {
      return res.status(200).json({ ok: true, db: "missing DATABASE_URL (not configured)" });
    }
    const { Client } = await import("pg");
    const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await c.connect();
    const r = await c.query("select 1 as ok");
    await c.end();
    return res.status(200).json({ ok: true, result: r.rows[0].ok });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
}
