// api/wallet/index.js
// Diagnostic build: κρατά την ίδια λογική, αλλά αν βάλεις ?debug=1 ή header x-debug:1
// επιστρέφει το εσωτερικό error string αντί για generic "server error".
// Συμβατό και με wallets(user_id, credits) ΚΑΙ με wallets(uuid, credits).

export const config = { runtime: "nodejs" };

import { Client } from "pg";

function wantDebug(req) {
  try {
    if ((req.headers["x-debug"] || "").toString() === "1") return true;
    // Vercel δίνει query μέσω req.query
    const q = req.query || {};
    return (q.debug || "") === "1";
  } catch { return false; }
}

function bad(res, code, msg, dbg) {
  const body = { ok: false, error: msg };
  if (dbg) body.debug = dbg;
  return res.status(code).json(body);
}

async function withClient(fn) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Αν δεν υπάρχει πίνακας, τον δημιουργούμε με user_id για συμβατότητα
async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id   TEXT PRIMARY KEY,
      credits   INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// Ανιχνεύουμε ποια στήλη ταυτότητας υπάρχει: 'user_id' ή 'uuid'
async function detectIdColumn(db) {
  const r = await db.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wallets'
        AND column_name IN ('user_id','uuid')
      ORDER BY CASE column_name WHEN 'user_id' THEN 0 ELSE 1 END
      LIMIT 1;`
  );
  return r.rowCount ? r.rows[0].column_name : "user_id";
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
  const DEBUG = wantDebug(req);

  try {
    const method = req.method || "GET";

    if (method === "GET") {
      const id = getIdAlias(req.query);
      if (!id) return bad(res, 400, "uuid required");

      const out = await withClient(async (db) => {
        await ensureTable(db);
        const idCol = await detectIdColumn(db); // 'user_id' ή 'uuid'
        const r = await db.query(`SELECT credits FROM wallets WHERE ${idCol} = $1`, [id]);
        const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
        return { ok: true, uuid: id, credits, id_col: idCol };
      });

      return res.status(200).json(out);
    }

    if (method === "POST") {
      // Body: { uuid|user_id, delta }
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
        const idCol = await detectIdColumn(db);

        // Unique index για το idCol (αν δεν υπάρχει)
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
        return { ok: true, uuid: id, credits_after: Number(r.rows[0].credits), id_col: idCol };
      });

      return res.status(200).json(out);
    }

    return bad(res, 405, "Method not allowed");
  } catch (e) {
    console.error("wallet error", e);
    return bad(res, 500, "server error", String(e && e.message || e));
  }
}
