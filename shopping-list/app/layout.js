import './globals.css';

export const metadata = {
  title: 'רשימת קניות משותפת',
  description: 'רשימת קניות משותפת בזמן אמת',
  manifest: '/manifest.json?v=4',
  icons: { icon: [{ url: '/icon-192.png?v=4', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png?v=4' },
  appleWebApp: { capable: true, title: 'קניות', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}",
          }}
        />
      </body>
    </html>
  );
}
