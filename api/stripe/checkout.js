// /api/stripe/checkout.js
// δημιουργεί Stripe Checkout Session για αγορά credits
// REQ: POST { priceId: string, userId: string }
// χρησιμοποιεί metadata για να μεταφέρει credits & user_id στον webhook

export const config = { runtime: "nodejs18.x" };

import Stripe from "stripe";

const CREDITS_BY_PRICE = {
  // βάλε εδώ τα δικά σου Price IDs
  "prod_TISwp166YxTPHv": 100,
  "prod_TIT7Y2zGfo4LXy": 200,
  "prod_TIT8AM9dNOcFES": 600,
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { priceId, userId } = await parseBody(req);

    if (!priceId || !userId) {
      return res.status(400).json({ error: "priceId and userId required" });
    }
    const credits = CREDITS_BY_PRICE[priceId];
    if (!credits) {
      return res.status(400).json({ error: "Unknown priceId" });
    }

    // Βάλε το δικό σου domain
    const origin = getOrigin(req);
    const successUrl = `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/store/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url : cancelUrl,
      metadata: {
        user_id: userId,
        credits: String(credits),
      },
      // optional: automatic_tax, customer_email, etc
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("checkout error", e);
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
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}
