export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const body = await req.json().catch(() => ({}));
    const game = String(body?.game || "tap").toLowerCase();
    const device = body?.device;
    const day = body?.day; // YYYYMMDD (UTC)
    if (!device || !day) return json({ error: "device/day required" }, 400);

    const DAILY_LIMIT = 5;

    if (game === "tap") {
      const { avg, best, attempts, mode = "default" } = body || {};
      if (typeof avg !== "number" || typeof attempts !== "number")
        return json({ error: "avg/attempts required" }, 400);
      if (attempts < 5 || attempts > 100) return json({ error: "attempts out of range" }, 400);
      if (avg < 60 || avg > 2000) return json({ error: "avg out of range" }, 400); // anti-cheat guard

      const used = await incrDailyCounter("tap", device, day);
      if (used > DAILY_LIMIT) return json({ error: "daily limit reached" }, 429);

      await zaddTap(day, { avg, best: typeof best === "number" ? best : avg, attempts, mode });
      return json({ ok: true, used });
    }

    if (game === "sb") {
      const { score, correct = 0, wrong = 0, accuracy = 0, streakMax = 0, mode = "default" } = body || {};
      if (typeof score !== "number") return json({ error: "score required" }, 400);
      const used = await incrDailyCounter("sb", device, day);
      if (used > DAILY_LIMIT) return json({ error: "daily limit reached" }, 429);
      await zaddSB(day, { score, correct, wrong, accuracy, streakMax, mode });
      return json({ ok: true, used });
    }

    return json({ error: "unsupported game" }, 400);
  } catch (e) {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function incrDailyCounter(game, device, day) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return 1; // dev mode
  const key = `${game}:daily:${day}:${device}:count`;
  // INCR
  await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  // Expire at day end (UTC)
  await fetch(`${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(key)}/${endOfDayUnix(day)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const j = await r.json().catch(() => ({}));
  return j?.result ? parseInt(j.result, 10) : 1;
}

async function zaddTap(day, item) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  const zkey = `lb:tap:daily:${day}`;
  const member = JSON.stringify(item);
  const zscore = Math.round(item.avg); // lower is better; we will use ZRANGE ASC
  await fetch(`${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${zscore}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  await fetch(`${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(zkey)}/${endOfDayUnix(day)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
}

async function zaddSB(day, item) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  const zkey = `lb:sb:daily:${day}`;
  const member = JSON.stringify(item);
  const zscore = -Math.round(item.score); // higher score should rank first → store negative
  await fetch(`${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${zscore}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  await fetch(`${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(zkey)}/${endOfDayUnix(day)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
}

function endOfDayUnix(day) {
  const y = parseInt(day.slice(0, 4), 10);
  const m = parseInt(day.slice(4, 6), 10);
  const d = parseInt(day.slice(6, 8), 10);
  const dt = Date.UTC(y, m - 1, d, 23, 59, 59);
  return Math.floor(dt / 1000);
}
