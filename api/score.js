// /api/score.js  (Node serverless)

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const body = (req.body && typeof req.body === 'object') ? req.body : JSON.parse(req.body || '{}');
    const { device, day, avg = 0, best, attempts = 0, mode = 'default', game } = body || {};
    if (!device || !day) return res.status(400).json({ error: 'device/day required' });

    // Namespace
    const g = game === 'ss' ? 'ss' : game === 'tr' ? 'tr' : 'tap';

    // Validation per game
    if (g === 'tap') {
      if (typeof avg !== 'number' || typeof attempts !== 'number') return res.status(400).json({ error: 'avg/attempts required' });
      if (attempts < 5 || attempts > 100) return res.status(400).json({ error: 'attempts out of range' });
      if (avg < 60 || avg > 5000) return res.status(400).json({ error: 'avg out of range' });
      if (best && (best < 60 || best > 5000)) return res.status(400).json({ error: 'best out of range' });
      if (mode && !['easy','default','hard','trial'].includes(mode)) return res.status(400).json({ error: 'invalid mode' });
    }
    if (g === 'ss') {
      // best = longest streak, attempts = mistakes (0..n)
      if (typeof best !== 'number' || best < 1 || best > 999) return res.status(400).json({ error: 'longest out of range' });
    }
    if (g === 'tr') {
      // best = total hits (higher better), attempts = penalties/misses (>=0)
      if (typeof best !== 'number' || best < 0 || best > 10000) return res.status(400).json({ error: 'score out of range' });
    }

    const used = await incDaily(device, day, g);
    if (used > 5) return res.status(429).json({ error: 'Daily submissions limit reached' });

    await pushLeaderboard(day, g, { avg, best: best ?? avg, attempts, mode });

    return res.status(200).json({ ok: true, message: `Submitted (used ${used}/5)` });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}

async function incDaily(device, day, g) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return 1; // dev mode
  const key = `daily:${g}:${day}:${device}:count`;
  const url = `${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const j = await r.json();
  const ttlUrl = `${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(key)}/${endOfDayUnix(day)}`;
  await fetch(ttlUrl, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  return parseInt(j.result, 10);
}

async function pushLeaderboard(day, g, item) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;

  if (g === 'tap') {
    const zkey = `lb:${g}:daily:${day}`;
    const member = JSON.stringify({ avg: item.avg, best: item.best, attempts: item.attempts, mode: item.mode });
    const url = `${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${item.avg}/${encodeURIComponent(member)}`;
    await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
    await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(zkey)}/604800`, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  }

  if (g === 'ss' || g === 'tr') {
    // Higher is better → score = best
    const zkey = `lb:${g}:daily:${day}`;
    const payload = g === 'ss'
      ? { longest: item.best, mistakes: item.attempts, mode: item.mode }
      : { score: item.best, misses: item.attempts, mode: item.mode };
    const member = JSON.stringify(payload);
    const url = `${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${item.best}/${encodeURIComponent(member)}`;
    await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
    await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(zkey)}/604800`, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  }
}

function endOfDayUnix(yyyymmdd) {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const dt = Date.UTC(y, m - 1, d, 23, 59, 59);
  return Math.floor(dt / 1000);
}
