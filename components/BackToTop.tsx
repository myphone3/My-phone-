'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

// חזרה למעלה: עיגול קטן בפינה הימנית (הפינה השמאלית שמורה לוואטסאפ ולנציג),
// מופיע רק אחרי גלילה ארוכה, ונעלם כשחוזרים למעלה
export default function BackToTop() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > window.innerHeight * 2));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  if (pathname?.startsWith('/admin')) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      aria-label="חזרה לראש העמוד"
      tabIndex={show ? 0 : -1}
      data-float
      style={{ translate: '0 calc(-1 * (var(--float-shift, 0px) + var(--float-base, 0px)))', transition: 'translate 300ms ease, opacity 200ms ease, transform 200ms ease' }}
      className={`fixed bottom-3 [body[data-consent=open]_&]:bottom-16 right-3 z-40 w-11 h-11 rounded-full bg-white/80 backdrop-blur-md border-2 border-orange-200 text-orange-600 shadow-lg flex items-center justify-center cursor-pointer hover:bg-white ${
        show ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
      }`}
    >
      <Icon name="arrow" size={18} className="rotate-90" />
    </button>
  );
}
