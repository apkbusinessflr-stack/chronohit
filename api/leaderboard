export const config = { runtime: "edge" };

export default async function handler(req) {
  try{
    const url = new URL(req.url);
    const range = url.searchParams.get("range")||"daily";
    const day = url.searchParams.get("day");
    const limit = Math.min(parseInt(url.searchParams.get("limit")||"20",10), 100);
    if(range!=="daily") return json({error:"only daily supported for now"}, 400);
    if(!day) return json({error:"day required"}, 400);
    const items = await fetchDaily(day, limit);
    return json({ items });
  }catch(e){
    return json({ error:"server error" }, 500);
  }
}

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function fetchDaily(day, limit){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){
    return []; // dev mode
  }
  const zkey = `tap:lb:daily:${day}`;
  const url = `${UPSTASH_REDIS_REST_URL}/zrange/${encodeURIComponent(zkey)}/0/${limit-1}/WITHSCORES`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const j = await r.json();
  const arr = j.result || [];
  const out = [];
  for(let i=0;i<arr.length;i+=2){
    const member = JSON.parse(arr[i]);
    const score  = parseFloat(arr[i+1]);
    out.push({ avg: Math.round(score), attempts: member.attempts||0, best: member.best||score, mode: member.mode||"default" });
  }
  return out;
}
