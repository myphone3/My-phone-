'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COMPARE_EVENT, clearCompare, getCompare } from '@/lib/compare';

// פס קטן בתחתית המסך כשנבחרו מכשירים להשוואה
export default function CompareBar() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const update = () => setCount(getCompare().length);
    update();
    window.addEventListener(COMPARE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(COMPARE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (!count || pathname?.startsWith('/compare') || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-24 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none" dir="rtl">
      <div className="pointer-events-auto bg-gray-900 text-white rounded-2xl shadow-xl flex items-center gap-3 pl-2 pr-4 py-2">
        <span className="text-xs font-bold">⚖️ {count} מכשירים להשוואה</span>
        <Link href="/compare" className="bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-xl text-xs font-black">
          השוו עכשיו
        </Link>
        <button onClick={clearCompare} className="text-gray-400 hover:text-white text-xs px-1 cursor-pointer" aria-label="ניקוי ההשוואה">
          ✕
        </button>
      </div>
    </div>
  );
}
