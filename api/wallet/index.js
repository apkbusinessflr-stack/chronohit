// api/wallet/index.js
// Συμβατό και με wallets(user_id, credits) και με wallets(uuid, credits)
// ESM + Node runtime. Neon Postgres via pg.

export const config = { runtime: "nodejs" };

import { Client } from "pg";

function bad(res, code, msg) {
  return res.status(code).json({ ok: false, error: msg });
}

async function withClient(fn) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Αν δεν υπάρχει καθόλου πίνακας, τον δημιουργούμε με user_id (για συμβατότητα)
async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// Επιστρέφει ποια στήλη ταυτότητας υπάρχει: 'user_id' ή 'uuid'
async function detectIdColumn(db) {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets'
      AND column_name IN ('user_id','uuid')
    ORDER BY CASE column_name WHEN 'user_id' THEN 0 ELSE 1 END
    LIMIT 1;
  `;
  const r = await db.query(q);
  if (r.rowCount) return r.rows[0].column_name;
  return "user_id";
}

function getIdAlias(obj) {
  const v =
    obj?.uuid ??
    obj?.user_id ??
    obj?.userId ??
    obj?.USER_ID ??
    obj?.UUID;
  return typeof v === "string" ? v.trim() : "";
}

export default async function handler(req, res) {
  try {
    const method = req.method || "GET";

    if (method === "GET") {
      const id = getIdAlias(req.query);
      if (!id) return bad(res, 400, "uuid required"); // μήνυμα ίδιο για απλότητα

      const out = await withClient(async (db) => {
        await ensureTable(db);
        const idCol = await detectIdColumn(db);             // 'user_id' ή 'uuid'
        const r = await db.query(`SELECT credits FROM wallets WHERE ${idCol} = $1`, [id]);
        const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
        return { ok: true, uuid: id, credits };
      });

      return res.status(200).json(out);
    }

    if (method === "POST") {
      // Body: { uuid | user_id, delta }
      let body = {};
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        return bad(res, 400, "invalid json");
      }

      const id = getIdAlias(body);
      const delta = Number(body?.delta);

      if (!id) return bad(res, 400, "uuid required");
      if (!Number.isInteger(delta)) return bad(res, 400, "delta must be integer");
      if (Math.abs(delta) > 100000) return bad(res, 400, "delta out of range");

      const out = await withClient(async (db) => {
        await ensureTable(db);
        const idCol = await detectIdColumn(db); // 'user_id' ή 'uuid'

        // Αν δεν υπάρχει unique constraint στο επιλεγμένο idCol, δημιούργησέ το (μία φορά)
        // (Ασφαλές: IF NOT EXISTS)
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wallets_${idCol}_uniq ON wallets(${idCol});`);

        // Upsert + clamp >= 0
        const sql = `
          INSERT INTO wallets (${idCol}, credits)
          VALUES ($1, GREATEST(0, $2))
          ON CONFLICT (${idCol})
          DO UPDATE SET
            credits    = GREATEST(0, wallets.credits + EXCLUDED.credits),
            updated_at = NOW()
          RETURNING credits;
        `;
        const r = await db.query(sql, [id, delta]);
        return { ok: true, uuid: id, credits_after: Number(r.rows[0].credits) };
      });

      return res.status(200).json(out);
    }

    return bad(res, 405, "Method not allowed");
  } catch (e) {
    console.error("wallet error", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
