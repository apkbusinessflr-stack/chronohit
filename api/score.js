export const config = { runtime: "edge" };

/**
 * Submit score for ANY game.
 * Policy:
 * - Play-count limit: max 3 submits / day / device / game (ανεξάρτητα mode).
 * - Aggregation:
 *    - game === "tap": κρατάμε BEST (MIN avg) ανά device+mode για weekly/monthly.
 *    - όλα τα άλλα games: SUM(score) ανά device+mode για weekly/monthly.
 * - Αποθήκευση μόνο weekly/monthly (όχι daily leaderboards).
 * - Απαιτούμε: { game, device, day(YYYYMMDD), mode, ...scoreFields }
 */
export default async function handler(req) {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const body = await req.json().catch(() => ({}));

    const game   = String(body?.game || "").toLowerCase();
    const device = String(body?.device || "");
    const day    = String(body?.day || "");           // YYYYMMDD UTC
    const mode   = String(body?.mode || "default");   // capture per difficulty

    if (!game || !device || !/^\d{8}$/.test(day)) {
      return json({ error: "game/device/day required" }, 400);
    }

    // --- Daily play-count limit: 3 per game/day/device (independent of mode)
    const DAILY_LIMIT = 3;
    const used = await incrDailyCounter(game, device, day);
    if (used > DAILY_LIMIT) return json({ error: "daily limit reached", used }, 429);

    const { isoYear, isoWeek } = isoWeekOf(parseDay(day));
    const weekKey  = `${isoYear}${pad2(isoWeek)}`; // YYYYWW
    const monthKey = yyyymm(parseDay(day));        // YYYYMM

    if (game === "tap") {
      const avg = Number(body?.avg);
      if (!Number.isFinite(avg)) return json({ error: "avg required for tap" }, 400);

      await zmin(`lb:${game}:${mode}:weekly:${weekKey}`,  device, Math.round(avg));
      await zmin(`lb:${game}:${mode}:monthly:${monthKey}`, device, Math.round(avg));
      return json({ ok: true, used });
    }

    // Default rule for ALL other games: SUM(score) per device+mode
    const score = Number(body?.score);
    if (!Number.isFinite(score)) return json({ error: "score required" }, 400);

    await zincr(`lb:${game}:${mode}:weekly:${weekKey}`,  device, Math.round(score));
    await zincr(`lb:${game}:${mode}:monthly:${monthKey}`, device, Math.round(score));
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

// Daily submit counter (μόνο για limit — όχι daily leaderboard)
async function incrDailyCounter(game, device, day) {
  const { url, token } = env();
  if (!url || !token) return 1; // dev fallback
  const key = `plays:${game}:${day}:${device}`;

  // INCR (θα επιστρέψει 1..N) + expire στο τέλος της ημέρας (UTC)
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
