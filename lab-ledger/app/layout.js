import './globals.css';

export const metadata = {
  title: 'קופת המעבדה',
  description: 'הכנסות, הוצאות ומלאי של המעבדה',
  manifest: '/manifest.json?v=2',
  icons: { icon: [{ url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png?v=2' },
  appleWebApp: { capable: true, title: 'קופה', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#123540',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Rubik:wght@500;600;700&display=swap" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
      </body>
    </html>
  );
}
