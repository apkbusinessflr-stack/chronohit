// api/wallet/index.js
// Δέχεται ΚΑΙ uuid ΚΑΙ user_id (aliases) σε GET/POST.
// ESM + Node runtime. Neon Postgres via pg.

export const config = { runtime: "nodejs" };

import { Client } from "pg";

function bad(res, code, msg) {
  return res.status(code).json({ ok: false, error: msg });
}

function getUuidAlias(obj) {
  // Δέχεται uuid ή user_id (snake/camel) από query ή body
  const v =
    obj?.uuid ??
    obj?.user_id ??
    obj?.userId ??
    obj?.USER_ID ??
    obj?.UUID;
  return (typeof v === "string" ? v.trim() : "");
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

async function ensureSchema(db) {
  await db.query(`
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
      const uuid = getUuidAlias(req.query);
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
      // Body μπορεί να έχει uuid ή user_id
      let body = {};
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
      } catch {
        return bad(res, 400, "invalid json");
      }

      const uuid = getUuidAlias(body);
      const delta = Number(body?.delta);

      if (!uuid) return bad(res, 400, "uuid required");
      if (!Number.isInteger(delta)) return bad(res, 400, "delta must be integer");
      if (Math.abs(delta) > 100000) return bad(res, 400, "delta out of range");

      const out = await withClient(async (db) => {
        await ensureSchema(db);
        const result = await db.query(
          `
          INSERT INTO wallets (uuid, credits)
          VALUES ($1, GREATEST(0, $2))
          ON CONFLICT (uuid)
          DO UPDATE SET
            credits   = GREATEST(0, wallets.credits + EXCLUDED.credits),
            updated_at = NOW()
          RETURNING credits;
        `,
          [uuid, delta]
        );
        return { ok: true, uuid, credits_after: Number(result.rows[0].credits) };
      });

      return res.status(200).json(out);
    }

    return bad(res, 405, "Method not allowed");
  } catch (e) {
    console.error("wallet error", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
