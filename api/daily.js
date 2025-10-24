// /api/daily.js
export default async function handler(req, res) {
  try{
    const url = new URL(req.url, `http://${req.headers.host}`);
    const device = url.searchParams.get("device");
    const day = url.searchParams.get("day");
    const game = (url.searchParams.get("game") || "tap").toLowerCase();
    if(!device || !day) return res.status(400).json({error:"device and day required"});
    const used = await getDailyUsed(game, device, day);
    return res.json({ used });
  }catch(e){
    return res.status(500).json({ error: "server error" });
  }
}
async function getDailyUsed(game, device, day){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){
    return 0; // dev mode
  }
  const key = `${game}:daily:${day}:${device}:count`;
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  const j = await r.json();
  const v = j.result;
  return v ? parseInt(v,10) : 0;
}
