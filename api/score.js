// /api/score.js
export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { device, day, avg, best, attempts, mode } = body || {};
    const _mode = (mode || "default").trim();

    // Basic validation
    if (!device || !day) return json({ error: "device/day required" }, 400);
    if (!/^\d{8}$/.test(String(day))) return json({ error: "day must be YYYYMMDD" }, 400);
    if (String(device).length > 128) return json({ error: "device too long" }, 400);

    if (typeof avg !== "number" || typeof attempts !== "number") {
      return json({ error: "avg/attempts required" }, 400);
    }
    if (attempts < 5 || attempts > 100) return json({ error: "attempts out of range" }, 400);
    if (avg < 60 || avg > 5000) return json({ error: "avg out of range" }, 400);
    if (best && (typeof best !== "number" || best < 60 || best > 5000)) {
      return json({ error: "best out of range" }, 400);
    }

    // Μη δέχεσαι Trial (endless) submissions
    const allowedModes = ["easy", "default", "hard"];
    if (!allowedModes.includes(_mode)) {
      return json({ error: "invalid mode" }, 400);
    }

    // Daily submissions counter (+ TTL μέχρι τέλος ημέρας UTC)
    const used = await incDaily(device, String(day));
    if (used > 5) {
      return json({ error: "Daily submissions limit reached" }, 429);
    }

    // Leaderboard push (score = avg, lower is better)
    await pushLeaderboard(String(day), {
      avg: Math.round(avg),
      best: Math.round(best || avg),
      attempts: Math.round(attempts),
      mode: _mode,
    });

    return json({ ok: true, message: `Submitted (used ${used}/5)` });
  } catch (e) {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function incDaily(device, day) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

  // Dev/preview: χωρίς persistence → αντιμετώπισε σαν 1η υποβολή
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return 1;

  const key = `tap:daily:${day}:${device}:count`;

  try {
    // INCR
    const r = await fetch(
      `${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } }
    );
    const j = await r.json().catch(() => ({}));
    const used = parseInt(j?.result, 10) || 1;

    // TTL μέχρι το τέλος της ημέρας (UTC)
    const expUrl = `${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(
      key
    )}/${endOfDayUnix(day)}`;
    // fire & forget (δεν μας νοιάζει αν αποτύχει)
    fetch(expUrl, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } }).catch(() => {});

    return used;
  } catch {
    // Σε λάθος δικτύου, μην σπας UX — θεώρησε 1
    return 1;
  }
}

async function pushLeaderboard(day, item) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;

  const zkey = `tap:lb:daily:${day}`;
  // Μικρή ασφάλεια μήκους payload
  const payload = JSON.stringify({
    avg: item.avg,
    best: item.best,
    attempts: item.attempts,
    mode: item.mode,
  }).slice(0, 256);

  try {
    // ZADD (score = avg)
    const zaddUrl = `${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${item.avg}/${encodeURIComponent(
      payload
    )}`;
    await fetch(zaddUrl, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });

    // EXPIRE 7 days (604800s)
    const ttlUrl = `${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(zkey)}/604800`;
    await fetch(ttlUrl, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  } catch {
    // ignore — καλύτερα να χαθεί 1 entry παρά να χαλάσει η ροή
  }
}

function endOfDayUnix(day) {
  const y = parseInt(day.slice(0, 4), 10);
  const m = parseInt(day.slice(4, 6), 10);
  const d = parseInt(day.slice(6, 8), 10);
  const dt = Date.UTC(y, m - 1, d, 23, 59, 59);
  return Math.floor(dt / 1000);
}
