// api/score.js
// Edge: γράφει σκορ/leaderboards στο Upstash,
// αλλά πρώτα χρεώνει credits μέσω /api/wallet (Node).
export const config = { runtime: "edge" };

const COST_PER_PLAY = { // credits per round
  sb: 1, // Stroop Blitz
  tt: 1, // Tapping Test (παράδειγμα)
  ct: 1, // Chasing Target (παράδειγμα)
  default: 1
};

function weekOf(yyyymmdd) {
  // ISO week: YYYYWW
  const s = String(yyyymmdd);
  const y = +s.slice(0,4), m = +s.slice(4,6)-1, d = +s.slice(6,8);
  const dt = new Date(Date.UTC(y,m,d));
  const day = (dt.getUTCDay() + 6) % 7; // 0=Mon
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(),0,4));
  const wk = 1 + Math.round((dt - firstThu)/(7*24*3600*1000));
  return dt.getUTCFullYear()*100 + wk;
}
function monthOf(yyyymmdd){ return Math.floor(+yyyymmdd/100); }
function kv(obj){ return Object.entries(obj).map(([k,v])=>`${encodeURIComponent(k)}/${encodeURIComponent(String(v))}`).join('/'); }

export default async function handler(req) {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok:false, error:"Method not allowed" }), { status:405 });
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return new Response(JSON.stringify({ ok:false, error:"missing_upstash_env" }), { status:500 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch { /* ignore */ }

  const game   = String(body.game||"").trim();         // π.χ. "sb"
  const device = String(body.device||"").trim();
  const day    = String(body.day||"").trim();          // YYYYMMDD
  const mode   = String(body.mode||"").trim();         // easy/default/hard
  const score  = Number(body.score||0);

  if (!game || !device || !day || !mode || !Number.isFinite(score)) {
    return new Response(JSON.stringify({ ok:false, error:"invalid_payload" }), { status:400 });
  }

  // 1) Χρέωση credits ΠΡΙΝ γράψουμε σκορ (αν αποτύχει -> 402)
  try {
    const consume = COST_PER_PLAY[game] ?? COST_PER_PLAY.default;
    const walletResp = await fetch(`${new URL(req.url).origin}/api/wallet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op:"consume", amount: consume, uuid: device })
    });
    if (walletResp.status === 402) {
      const j = await walletResp.json().catch(()=>null);
      return new Response(JSON.stringify({ ok:false, error:"insufficient_credits", ...(j||{}) }), { status:402 });
    }
    if (!walletResp.ok) {
      // προσωρινό πρόβλημα wallet -> μην κάψουμε τη γύρα, καλύτερα 503
      return new Response(JSON.stringify({ ok:false, error:"wallet_unavailable" }), { status:503 });
    }
  } catch {
    return new Response(JSON.stringify({ ok:false, error:"wallet_unavailable" }), { status:503 });
  }

  // 2) Γράψε leaderboards & plays counters
  const week = weekOf(day), month = monthOf(day);
  const auth = { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } };

  // Keys
  const kWeekly   = `lb:${game}:${mode}:weekly:${week}`;
  const kMonthly  = `lb:${game}:${mode}:monthly:${month}`;
  const kPlaysTot = `plays:${game}:total:${device}`;
  const kPlaysW   = `plays:${game}:weekly:${device}:${week}`;
  const kPlaysM   = `plays:${game}:monthly:${device}:${month}`;

  // Write helper
  async function upstash(path){ return fetch(`${UPSTASH_REDIS_REST_URL}/${path}`, auth); }

  // Σωρευτικό score (για sb ct κ.λπ.) — για tap test ίσως MIN(avg), αλλά εδώ κρατάμε SUM
  await Promise.all([
    upstash(`zincrby/${encodeURIComponent(kWeekly)}/${encodeURIComponent(String(score))}/${encodeURIComponent(device)}`),
    upstash(`zincrby/${encodeURIComponent(kMonthly)}/${encodeURIComponent(String(score))}/${encodeURIComponent(device)}`),
    upstash(`incr/${encodeURIComponent(kPlaysTot)}`),
    upstash(`incr/${encodeURIComponent(kPlaysW)}`),
    upstash(`incr/${encodeURIComponent(kPlaysM)}`)
  ]);

  return new Response(JSON.stringify({ ok:true }), { status:200, headers: { "content-type":"application/json" }});
}
