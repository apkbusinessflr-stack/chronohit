export default async function handler(req, res) {
const pub = process.env.ADSENSE_PUBLISHER_ID || "";
const home = process.env.ADSENSE_SLOT_HOME || "";
const tap = process.env.ADSENSE_SLOT_TAPREFLEX || "";
const id = process.env.GA_MEASUREMENT_ID || "";

if (!pub) {
return res.status(200).json({ enabled: false, reason: "Missing ADSENSE_PUBLISHER_ID" });
}
return res.status(200).json({
enabled: true,
publisher: pub,
slots: {
home,
tapreflex: tap
}
});
}
