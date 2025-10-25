export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const device = url.searchParams.get("device");
    const day = url.searchParams.get("day");
    const game = String(url.searchParams.get("game") || "tap").toLowerCase();
    if (!device || !day) return json({ error: "device and day required" }, 400);
    const used = await getDailyUsed(game, device, day);
    return json({ used });
  } catch {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function getDailyUsed(game, device, day) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return 0;
  const key = `${game}:daily:${day}:${device}:count`;
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const j = await r.json().catch(() => ({}));
  const v = j?.result;
  return v ? parseInt(v, 10) : 0;
}
