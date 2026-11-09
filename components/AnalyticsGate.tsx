'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getConsent } from '@/lib/track';

// Google Analytics ו-Facebook Pixel נטענים רק אחרי שהלקוח אישר עוגיות סטטיסטיקה ושיווק.
// לא סופרים כניסות לפאנל הניהול: בכניסה ישירה לפאנל לא נטענים כלי המעקב,
// ובמעבר מהחנות לפאנל בלי טעינת עמוד מכבים אותם (וחוזרים להפעיל ביציאה מהפאנל).
// ההגדרה נעשית בזמן הרינדור, לפני שהכלים שולחים צפייה על הניווט החדש.
export default function AnalyticsGate({ ga, pixel, children }: { ga: string; pixel: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const update = () => setAllowed(getConsent() === 'all');
    update();
    window.addEventListener('consentChanged', update);
    return () => window.removeEventListener('consentChanged', update);
  }, []);

  const admin = !!pathname?.startsWith('/admin');
  const off = admin || !allowed;
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (ga) w[`ga-disable-${ga}`] = off;
    if (pixel && typeof w.fbq === 'function') w.fbq('consent', off ? 'revoke' : 'grant');
  }
  if (off) return null;
  return <>{children}</>;
}
