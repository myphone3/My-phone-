'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// בסרגל הניהול: כמה גולשים באתר ברגע זה (מתעדכן כל 30 שניות). לחיצה פותחת את "עכשיו באתר"
export default function LiveBadge() {
  const [count, setCount] = useState<number | null>(null);
  const [inCart, setInCart] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.rpc('admin_live');
      if (!alive || error) return;
      const online: any[] = (data as any)?.online || [];
      setCount(online.length);
      setInCart(online.filter((s) => String(s.path || '').startsWith('/cart')).length);
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (count === null) return null;
  return (
    <Link
      href="/admin/analytics"
      title="גולשים באתר ברגע זה"
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap border ${
        count > 0 ? 'bg-green-50 text-green-800 border-green-200' : 'bg-white text-gray-500 border-gray-200'
      }`}
    >
      <span className="relative flex w-2.5 h-2.5">
        {count > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${count > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
      </span>
      {count} באתר
      {inCart > 0 && <span className="text-amber-700">· {inCart} בעגלה</span>}
    </Link>
  );
}
