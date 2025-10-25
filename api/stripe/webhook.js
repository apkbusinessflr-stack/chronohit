// api/stripe/webhook.js
// ESM + Node runtime, ασφαλής Stripe verify (raw body).
// ΔΕΝ κάνει JSON parse του body. Χρησιμοποιεί constructEvent.
// Σε checkout.session.completed: παίρνει { user_id, credits } από metadata
// και κάνει POST στο /api/wallet για να πιστώσει τον χρήστη (idempotent by event.id).

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: false, // raw body για signature verification
  },
};

import Stripe from "stripe";
import crypto from "crypto";
import http from "http";

function getEnv() {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;
  if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET };
}

// Διαβάζει RAW body από το Vercel Node function
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Απλό in-memory idempotency guard για burst (το πραγματικό guard είναι DB/unique key).
// Σε serverless cold starts δεν κρατιέται πάντα — οπότε βασίσου στην DB για πραγματικό idempotency.
const seen = new Set();
function seenEvent(id) {
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  setTimeout(() => seen.delete(id), 10 * 60 * 1000); // 10'
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = getEnv();
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const raw = await readRawBody(req);
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    // Verify
    const event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);

    // Idempotency (soft, process-level)
    if (seenEvent(event.id)) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    // Handle relevant events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Credits & user from metadata (από το checkout.js)
      const userId = session?.metadata?.user_id || session?.metadata?.userId || "";
      const creditsStr = session?.metadata?.credits || "0";
      const credits = parseInt(creditsStr, 10) || 0;

      if (!userId || !Number.isInteger(credits) || credits <= 0) {
        // Δεν πετάμε 400—επιστρέφουμε 200 ώστε Stripe να μη ξαναπροσπαθεί
        console.warn("webhook: missing/invalid metadata", { userId, credits });
        return res.status(200).json({ ok: true, skipped: true });
      }

      // Κάνε credit στο wallet μέσω του ίδιου API (single source of truth)
      const origin = getOrigin(req);
      const resp = await fetch(`${origin}/api/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: userId, delta: credits }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("wallet credit failed", resp.status, txt);
        // 500 → Stripe θα ξαναστείλει (retries) μέχρι να πετύχει
        return res.status(500).send("wallet credit failed");
      }

      return res.status(200).json({ ok: true });
    }

    // Για άλλα event types: απάντησε 200 (ή log only)
    return res.status(200).json({ ok: true, ignored: event.type });
  } catch (e) {
    console.error("stripe webhook error", e);
    // 400 για signature/parse errors → Stripe θα retry
    const code = String(e?.message || "").includes("No signatures found") ? 400 : 500;
    return res.status(code).send("webhook error");
  }
}
