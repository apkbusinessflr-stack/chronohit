// /api/wallet/index.js
// GET /api/wallet?user_id=UUID  -> { credits: number }
// Απαιτεί: DATABASE_URL (Neon pooled, sslmode=require)

import { Client } from "pg";

export default async function handler(req, res) {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: "user_id required" });

    // Προαιρετικός έλεγχος ότι είναι UUID (αν χρησιμοποιείς πραγματικά UUIDs)
    // Αν περνάς deviceId/τυχαίο string, βγάλε αυτόν τον έλεγχο και το ::uuid στο query.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return res.status(400).json({ error: "user_id must be UUID" });

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    const r = await client.query(
      "SELECT credits FROM wallets WHERE user_id = $1::uuid",
      [userId]
    );
    await client.end();

    const credits = (r.rows && r.rows[0] && r.rows[0].credits) || 0;
    return res.status(200).json({ credits });
  } catch (e) {
    console.error("[wallet] error", e);
    return res.status(500).json({ error: "internal error" });
  }
}
