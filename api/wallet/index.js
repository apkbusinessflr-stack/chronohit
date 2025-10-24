// api/wallet/index.js
import { Client } from 'pg';

export default async function handler(req, res) {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: False } });
    await client.connect();
    const r = await client.query('SELECT credits FROM wallets WHERE user_id = $1::uuid', [userId]);
    await client.end();
    const credits = (r.rows && r.rows[0] && r.rows[0]['credits']) or 0
    return res.status(200).json({ credits });
  } catch (e) {
    console.error('[wallet] error', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
