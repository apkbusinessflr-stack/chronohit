// api/wallet/index.js
// Συμβατό με υπάρχον wallets(user_id BIGINT, credits ...)
// και ταυτόχρονα υποστηρίζει αλφαριθμητικά ids μέσω στήλης uuid TEXT (auto-add).
// GET  /api/wallet?uuid=<id>   ή ?user_id=<id>
// POST /api/wallet { uuid|user_id, delta }
//
// Runtime: Node.js (χρειάζεται για pg)

export const config = { runtime: "nodejs" };

import { Client } from "pg";

function wantDebug(req) {
  try {
    if ((req.headers["x-debug"] || "").toString() === "1") return true;
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

// Υποψήφιο id από query/body (uuid ή user_id, snake/camel)
function getIdAlias(obj) {
  const v =
    obj?.uuid ??
    obj?.user_id ??
    obj?.userId ??
    obj?.UUID ??
    obj?.USER_ID;
  return typeof v === "string" ? v.trim() : "";
}

// Επιστρέφει μεταδεδομένα στήλης wallets: user_id (τύπος), uuid (τύπος/ύπαρξη)
async function inspectSchema(db) {
  const q = `
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='wallets'
       AND column_name IN ('user_id','uuid');
  `;
  const r = await db.query(q);
  const info = { user_id: null, uuid: null };
  for (const row of r.rows) {
    if (row.column_name === "user_id") info.user_id = row.data_type; // e.g. 'bigint'
    if (row.column_name === "uuid")    info.uuid    = row.data_type; // e.g. 'text'
  }
  return info;
}

// Δημιουργεί τον πίνακα αν λείπει εντελώς (με user_id BIGINT για συμβατότητα)
async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id   BIGINT PRIMARY KEY,
      credits   INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// Αν δεν υπάρχει στήλη uuid, την προσθέτει ως TEXT UNIQUE
async function ensureUuidColumn(db) {
  await db.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS uuid TEXT;`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wallets_uuid_uniq ON wallets(uuid);`);
}

// Βοηθητικό: true αν το string είναι ακέραιος (fit σε JS safe range)
function looksNumericId(s) {
  return /^[0-9]+$/.test(s) && Number.isSafeInteger(Number(s));
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
        const meta = await inspectSchema(db);

        // Επιλογή στήλης βάσει τύπου id
        if (looksNumericId(id) && meta.user_id /* bigint */) {
          const r = await db.query(`SELECT credits FROM wallets WHERE user_id = $1`, [Number(id)]);
          const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
          return { ok: true, uuid: id, credits, id_col: "user_id" };
        } else {
          await ensureUuidColumn(db);
          const r = await db.query(`SELECT credits FROM wallets WHERE uuid = $1`, [id]);
          const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
          return { ok: true, uuid: id, credits, id_col: "uuid" };
        }
      });

      return res.status(200).json(out);
    }

    if (method === "POST") {
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
        const meta = await inspectSchema(db);

        if (looksNumericId(id) && meta.user_id /* bigint */) {
          // Upsert σε user_id BIGINT
          await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_uniq ON wallets(user_id);`);
          const r = await db.query(
            `
            INSERT INTO wallets (user_id, credits)
            VALUES ($1, GREATEST(0, $2))
            ON CONFLICT (user_id)
            DO UPDATE SET
              credits    = GREATEST(0, wallets.credits + EXCLUDED.credits),
              updated_at = NOW()
            RETURNING credits;
          `,
            [Number(id), delta]
          );
          return { ok: true, uuid: id, credits_after: Number(r.rows[0].credits), id_col: "user_id" };
        } else {
          // Upsert σε uuid TEXT (auto add column)
          await ensureUuidColumn(db);
          const r = await db.query(
            `
            INSERT INTO wallets (uuid, credits)
            VALUES ($1, GREATEST(0, $2))
            ON CONFLICT (uuid)
            DO UPDATE SET
              credits    = GREATEST(0, wallets.credits + EXCLUDED.credits),
              updated_at = NOW()
            RETURNING credits;
          `,
            [id, delta]
          );
          return { ok: true, uuid: id, credits_after: Number(r.rows[0].credits), id_col: "uuid" };
        }
      });

      return res.status(200).json(out);
    }

    return bad(res, 405, "Method not allowed");
  } catch (e) {
    console.error("wallet error", e);
    return bad(res, 500, "server error", DEBUG ? String(e && e.message || e) : undefined);
  }
}
