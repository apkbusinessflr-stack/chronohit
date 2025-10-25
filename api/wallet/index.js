// api/wallet/index.js
// ESM + Node runtime. Ασφαλές για Neon Postgres.
// Παρέχει:
//   GET  /api/wallet?uuid=<user_uuid>           -> { ok:true, uuid, credits }
//   POST /api/wallet    { uuid, delta }         -> { ok:true, uuid, credits_after }
//      - delta: ακέραιος, π.χ. +100 από checkout
//   (δημιουργεί τον πίνακα wallets αν δεν υπάρχει)

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

async function ensureSchema(client) {
  // Δημιουργεί wallets αν δεν υπάρχει (μία φορά). credits >= 0
  await client.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      uuid TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export default async function handler(req, res) {
  try {
    const method = req.method || "GET";

    if (method === "GET") {
      const uuid = String(req.query?.uuid || "").trim();
      if (!uuid) return bad(res, 400, "uuid required");

      const out = await withClient(async (db) => {
        await ensureSchema(db);
        const r = await db.query("SELECT credits FROM wallets WHERE uuid = $1", [uuid]);
        const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
        return { ok: true, uuid, credits };
      });
      return res.status(200).json(out);
    }

    if (method === "POST") {
      // Body: { uuid, delta }
      let body = {};
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        return bad(res, 400, "invalid json");
      }

      const uuid = String(body?.uuid || "").trim();
      const delta = Number(body?.delta);

      if (!uuid) return bad(res, 400, "uuid required");
      if (!Number.isInteger(delta)) return bad(res, 400, "delta must be integer");

      // Guard: απορρίπτουμε υπερβολικές πιστώσεις από public endpoints
      if (Math.abs(delta) > 100000) return bad(res, 400, "delta out of range");

      const out = await withClient(async (db) => {
        await ensureSchema(db);
        // Upsert + clamp σε 0 ελάχιστο
        const result = await db.query(
          `
          INSERT INTO wallets (uuid, credits)
          VALUES ($1, GREATEST(0, $2))
          ON CONFLICT (uuid)
          DO UPDATE SET
            credits = GREATEST(0, wallets.credits + EXCLUDED.credits),
            updated_at = NOW()
          RETURNING credits;
        `,
          [uuid, delta]
        );
        const credits_after = Number(result.rows[0].credits);
        return { ok: true, uuid, credits_after };
      });

      return res.status(200).json(out);
    }

    return bad(res, 405, "Method not allowed");
  } catch (e) {
    console.error("wallet error", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
