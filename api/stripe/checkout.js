// /api/stripe/checkout.js
// δημιουργεί Stripe Checkout Session για αγορά credits
// REQ: POST { priceId: string, userId: string }
// χρησιμοποιεί metadata για να μεταφέρει credits & user_id στον webhook

export const config = { runtime: "nodejs" };

import Stripe from "stripe";

// ⚠️ ΒΑΛΕ ΕΔΩ ΤΑ ΠΡΑΓΜΑΤΙΚΑ Price IDs (όχι product IDs)
const CREDITS_BY_PRICE = {
  "price_1SLs0zHc9Vf4EoamXgjJn5rz": 100,
  "price_1SLsB2Hc9Vf4EoameSiWFGR7": 200,
  "price_1SLsBwHc9Vf4EoamVfo1HsBA": 600,
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[checkout] Missing STRIPE_SECRET_KEY");
      return res.status(500).json({ error: "server misconfigured" });
    }

    const { priceId, userId, success_url, cancel_url } = await parseBody(req);

    if (!priceId || !userId) {
      return res.status(400).json({ error: "priceId and userId required" });
    }
    const credits = CREDITS_BY_PRICE[priceId];
    if (!credits) {
      return res.status(400).json({ error: "Unknown priceId" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Προεπιλογή URLs με βάση το τρέχον origin, εκτός αν δοθούν ρητά στο body
    const origin = getOrigin(req);
    const successUrl = success_url || `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = cancel_url  || `${origin}/store/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url : cancelUrl,
      allow_promotion_codes: true,        // optional, καλό UX
      billing_address_collection: "auto",  // optional
      metadata: {
        user_id: userId,
        credits: String(credits),
      },
    });

    if (!session?.url) {
      console.error("[checkout] session created without url");
      return res.status(500).json({ error: "no checkout url" });
    }

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("[checkout] error", e);
    return res.status(500).json({ error: "server error" });
  }
}

function getOrigin(req) {
  // προτίμησε X-Forwarded-Proto/Host πίσω από vercel
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"]  || req.headers.host;
  return `${proto}://${host}`;
}

async function parseBody(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
