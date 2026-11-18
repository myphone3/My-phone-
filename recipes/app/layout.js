import './globals.css';
import { FRESH_GUARD } from '@/lib/boot';
import SwipeClose from '@/components/SwipeClose';

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRESH_GUARD }} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/rubik-hebrew.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <SwipeClose />
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
      </body>
    </html>
  );
}
