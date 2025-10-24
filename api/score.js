export const config = { runtime: "edge" };

export default async function handler(req) {
  try{
    if (req.method !== "POST") return json({error:"POST only"}, 405);
    const body = await req.json();
    const game = (body?.game || "tap").toLowerCase();
    const device = body?.device;
    const day = body?.day;
    if(!device || !day) return json({error:"device/day required"}, 400);
    const DAILY_LIMIT = 5;

    if (game === "tap") {
      const { avg, best, attempts, mode } = body || {};
      if(typeof avg!=="number" || typeof attempts!=="number") return json({error:"avg/attempts required"}, 400);
      if(attempts<5 || attempts>100) return json({error:"attempts out of range"}, 400);
      if(avg<60 || avg>5000) return json({error:"avg out of range"}, 400);
      if(best && (best<60 || best>5000)) return json({error:"best out of range"}, 400);
      if(mode && !["easy","default","hard","trial"].includes(mode)) return json({error:"invalid mode"}, 400);
      const used = await incDaily(game, device, day);
      if(used>DAILY_LIMIT) return json({error:"Daily submissions limit reached"}, 429);
      await pushLeaderboardTap(day, { avg, attempts, best: best||avg, mode: mode||"default" });
      return json({ ok:true, message:`Submitted (used ${used}/${DAILY_LIMIT})` });
    }

    if (game === "sb") { // Stroop Blitz
      const { score, correct, wrong, streakMax, accuracy, mode } = body || {};
      if (typeof score !== "number") return json({error:"score required"}, 400);
      if (score < -1000 || score > 10000) return json({error:"score out of range"}, 400);
      if (accuracy != null && (accuracy < 0 || accuracy > 100)) return json({error:"accuracy out of range"}, 400);
      if (mode && !["easy","default","hard","trial"].includes(mode)) return json({error:"invalid mode"}, 400);
      const used = await incDaily(game, device, day);
      if(used>DAILY_LIMIT) return json({error:"Daily submissions limit reached"}, 429);
      await pushLeaderboardSB(day, { score:Math.round(score), correct:correct|0, wrong:wrong|0, streakMax:streakMax|0, accuracy:accuracy|0, mode:mode||"default" });
      return json({ ok:true, message:`Submitted (used ${used}/${DAILY_LIMIT})` });
    }

    return json({ ok:true, message:"Unhandled game type (no-op)" });
  }catch(e){
    return json({ error:"server error" }, 500);
  }
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
async function incDaily(game, device, day){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){
    return 1; // dev mode
  }
  const key = `${game}:daily:${day}:${device}:count`;
  const url = `${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const j = await r.json();
  const ttlKey = `${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(key)}/${endOfDayUnix(day)}`;
  await fetch(ttlKey, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  return parseInt(j.result,10);
}
async function pushLeaderboardTap(day, item){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){ return; }
  const zkey = `lb:tap:daily:${day}`;
  const member = JSON.stringify({ avg:item.avg, best:item.best, attempts:item.attempts, mode:item.mode });
  const url = `${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${item.avg}/${encodeURIComponent(member)}`;
  await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(zkey)}/604800`, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
}
async function pushLeaderboardSB(day, item){
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN){ return; }
  const zkey = `lb:sb:daily:${day}`;
  const member = JSON.stringify(item);
  const zscore = -item.score; // store negative so higher scores rank first with zrange asc
  const url = `${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(zkey)}/${zscore}/${encodeURIComponent(member)}`;
  await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(zkey)}/604800`, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
}
function endOfDayUnix(day){
  const y = parseInt(day.slice(0,4),10);
  const m = parseInt(day.slice(4,6),10);
  const d = parseInt(day.slice(6,8),10);
  const dt = Date.UTC(y, m-1, d, 23,59,59);
  return Math.floor(dt/1000);
}
