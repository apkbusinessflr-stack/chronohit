// /api/leaderboard.js  (Node serverless)
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const range = url.searchParams.get('range') || 'daily';
    const day = url.searchParams.get('day');
    const game = url.searchParams.get('game') || 'tap';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    if (range !== 'daily') return res.status(400).json({ error: 'only daily supported' });
    if (!day) return res.status(400).json({ error: 'day required' });

    const items = await fetchDaily(day, game, limit);
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}

async function fetchDaily(day, game, limit) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return [];
  const zkey = `lb:${game}:daily:${day}`;
  const url = `${UPSTASH_REDIS_REST_URL}/zrevrange/${encodeURIComponent(zkey)}/0/${limit - 1}/WITHSCORES`; // high→low
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const j = await r.json();
  const arr = j.result || [];
  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    const member = JSON.parse(arr[i]);
    const score = parseFloat(arr[i + 1]);
    if (game === 'tap') out.push({ avg: Math.round(score), attempts: member.attempts || 0, best: member.best || score, mode: member.mode || 'default' });
    if (game === 'ss') out.push({ longest: Math.round(score), mistakes: member.mistakes || 0, mode: member.mode || 'default' });
    if (game === 'tr') out.push({ score: Math.round(score), misses: member.misses || 0, mode: member.mode || 'default' });
  }
  return out;
}
