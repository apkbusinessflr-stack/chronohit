# ChronoHit (Production Skeleton)

Monorepo (Turborepo) — Next.js 14 (App Router), TS, Prisma (Postgres/Neon), Upstash Redis, Ably, Stripe, CMP, Ads (off-game), PWA, EN public / EL admin.

## Quickstart
```bash
cp .env.example .env
cd apps/web
npm ci
npm run prisma:generate
npm run dev
```

## Deploy (Vercel)
- Import `apps/web`
- Set env vars from `.env.example`
- Neon: set DATABASE_URL
- Upstash: set REST URL/TOKEN
- Ably: ABLY_API_KEY
- Stripe: SECRET + WEBHOOK + PRICES (pack 100/250)
- Ads: ads.txt/app-ads.txt and CMP script URL

## Notes
- Admin area (`/el/admin`) guarded by cookie `admin_auth=1` (replace with real RBAC).
- Ads banners render only off-game placements; integrate provider SDK before launch.
- Realtime duel endpoints can be added similarly under `/api/match/duel/*`.