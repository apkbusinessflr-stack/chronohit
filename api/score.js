export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const body = await req.json().catch(() => ({}));

    const game = String(body?.game || "").toLowerCase();
    const device = body?.device;
    const day = body?.day; // YYYYMMDD (UTC) — απαιτείται για να βγάλουμε week/month
    if (!game || !device || !day) return json({ error: "game/device/day required" }, 400);

    // (Προαιρετικό) rate limit per day per device για submit ασφάλεια
    const used = await incrDailyCounter(game, device, day);
    const DAILY_LIMIT = 5;
    if (used > DAILY_LIMIT) return json({ error: "daily limit reached" }, 429);

    const { isoYear, isoWeek } = isoWeekOf(parseDay(day));
    const weekKey = `${isoYear}${pad2(isoWeek)}`;     // YYYYWW
    const monthKey = yyyymm(parseDay(day));           // YYYYMM

    if (game === "tap") {
      // Περιμένουμε: avg (μικρότερο = καλύτερο). Επιλέγουμε MIN ανά συσκευή.
      const avg = Number(body?.avg);
      if (!Number.isFinite(avg)) return json({ error: "avg required for tap" }, 400);

      await zmin(`lb:${game}:weekly:${weekKey}`, device, Math.round(avg));
      await zmin(`lb:${game}:monthly:${monthKey}`, device, Math.round(avg));
      return json({ ok: true, used });
    }

    // Default κανόνας για ΟΛΑ τα υπόλοιπα games (π.χ. sb, target, sequence, κ.λπ.):
    // Περιμένουμε: score (μεγαλύτερο = καλύτερο). Κάνουμε SUM ανά συσκευή.
    const score = Number(body?.score);
    if (!Number.isFinite(score)) return json({ error: "score required" }, 400);

    await zincr(`lb:${game}:weekly:${weekKey}`, device, Math.round(score));
    await zincr(`lb:${game}:monthly:${monthKey}`, device, Math.round(score));
    return json({ ok: true, used });
  } catch {
    return json({ error: "server error" }, 500);
  }
}

/* ----------------------- Helpers ----------------------- */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function env() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  return { url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN };
}

// Daily submit counter (μόνο για limit, ΔΕΝ αποθηκεύουμε daily leaderboard)
async function incrDailyCounter(game, device, day) {
  const { url, token } = env();
  if (!url || !token) return 1; // dev fallback
  const key = `${game}:daily:${day}:${device}:count`;

  await fetch(`${url}/incr/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
  await fetch(`${url}/expireat/${encodeURIComponent(key)}/${endOfDayUnix(day)}`, { headers: { Authorization: `Bearer ${token}` } });

  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return j?.result ? parseInt(j.result, 10) : 1;
}

// Aggregations
async function zincr(zkey, member, byScore) {
  const { url, token } = env();
  if (!url || !token) return;
  await fetch(`${url}/zincrby/${encodeURIComponent(zkey)}/${encodeURIComponent(byScore)}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // κράτα ~90 μέρες
  await fetch(`${url}/expire/${encodeURIComponent(zkey)}/7776000`, { headers: { Authorization: `Bearer ${token}` } });
}
async function zmin(zkey, member, maybeLowerScore) {
  const { url, token } = env();
  if (!url || !token) return;
  // διάβασε τρέχον
  let current = null;
  const r = await fetch(`${url}/zscore/${encodeURIComponent(zkey)}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  if (j?.result !== null && j?.result !== undefined) current = parseFloat(j.result);
  const scoreToKeep = current === null ? maybeLowerScore : Math.min(current, maybeLowerScore);

  await fetch(`${url}/zadd/${encodeURIComponent(zkey)}/${scoreToKeep}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await fetch(`${url}/expire/${encodeURIComponent(zkey)}/7776000`, { headers: { Authorization: `Bearer ${token}` } });
}

// Time helpers
function endOfDayUnix(day) {
  const { y, m, d } = parseDay(day);
  const dt = Date.UTC(y, m - 1, d, 23, 59, 59);
  return Math.floor(dt / 1000);
}
function parseDay(day) {
  const y = parseInt(day.slice(0, 4), 10);
  const m = parseInt(day.slice(4, 6), 10);
  const d = parseInt(day.slice(6, 8), 10);
  return { y, m, d };
}
function isoWeekOf({ y, m, d }) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const isoYear = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(((dt - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { isoYear, isoWeek: week };
}
function yyyymm({ y, m }) { return `${y}${pad2(m)}`; }
function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
