'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getConsent, setConsent } from '@/lib/track';

// הודעת עוגיות: מוצגת עד שהלקוח בוחר. "רק הכרחיות" = האתר עובד כרגיל, בלי Google/Facebook ובלי זיהוי בין ביקורים.
export default function ConsentBanner() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(getConsent() === null);
    const open = () => setShow(true);
    window.addEventListener('open-consent', open);
    return () => window.removeEventListener('open-consent', open);
  }, []);

  // כשהפס פתוח, הכפתורים הצפים (וואטסאפ) עולים מעליו
  const visible = show && !pathname?.startsWith('/admin');
  useEffect(() => {
    document.body.dataset.consent = visible ? 'open' : '';
  }, [visible]);

  if (!visible) return null;

  const choose = (value: 'all' | 'essential') => {
    setConsent(value);
    setShow(false);
  };

  // פס דק בתחתית המסך: לא מסתיר את האתר
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[60] bg-gray-900/95 backdrop-blur text-white"
      dir="rtl"
      role="dialog"
      aria-label="הודעה על עוגיות"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-2 sm:gap-3">
        <p className="text-[11px] sm:text-xs text-gray-200 leading-snug flex-1 min-w-0">
          האתר משתמש בעוגיות.{' '}
          <Link href="/privacy#cookies" className="underline text-white/90">
            פרטים
          </Link>
        </p>
        <button onClick={() => choose('essential')} className="shrink-0 text-[11px] sm:text-xs text-gray-300 hover:text-white px-2 py-1.5 cursor-pointer">
          רק הכרחיות
        </button>
        <button onClick={() => choose('all')} className="shrink-0 bg-white text-gray-900 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-black cursor-pointer">
          אישור
        </button>
      </div>
    </div>
  );
}
