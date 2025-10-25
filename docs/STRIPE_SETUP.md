# Stripe + Neon wiring (ChronoHit)

## What this pack adds
- `/api/stripe/webhook.js` → verifies signatures, idempotent crediting
- `/api/wallet/index.js` → GET balance by `user_id`
- `.env.example` → required envs
- `db/sql/004_helpers.sql` → helper SQL for idempotent crediting

## Migrations (run once)
```bash
psql $DATABASE_URL -f db/sql/004_helpers.sql
```

This file assumes you already have:
- `users(id uuid primary key)`
- `wallets(user_id uuid primary key, credits integer not null default 0, updated_at timestamptz)`
- `purchases(id bigserial primary key, user_id uuid, stripe_event_id text unique, stripe_session_id text, amount_cents integer, currency text, credits integer, status text, created_at timestamptz default now())`
Adjust names if your schema differs.

## Vercel configuration
- Project → Settings → **Environment Variables**: add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, `SESSION_SECRET`, `VITE_STRIPE_PUBLIC_KEY`.
- Add a **Webhook endpoint** in Stripe Dashboard pointing to:
  - `https://<your-domain>/api/stripe/webhook`

## Checkout metadata
When creating a Checkout Session (client/server), pass metadata:
- `user_id`: UUID of the logged-in user
- `credits`: integer credits to grant upon successful payment

Example (server-side):
```js
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [/* ... */],
  success_url: 'https://chronohit.com/success',
  cancel_url: 'https://chronohit.com/cancel',
  metadata: { user_id, credits: 200 } // 200 credits on success
});
```

## Test locally
- Use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
