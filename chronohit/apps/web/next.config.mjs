/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: { locales: ['en','el'], defaultLocale: 'en', localeDetection: true },
  headers: async () => ([{
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https://*.googlesyndication.com; script-src 'self' 'unsafe-inline' https://*.doubleclick.net https://*.googlesyndication.com https://cmp.vendor.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rest.ably.io https://realtime.ably.io https://api.upstash.com https://api.stripe.com; frame-src https://js.stripe.com https://*.doubleclick.net;"}
    ]
  }])
};
export default nextConfig;