export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const game = String(url.searchParams.get("game") || "tap").toLowerCase();
    const range = String(url.searchParams.get("range") || "weekly").toLowerCase(); // default = weekly
    const week = url.searchParams.get("week");     // YYYYWW (ISO week)
    const month = url.searchParams.get("month");   // YYYYMM
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    if (range === "weekly") {
      if (!week || !/^\d{6}$/.test(week)) return json({ error: "week must be YYYYWW (ISO)" }, 400);
      const items = await fetchAgg(game, `lb:${game}:weekly:${week}`, limit);
      return json({ items });
    }

    if (range === "monthly") {
      if (!month || !/^\d{6}$/.test(month)) return json({ error: "month must be YYYYMM" }, 400);
      const items = await fetchAgg(game, `lb:${game}:monthly:${month}`, limit);
      return json({ items });
    }

    return json({ error: "unsupported range" }, 400);
  } catch {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function env() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  return { url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN };
}

/**
 * Διαβάζει ZSET aggregates:
 * - Για **tap**: κρατάμε MIN(avg) → ταξινομούμε **ASC** (ZRANGE WITHSCORES)
 * - Για **άλλα παιχνίδια**: SUM(score) → ταξινομούμε **DESC** (ZREVRANGE WITHSCORES)
 */
async function fetchAgg(game, zkey, limit) {
  const { url, token } = env();
  if (!url || !token) return [];

  const isTap = game === "tap";
  const method = isTap ? "zrange" : "zrevrange";
  const endpoint = `${url}/${method}/${encodeURIComponent(zkey)}/0/${limit - 1}/WITHSCORES`;

  const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  const arr = j?.result || [];

  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    const device = arr[i];
    const val = parseFloat(arr[i + 1]);
    if (isTap) {
      out.push({ device, avg: Math.round(val) });      // μικρότερο καλύτερο
    } else {
      out.push({ device, score: Math.round(val) });    // μεγαλύτερο καλύτερο
    }
  }
  return out;
}
