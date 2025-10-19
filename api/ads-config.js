// /api/ads-config.js
// Returns AdSense config from ENV for the frontend loader.
// ENV (set on Vercel):
//  - ADSENSE_PUBLISHER_ID   e.g. ca-pub-1234567890123456
//  - ADSENSE_SLOT_HOME      e.g. 1234567890
//  - ADSENSE_SLOT_TAPREFLEX e.g. 0987654321

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Content-Type", "application/json");
      return res.status(405).json({ enabled: false, error: "Method Not Allowed" });
    }

    const pub = process.env.ADSENSE_PUBLISHER_ID || "";
    const home = process.env.ADSENSE_SLOT_HOME || "";
    const tap  = process.env.ADSENSE_SLOT_TAPREFLEX || "";

    if (!pub) {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({ enabled: false, reason: "Missing ADSENSE_PUBLISHER_ID" });
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      enabled: true,
      publisher: pub,
      slots: {
        home,
        tapreflex: tap
      }
    });
  } catch (e) {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ enabled: false, error: "server error" });
  }
}
