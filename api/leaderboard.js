export const config={runtime:'edge'}; export default async function handler(req){try{
 const url=new URL(req.url); const game=(url.searchParams.get('game')||'tap').toLowerCase(); const range=url.searchParams.get('range')||'daily'; const day=url.searchParams.get('day'); const limit=Math.min(parseInt(url.searchParams.get('limit')||'20',10),100);
 if(range!=='daily') return json({error:'only daily supported for now'},400); if(!day) return json({error:'day required'},400); const items=await fetchDaily(game,day,limit); return json({items});
}catch(e){return json({error:'server error'},500)}} function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json'}})}
async function fetchDaily(game,day,limit){const {UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN}=process.env; if(!UPSTASH_REDIS_REST_URL||!UPSTASH_REDIS_REST_TOKEN) return [];
 const key=`ch:lb:${game}:daily:${day}`; const r=await fetch(`${UPSTASH_REDIS_REST_URL}/zrange/${encodeURIComponent(key)}/0/${limit-1}/WITHSCORES`,{headers:{Authorization:`Bearer ${UPSTASH_REDIS_REST_TOKEN}`}});
 const j=await r.json(); const arr=j.result||[]; const out=[]; for(let i=0;i<arr.length;i+=2){ const member=JSON.parse(arr[i]); const score=parseFloat(arr[i+1]);
  if(game==='tap'){ out.push({avg:Math.round(member.avg||score),attempts:member.attempts||0,best:member.best||member.avg,mode:member.mode||'default'}); }
  else if(game==='ss'){ out.push({longest:member.longest||0,mistakes:member.mistakes||0,mode:member.mode||'default'}); }
  else { out.push(member); } } return out }