'use client';

import { usePathname } from 'next/navigation';

// לא סופרים כניסות לפאנל הניהול: בכניסה ישירה לפאנל לא נטענים כלי המעקב,
// ובמעבר מהחנות לפאנל בלי טעינת עמוד מכבים אותם (וחוזרים להפעיל ביציאה מהפאנל).
// ההגדרה נעשית בזמן הרינדור, לפני שהכלים שולחים צפייה על הניווט החדש.
export default function AnalyticsGate({ ga, pixel, children }: { ga: string; pixel: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = !!pathname?.startsWith('/admin');
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (ga) w[`ga-disable-${ga}`] = admin;
    if (pixel && typeof w.fbq === 'function') w.fbq('consent', admin ? 'revoke' : 'grant');
  }
  if (admin) return null;
  return <>{children}</>;
}
