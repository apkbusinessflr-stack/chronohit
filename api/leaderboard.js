export const config = { runtime: "edge" };

/**
 * Read leaderboard aggregates for ANY game & mode.
 * Query:
 *   - game = string (e.g., "sb", "tap", "target", ...)
 *   - range = "weekly" | "monthly"
 *   - week  = "YYYYWW" (ISO; required when range=weekly)
 *   - month = "YYYYMM" (required when range=monthly)
 *   - mode  = "easy" | "default" | "hard" | ... (required)
 *
 * Ordering:
 *   - tap  → MIN(avg) per device (ASC)
 *   - else → SUM(score) per device (DESC)
 */
export default async function handler(req) {
  try {
    const url  = new URL(req.url);
    const game = String(url.searchParams.get("game") || "").toLowerCase();
    const range= String(url.searchParams.get("range") || "weekly").toLowerCase();
    const week = url.searchParams.get("week");
    const month= url.searchParams.get("month");
    const mode = String(url.searchParams.get("mode") || "").toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    if (!game) return json({ error: "game required" }, 400);
    if (!mode) return json({ error: "mode required" }, 400);

    if (range === "weekly") {
      if (!week || !/^\d{6}$/.test(week)) return json({ error: "week must be YYYYWW" }, 400);
      const items = await fetchAgg(game, `lb:${game}:${mode}:weekly:${week}`, limit);
      return json({ items });
    }
    if (range === "monthly") {
      if (!month || !/^\d{6}$/.test(month)) return json({ error: "month must be YYYYMM" }, 400);
      const items = await fetchAgg(game, `lb:${game}:${mode}:monthly:${month}`, limit);
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
 * tap = MIN(avg) → ASC (ZRANGE)
 * others = SUM(score) → DESC (ZREVRANGE)
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
    if (isTap) out.push({ device, avg: Math.round(val) });
    else       out.push({ device, score: Math.round(val) });
  }
  return out;
}
