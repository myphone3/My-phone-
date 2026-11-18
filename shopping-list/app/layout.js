import './globals.css';
import { FRESH_GUARD } from '@/lib/boot';
import SwipeClose from '@/components/SwipeClose';

// יש רק רשימה אחת? פותחים ישר אותה (בלי לעבור במסך הבית). ?all = להישאר במסך הבית
const OPEN_LIST = "try{if(location.pathname==='/'&&!/[?&]all/.test(location.search)){var l=JSON.parse(localStorage.getItem('sl_lists')||'[]');if(l.length===1&&/^[0-9a-f-]{36}$/i.test(l[0].id))location.replace('/l/'+l[0].id)}}catch(e){}";

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: OPEN_LIST }} />
        <script dangerouslySetInnerHTML={{ __html: FRESH_GUARD }} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <SwipeClose />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}",
          }}
        />
      </body>
    </html>
  );
}
