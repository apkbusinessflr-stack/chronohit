// Returns how many daily submissions a device has used for a given day
// ENV (optional for persistence):
//  - UPSTASH_REDIS_REST_URL
//  - UPSTASH_REDIS_REST_TOKEN

export default async function handler(req, res) {
  try{
    const url = new URL(req.url, `http://${req.headers.host}`);
    const device = url.searchParams.get("device");
    const day = url.searchParams.get("day");
    if(!device || !day) return res.status(400).json({error:"device and day required"});
    const used = await getDailyUsed(device, day);
    return res.json({ used });
  }catch(e){
    return res.status(500).json({ error: "server error" });
  }
}

async function getDailyUsed(device, day){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){
    return 0; // dev mode: no persistence
  }
  const key = `tap:daily:${day}:${device}:count`;
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  const j = await r.json();
  const v = j.result;
  return v ? parseInt(v,10) : 0;
}
