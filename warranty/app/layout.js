import './globals.css';

export const metadata = {
  title: 'קבלות ואחריות',
  description: 'כל הקבלות לאחריות במקום אחד — עם חיפוש ותאריך סיום האחריות',
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'אחריות', statusBarStyle: 'default' },
};

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#4f46e5' };

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
      </body>
    </html>
  );
}
