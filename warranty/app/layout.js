import './globals.css';
import { FRESH_GUARD } from '@/lib/boot';

export const metadata = {
  title: 'קבלות ואחריות',
  description: 'כל הקבלות לאחריות במקום אחד — עם חיפוש ותאריך סיום האחריות',
  manifest: '/manifest.json?v=2',
  icons: { icon: [{ url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png?v=2' },
  appleWebApp: { capable: true, title: 'אחריות', statusBarStyle: 'default' },
};

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#6d4aea' };

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRESH_GUARD }} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: "try{if(location.pathname==='/'&&!/[?&]all/.test(location.search)){var v=JSON.parse(localStorage.getItem('wr_vaults')||'[]');if(v.length===1&&/^[0-9a-f-]{36}$/.test(v[0].id))location.replace('/v/'+v[0].id+location.search)}}catch(e){}" }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
      </body>
    </html>
  );
}
