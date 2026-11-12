'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { prefetchProduct } from '@/lib/productPrefetch';

// מאזין אחד לכל האתר: נגיעה / מעבר עכבר על קישור למוצר מתחילים לטעון אותו מראש
export default function PrefetchOnTouch() {
  const router = useRouter();
  useEffect(() => {
    const seen = new Set<string>();
    const onIntent = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/product/"]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      const id = decodeURIComponent(href.split('/')[2]?.split(/[?#]/)[0] || '');
      if (!id || seen.has(href)) return;
      seen.add(href);
      prefetchProduct(id);
      router.prefetch(href);
    };
    document.addEventListener('touchstart', onIntent, { passive: true, capture: true });
    document.addEventListener('mouseover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    return () => {
      document.removeEventListener('touchstart', onIntent, { capture: true } as any);
      document.removeEventListener('mouseover', onIntent);
      document.removeEventListener('focusin', onIntent);
    };
  }, [router]);
  return null;
}
