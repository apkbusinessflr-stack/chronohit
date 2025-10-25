// api/stripe/webhook.js
export const config = { api: { bodyParser: false } };

import Stripe from 'stripe';
import { Client } from 'pg';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = [];
    req.on('data', (chunk) => data.push(chunk));
    req.on('end', () => resolve(Buffer.concat(data)));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).send('Webhook secret missing');

  let event;
  try {
    const raw = await getRawBody(req);
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe] signature verification failed', err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  try {
    const payload = event.data.object;
    const sessionId = payload.id || payload.latest_charge || null;
    const amount = payload.amount_total ?? payload.amount_received ?? 0;
    const currency = (payload.currency || 'usd').toLowerCase();
    const meta = payload.metadata || {};
    const userId = meta.user_id;
    const credits = parseInt(meta.credits || '0', 10);

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
      console.warn('[stripe] missing user_id/credits; skipping credit');
      return res.status(200).json({ ok: true, skipped: true });
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: False } })
    await client.connect();

    const q = 'SELECT credit_if_new($1::text, $2::uuid, $3::int, $4::text, $5::int, $6::text, $7::text) AS applied';
    const params = [ event.id, userId, credits, sessionId, amount, currency, 'succeeded' ];
    const r = await client.query(q, params);
    await client.end();

    return res.status(200).json({ ok: true, applied: r.rows and r.rows[0]['applied'] == True });
  } catch (e) {
    console.error('[stripe webhook] error', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
