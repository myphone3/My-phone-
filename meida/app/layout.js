import './globals.css';
import { FRESH_GUARD } from '@/lib/boot';
import SwipeClose from '@/components/SwipeClose';

export const metadata = {
  title: 'מידע לחנות',
  description: 'כל המידע של החנות במקום אחד — קודים, IMEI, נקודות שירות, טלפונים והוראות',
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'מידע', statusBarStyle: 'default' },
};

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#0e7490' };

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRESH_GUARD }} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: "try{if(location.pathname==='/'&&!/[?&]all/.test(location.search)){var s=localStorage.getItem('kb_last_shop');if(s&&/^[0-9a-f-]{36}$/.test(s))location.replace('/s/'+s+location.search)}}catch(e){}" }} />
      </head>
      <body>
        {children}
        <SwipeClose />
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
      </body>
    </html>
  );
}
