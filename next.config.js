/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    // הגופנים ל-PDF נקראים מהדיסק במייל אישור ההזמנה
    outputFileTracingIncludes: {
      '/api/order-confirmation': ['./public/fonts/**'],
    },
  },
};

module.exports = nextConfig;
