'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  COMPARE_EVENT,
  COMPARE_MAX,
  deliveryEstimate,
  getBestSellers,
  getCompare,
  inCompare,
  productBadges,
  toggleCompare,
} from '@/lib/shop';
import { showToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import Icon from './Icon';

// רכיבים קטנים שמופיעים על כרטיסי מוצר ובעמוד המוצר

function useStored<T>(event: string, read: () => T, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const update = () => setValue(read());
    update();
    window.addEventListener(event, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(event, update);
      window.removeEventListener('storage', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return value;
}

export function CompareButton({ productId, variant = 'chip' }: { productId: string; variant?: 'chip' | 'full' | 'link' }) {
  const active = useStored(COMPARE_EVENT, () => inCompare(productId), false);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(productId);
    if (result === 'full') showToast(`אפשר להשוות עד ${COMPARE_MAX} מוצרים`, { kind: 'error', action: { href: '/compare', label: 'להשוואה' } });
    else if (result === 'added') showToast('נוסף להשוואה', { kind: 'success', action: { href: '/compare', label: 'להשוואה' } });
  };
  if (variant === 'link') {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className="text-[11px] font-bold text-gray-400 hover:text-gray-700 cursor-pointer">
        <span className="inline-flex items-center gap-1">
          <Icon name="compare" size={14} /> {active ? 'נוסף להשוואה ✓' : 'הוספה להשוואה'}
        </span>
      </button>
    );
  }
  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1">
          <Icon name="compare" size={15} /> {active ? 'בהשוואה ✓' : 'הוספה להשוואה'}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="השוואת מוצרים"
      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <Icon name="compare" size={12} /> {active ? 'בהשוואה' : 'השוואה'}
      </span>
    </button>
  );
}

export function ProductBadges({ product, className = '' }: { product: any; className?: string }) {
  const [best, setBest] = useState<Set<string> | undefined>();
  useEffect(() => {
    let alive = true;
    getBestSellers().then((s) => alive && setBest(s));
    return () => {
      alive = false;
    };
  }, []);
  const badges = productBadges(product, best);
  if (!badges.length) return null;
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {badges.map((b) => (
        <span key={b.label} className={`text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm whitespace-nowrap ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function DeliveryEstimate({ compact = false }: { compact?: boolean }) {
  const [est, setEst] = useState<ReturnType<typeof deliveryEstimate> | null>(null);
  useEffect(() => {
    setEst(deliveryEstimate());
    const t = setInterval(() => setEst(deliveryEstimate()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!est) return null;
  return (
    <div className={`flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-2xl ${compact ? 'p-2.5' : 'p-3'}`}>
      <Icon name="truck" size={22} className="text-green-700 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <span className="block font-black text-green-900">
          יגיע אליך בין {est.fromText} ל{est.toText}
        </span>
        <span className="block text-green-800/80">
          {est.cutoffLeft ? `מזמינים בתוך ${est.cutoffLeft} וההזמנה יוצאת לטיפול עוד היום` : 'משלוח עד הבית · השליח מתקשר לפני ההגעה'}
        </span>
      </div>
    </div>
  );
}

// פס צף: כמה מוצרים בהשוואה, עם מעבר לעמוד ההשוואה
export function CompareBar() {
  const pathname = usePathname();
  const ids = useStored(COMPARE_EVENT, getCompare, [] as string[]);
  if (!ids.length || pathname === '/compare' || pathname?.startsWith('/admin') || pathname === '/cart') return null;
  return (
    <Link
      href="/compare"
      className="fixed bottom-24 left-5 z-30 bg-white/90 backdrop-blur border border-gray-200 text-gray-700 rounded-full shadow-sm px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 hover:bg-white transition"
      dir="rtl"
    >
      <Icon name="compare" size={15} />
      <span>השוואה ({ids.length})</span>
    </Link>
  );
}

// לוגואים של הכשרויות (נטען פעם אחת לכל הדף)
let kosherPromise: Promise<any[]> | null = null;
const loadKosher = () =>
  (kosherPromise ||= Promise.resolve(supabase.from('kosher_options').select('name, image_url')).then(({ data }) => data || []).catch(() => []));

export function KosherBadge({ product, className = '' }: { product: any; className?: string }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    loadKosher().then(setList);
  }, []);
  const name = String(product?.kosher || '').trim();
  const logo = name ? list.find((k) => String(k.name).trim() === name)?.image_url : '';
  if (!logo) return null;
  return (
    <span className={`w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow border border-gray-100 flex items-center justify-center ${className}`} title={`כשרות ${name}`}>
      <img src={logo} alt={`כשרות ${name}`} className="w-full h-full object-contain" />
    </span>
  );
}

// שכבה על תמונת כרטיס מוצר: תגיות, ולוגו הכשרות בעמודים שלא מציגים אותו בעצמם
// (ההשוואה נמצאת בעמוד המוצר, כדי שהכרטיסים יישארו נקיים)
export function CardOverlay({ product, withKosher = false }: { product: any; withKosher?: boolean }) {
  if (!product?.id) return null;
  return (
    <>
      <ProductBadges product={product} className="absolute bottom-2 right-2 z-10 pointer-events-none" />
      {withKosher && <KosherBadge product={product} className="absolute top-2 right-2 z-10" />}
    </>
  );
}
