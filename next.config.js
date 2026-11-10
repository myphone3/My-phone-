/** @type {import('next').NextConfig} */
const nextConfig = {
  // מדריכים שאוחדו למדריך אחד
  async redirects() {
    return [
      { source: '/guide/kosher-phone', destination: '/guide/kosher-vs-supported', permanent: true },
      { source: '/guide/kosher-supported', destination: '/guide/kosher-vs-supported', permanent: true },
    ];
  },
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
