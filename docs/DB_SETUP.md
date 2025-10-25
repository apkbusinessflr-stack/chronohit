# ChronoHit – Neon (Postgres) on Vercel

1) Put `DATABASE_URL` (pooled + ssl) in Vercel env.
2) Add `SESSION_SECRET`, Stripe keys, Redis (optional), GA/AdSense (optional).
3) Deploy and open `/api/db-health` to test connection.
4) Apply SQL migrations in `db/sql` in order via psql.
5) Point Stripe webhook to `/api/stripe/webhook` (placeholder).
