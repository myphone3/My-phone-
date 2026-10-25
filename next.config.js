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
    // הגופנים והלוגו ל-PDF נקראים מהדיסק במייל אישור ההזמנה
    outputFileTracingIncludes: {
      '/api/order-confirmation': ['./public/fonts/**', './public/Logo.JPG'],
    },
  },
};

module.exports = nextConfig;
