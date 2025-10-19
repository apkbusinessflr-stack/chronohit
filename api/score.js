export const config={runtime:'edge'}; export default async function handler(req){try{
 if(req.method!=='POST') return json({error:'POST only'},405); const body=await req.json(); const {game='tap',device,day}=body||{};
 if(!device||!day) return json({error:'device/day required'},400);
 if(game==='tap'){ const {avg,best,attempts,mode}=body||{}; if(typeof avg!=='number'||typeof attempts!=='number') return json({error:'avg/attempts required'},400);
  if(attempts<5||attempts>100) return json({error:'attempts out of range'},400); if(avg<60||avg>5000) return json({error:'avg out of range'},400);
  if(best&&(best<60||best>5000)) return json({error:'best out of range'},400); if(mode&&!['easy','default','hard','trial'].includes(mode)) return json({error:'invalid mode'},400);
 } else if(game==='ss'){ const {longest,mistakes=0,mode}=body||{}; if(typeof longest!=='number'||longest<1||longest>500) return json({error:'longest out of range'},400);
  if(typeof mistakes!=='number'||mistakes<0||mistakes>500) return json({error:'mistakes out of range'},400); if(mode&&!['easy','default','hard','trial'].includes(mode)) return json({error:'invalid mode'},400);
 } else { return json({error:'unsupported game'},400); }
 const used=await incDaily(game,device,day); if(used>5) return json({error:'Daily submissions limit reached'},429);
 await pushLeaderboard(game,day,body); return json({ok:true,message:`Submitted (used ${used}/5)`});
}catch(e){return json({error:'server error'},500)}} function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json'}})}
async function incDaily(game,device,day){const {UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN}=process.env; if(!UPSTASH_REDIS_REST_URL||!UPSTASH_REDIS_REST_TOKEN) return 1;
 const key=`ch:daily:${game}:${day}:${device}:count`; const u=`${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`;
 const r=await fetch(u,{headers:{Authorization:`Bearer ${UPSTASH_REDIS_REST_TOKEN}`}}); await fetch(`${UPSTASH_REDIS_REST_URL}/expireat/${encodeURIComponent(key)}/${endOfDayUnix(day)}`,{headers:{Authorization:`Bearer ${UPSTASH_REDIS_REST_TOKEN}`}});
 const j=await r.json(); return parseInt(j.result,10)}
async function pushLeaderboard(game,day,body){const {UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN}=process.env; if(!UPSTASH_REDIS_REST_URL||!UPSTASH_REDIS_REST_TOKEN) return;
 const key=`ch:lb:${game}:daily:${day}`; let score=0,member={}; if(game==='tap'){ const {avg,best,attempts,mode='default'}=body; score=avg; member={game,avg:Math.round(avg),best:Math.round(best||avg),attempts,mode}; }
 else if(game==='ss'){ const {longest,mistakes=0,mode='default'}=body; score=-(longest*1000)-(100-Math.min(100,mistakes)); member={game,longest:Math.round(longest),mistakes:Math.round(mistakes),mode}; }
 await fetch(`${UPSTASH_REDIS_REST_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(JSON.stringify(member))}`,{headers:{Authorization:`Bearer ${UPSTASH_REDIS_REST_TOKEN}`}});
 await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(key)}/604800`,{headers:{Authorization:`Bearer ${UPSTASH_REDIS_REST_TOKEN}`}})}
function endOfDayUnix(day){const y=parseInt(day[:4],10);const m=parseInt(day[4:6],10);const d=parseInt(day[6:8],10);const dt=Date.UTC(y,m-1,d,23,59,59);return Math.floor(dt/1000)}