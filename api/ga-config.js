// /api/ga-config.js
// Returns GA4 Measurement ID from ENV
// Vercel → Project Settings → Environment Variables:
//   GA_MEASUREMENT_ID  (e.g. G-XXXXXXXXXX)

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Content-Type", "application/json");
      return res.status(405).json({ enabled: false, error: "Method Not Allowed" });
    }

    const id = process.env.GA_MEASUREMENT_ID || "";
    res.setHeader("Content-Type", "application/json");

    if (!id) {
      return res.status(200).json({ enabled: false, reason: "Missing GA_MEASUREMENT_ID" });
    }
    return res.status(200).json({ enabled: true, id });
  } catch {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ enabled: false, error: "server error" });
  }
}
