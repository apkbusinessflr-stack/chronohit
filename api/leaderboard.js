export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const game = String(url.searchParams.get("game") || "tap").toLowerCase();
    const range = url.searchParams.get("range") || "daily";
    const day = url.searchParams.get("day");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
    if (range !== "daily") return json({ error: "only daily supported for now" }, 400);
    if (!day) return json({ error: "day required" }, 400);

    const items = await fetchDaily(game, day, limit);
    return json({ items });
  } catch {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function fetchDaily(game, day, limit) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return [];

  const zkey = `lb:${game}:daily:${day}`;
  const url = `${UPSTASH_REDIS_REST_URL}/zrange/${encodeURIComponent(zkey)}/0/${limit - 1}/WITHSCORES`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const j = await r.json().catch(() => ({}));
  const arr = j?.result || [];
  const out = [];

  for (let i = 0; i < arr.length; i += 2) {
    const member = safeJSON(arr[i]);
    const zscore = parseFloat(arr[i + 1]);

    if (game === "tap") {
      out.push({
        avg: Math.round(zscore),
        attempts: member?.attempts ?? 0,
        best: member?.best ?? Math.round(zscore),
        mode: member?.mode || "default",
      });
    } else if (game === "sb") {
      out.push({
        score: Math.round(-zscore),
        correct: member?.correct ?? 0,
        wrong: member?.wrong ?? 0,
        accuracy: member?.accuracy ?? 0,
        streakMax: member?.streakMax ?? 0,
        mode: member?.mode || "default",
      });
    } else {
      out.push({ score: zscore, ...member });
    }
  }
  return out;
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }
