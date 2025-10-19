// /api/daily.js
// Returns how many daily submissions a device has used for a given day
// ENV (optional for persistence):
//  - UPSTASH_REDIS_REST_URL
//  - UPSTASH_REDIS_REST_TOKEN

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Content-Type", "application/json");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const device = (url.searchParams.get("device") || "").trim();
    const day = (url.searchParams.get("day") || "").trim();

    // Basic validation
    if (!device || !day) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: "device and day required" });
    }
    if (!/^\d{8}$/.test(day)) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: "day must be YYYYMMDD" });
    }
    if (device.length > 128) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: "device too long" });
    }

    const used = await getDailyUsed(device, day);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ used });
  } catch (e) {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ error: "server error" });
  }
}

async function getDailyUsed(device, day) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

  // Dev/preview fallback: χωρίς persistence -> 0
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return 0;
  }

  const key = `tap:daily:${day}:${device}:count`;
  const url = `${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
      // μικρό timeout guard μέσω AbortController (προαιρετικό)
      // signal: AbortSignal.timeout?.(2000)
    });
    const j = await r.json().catch(() => ({}));
    const v = j?.result;
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    // Σε περίπτωση σφάλματος δικτύου, μην “σπάς” το game
    return 0;
  }
}
