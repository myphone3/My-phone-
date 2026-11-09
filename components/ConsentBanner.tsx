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

  if (!show || pathname?.startsWith('/admin')) return null;

  const choose = (value: 'all' | 'essential') => {
    setConsent(value);
    setShow(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-3 sm:p-4" dir="rtl" role="dialog" aria-label="הודעה על עוגיות">
      <div className="max-w-3xl mx-auto bg-white border-2 border-orange-200 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-gray-700 leading-relaxed flex-1">
          🍪 אנחנו משתמשים בעוגיות כדי שהאתר יעבוד, כדי להבין אילו מוצרים מעניינים אתכם ולשפר את האתר.{' '}
          <Link href="/privacy#cookies" className="underline font-bold text-orange-700">
            פרטים במדיניות הפרטיות
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('essential')}
            className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            רק הכרחיות
          </button>
          <button
            onClick={() => choose('all')}
            className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer"
          >
            מאשר/ת הכל
          </button>
        </div>
      </div>
    </div>
  );
}
