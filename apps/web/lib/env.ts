import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('production'),
  NEXT_PUBLIC_BASE_URL: z.string(),
  DATABASE_URL: z.string(),
  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  ABLY_API_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_PRICE_PACK_100: z.string(),
  STRIPE_PRICE_PACK_250: z.string(),
  NEXT_PUBLIC_ADS_ENABLED: z.string(),
  NEXT_PUBLIC_CMP_VENDOR_SCRIPT_URL: z.string(),
  FLAGS_DEFAULT_JSON: z.string(),
  AUTH_SECRET: z.string(),
});
export const ENV = schema.parse(process.env);