// api/wallet/index.js
// Wallet με consume/credit + μηνιαίο auto-grant 1,000,000/μήνα ανά χρήστη.
// Συμβατό με wallets(user_id BIGINT) ή wallets(uuid TEXT). Node runtime.

export const config = { runtime: "nodejs" };

import { Client } from "pg";

function nowMonthYYYYMM() {
  const d = new Date();
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1); // π.χ. 202510
}
function getIdAlias(obj) {
  const v =
    obj?.uuid ??
    obj?.user_id ??
    obj?.userId ??
    obj?.UUID ??
    obj?.USER_ID;
  return typeof v === "string" ? v.trim() : "";
}
function looksNumericId(s) {
  return /^[0-9]+$/.test(s) && Number.isSafeInteger(Number(s));
}
function bad(res, code, msg, extra = {}) {
  return res.status(code).json({ ok: false, error: msg, ...extra });
}
async function withClient(fn) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

async function ensureBaseTable(db) {
  // default base: user_id BIGINT (για συμβατότητα με Neon που έχεις)
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id    BIGINT PRIMARY KEY,
      credits    INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
async function ensureUuidColumn(db) {
  await db.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS uuid TEXT;`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wallets_uuid_uniq ON wallets(uuid);`);
}
async function ensureMonthlyGrantColumn(db) {
  await db.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_grant_month INTEGER NOT NULL DEFAULT 0;`);
}
async function inspectSchema(db) {
  const r = await db.query(`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='wallets'
       AND column_name IN ('user_id','uuid','last_grant_month');
  `);
  const info = { user_id: null, uuid: null, last_grant_month: null };
  for (const row of r.rows) {
    info[row.column_name] = row.data_type; // bigint/text/integer
  }
  return info;
}
async function grantMonthlyIfNeeded(db, id, idCol, allowance = 1_000_000) {
  await ensureMonthlyGrantColumn(db);
  const m = nowMonthYYYYMM();

  // Αν δεν υπάρχει γραμμή -> δημιουργία με allowance αυτόματα (νέος χρήστης)
  const r0 = await db.query(`SELECT credits, last_grant_month FROM wallets WHERE ${idCol} = $1`, [id]);
  if (r0.rowCount === 0) {
    await db.query(
      `INSERT INTO wallets (${idCol}, credits, last_grant_month, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (${idCol}) DO NOTHING`,
      [id, allowance, m]
    );
    return;
  }
  const row = r0.rows[0];
  const last = Number(row.last_grant_month || 0);
  if (last !== m) {
    await db.query(
      `UPDATE wallets
          SET credits = credits + $2,
              last_grant_month = $3,
              updated_at = NOW()
        WHERE ${idCol} = $1`,
      [id, allowance, m]
    );
  }
}

export default async function handler(req, res) {
  try {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "POST") return bad(res, 405, "Method not allowed");

    const id = method === "GET" ? getIdAlias(req.query) : null;
    let body = {};
    if (method === "POST") {
      try {
        const chunks = []; for await (const c of req) chunks.push(c);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch { return bad(res, 400, "invalid json"); }
    }
    const bodyId = method === "POST" ? getIdAlias(body) : null;
    const userId = id || bodyId;
    if (!userId) return bad(res, 400, "uuid required");

    const op = method === "POST" ? (body.op || (Number.isInteger(body.delta) ? "credit" : "")) : "get";
    const amount = method === "POST"
      ? (Number.isInteger(body.amount) ? body.amount : (Number.isInteger(body.delta) ? body.delta : NaN))
      : 0;
    if (method === "POST" && (op === "consume" || op === "credit") && !Number.isInteger(amount)) {
      return bad(res, 400, "amount/delta must be integer");
    }
    if (method === "POST" && Math.abs(amount) > 100_000_000) return bad(res, 400, "amount out of range");

    const out = await withClient(async (db) => {
      await ensureBaseTable(db);
      const meta = await inspectSchema(db);
      const usingUserId = looksNumericId(userId) && meta.user_id; // bigint branch
      const idCol = usingUserId ? "user_id" : "uuid";
      if (!usingUserId) await ensureUuidColumn(db);
      const idParam = usingUserId ? Number(userId) : userId;

      // Μηνιαίο allowance lazy-grant: σε κάθε GET/POST πριν από την πράξη
      await grantMonthlyIfNeeded(db, idParam, idCol, 1_000_000);

      if (method === "GET") {
        const r = await db.query(`SELECT credits FROM wallets WHERE ${idCol}=$1`, [idParam]);
        const credits = r.rowCount ? Number(r.rows[0].credits) : 0;
        return { ok: true, uuid: userId, credits, id_col: idCol };
      }

      // POST ops
      if (op === "consume") {
        // atomic consume με έλεγχο επάρκειας
        await db.query("BEGIN");
        try {
          const r1 = await db.query(`SELECT credits FROM wallets WHERE ${idCol}=$1 FOR UPDATE`, [idParam]);
          let credits = 0;
          if (r1.rowCount === 0) {
            // νέος χρήστης μετά το grant: πιθανό να μην υπάρχει γραμμή—δημιούργησέ την
            await db.query(
              `INSERT INTO wallets (${idCol}, credits, last_grant_month, updated_at)
               VALUES ($1, 0, $2, NOW())
               ON CONFLICT (${idCol}) DO NOTHING`,
              [idParam, nowMonthYYYYMM()]
            );
          } else {
            credits = Number(r1.rows[0].credits);
          }
          if (credits < amount) {
            await db.query("ROLLBACK");
            return { ok: false, error: "insufficient_credits", need: amount, have: credits, status: 402 };
          }
          const r2 = await db.query(
            `UPDATE wallets
                SET credits = credits - $2,
                    updated_at = NOW()
              WHERE ${idCol}=$1
              RETURNING credits`,
            [idParam, amount]
          );
          await db.query("COMMIT");
          return { ok: true, uuid: userId, credits_after: Number(r2.rows[0].credits) };
        } catch (e) {
          await db.query("ROLLBACK");
          throw e;
        }
      }

      // op === "credit" (ή back-compat delta)
      const r = await db.query(
        `INSERT INTO wallets (${idCol}, credits, last_grant_month, updated_at)
         VALUES ($1, GREATEST(0,$2), $3, NOW())
         ON CONFLICT (${idCol})
         DO UPDATE SET
           credits = GREATEST(0, wallets.credits + EXCLUDED.credits),
           updated_at = NOW()
         RETURNING credits`,
        [idParam, amount, nowMonthYYYYMM()]
      );
      return { ok: true, uuid: userId, credits_after: Number(r.rows[0].credits) };
    });

    // Map 402 για consume fail
    if (out && out.status === 402) return res.status(402).json(out);
    return res.status(200).json(out);
  } catch (e) {
    console.error("wallet error", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
