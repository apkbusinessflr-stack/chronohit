// /api/ads-config.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Content-Type", "application/json");
      return res.status(405).json({ enabled:false, error:"Method Not Allowed" });
    }
    const pub = process.env.ADSENSE_PUBLISHER_ID || "";
    const cfg = {
      enabled: !!pub,
      publisher: pub,
      slots: {
        home: process.env.ADSENSE_SLOT_HOME || "",
        tapreflex: process.env.ADSENSE_SLOT_TAPREFLEX || "",
        targetrush: process.env.ADSENSE_SLOT_TARGETRUSH || "",
        sequencesprint: process.env.ADSENSE_SLOT_SEQUENCESPRINT || ""
      }
    };
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(cfg);
  } catch {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ enabled:false, error:"server error" });
  }
}
