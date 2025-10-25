const { Client } = require('pg');

module.exports = async (req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(500).json({ ok:false, error: 'Missing DATABASE_URL' });
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query('SELECT 1 as n');
    res.status(200).json({ ok: true, result: r.rows[0].n });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  } finally {
    try { await client.end(); } catch(_) {}
  }
};
