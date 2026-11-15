import './globals.css';

export const metadata = {
  title: 'מתכונים בגדול',
  description: 'המתכונים שלכם מסודרים לפי שלבים — בטלפון ובגדול על הטלוויזיה',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'מתכונים', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d9622b',
};

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
