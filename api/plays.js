// api/plays.js
// Edge: Διαβάζει counters από Upstash: total/weekly/monthly
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const game   = url.searchParams.get("game") || "";
  const device = url.searchParams.get("device") || "";
  const week   = url.searchParams.get("week") || "";   // optional
  const month  = url.searchParams.get("month") || "";  // optional

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return new Response(JSON.stringify({ ok:false, error:"missing_upstash_env" }), { status:500 });
  }
  if (!game || !device) {
    return new Response(JSON.stringify({ ok:false, error:"missing_params" }), { status:400 });
  }
  const auth = { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } };

  async function get(key){
    const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, auth).then(r=>r.json()).catch(()=>null);
    const v = r && (r.result ?? r.value);
    return Number.isFinite(+v) ? +v : 0;
    }

  const total = await get(`plays:${game}:total:${device}`);
  const weekly = week ? await get(`plays:${game}:weekly:${device}:${week}`) : 0;
  const monthly = month ? await get(`plays:${game}:monthly:${device}:${month}`) : 0;

  return new Response(JSON.stringify({ ok:true, game, device, total, weekly, monthly }), { status:200 });
}
