// /api/leaderboard.js
export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "GET") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "daily").trim();
    const day   = (url.searchParams.get("day") || "").trim();

    // Μόνο daily προς το παρόν
    if (range !== "daily") return json({ error: "only daily supported for now" }, 400);

    // YYYYMMDD validation
    if (!/^\d{8}$/.test(day)) return json({ error: "day must be YYYYMMDD" }, 400);

    // limit: προεπιλογή 20, ελάχιστο 1, μέγιστο 100
    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

    const items = await fetchDaily(day, limit);
    return json({ items }, 200);
  } catch {
    return json({ error: "server error" }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fetchDaily(day, limit) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

  // Dev/preview: αν δεν έχουμε persistence, επέστρεψε κενό
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return [];

  const zkey = `tap:lb:daily:${day}`;
  const url  = `${UPSTASH_REDIS_REST_URL}/zrange/${encodeURIComponent(zkey)}/0/${limit - 1}/WITHSCORES`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const j = await r.json().catch(() => ({}));
    const arr = Array.isArray(j?.result) ? j.result : [];

    // arr = [memberJSON, scoreStr, memberJSON, scoreStr, ...] σε αύξουσα σειρά score (avg μικρότερο = καλύτερο)
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
      let member = {};
      try {
        member = JSON.parse(arr[i]);
      } catch {
        member = {};
      }
      const score = Number(arr[i + 1]);
      const avg   = Number.isFinite(score) ? Math.round(score) : null;

      out.push({
        avg: avg ?? null,
        attempts: Number.isFinite(member.attempts) ? member.attempts : 0,
        best: Number.isFinite(member.best) ? member.best : avg,
        mode: typeof member.mode === "string" ? member.mode : "default",
      });
    }
    return out;
  } catch {
    // Σε αποτυχία δικτύου/API μην “σπάσεις” το UI
    return [];
  }
}
