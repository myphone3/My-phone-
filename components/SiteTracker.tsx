'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { flush, heartbeat, setCurrentProduct, setTrackingExcluded, track } from '@/lib/track';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const readCart = (): Map<string, { qty: number; productId: string; price: number }> => {
  try {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const map = new Map();
    if (Array.isArray(cart)) {
      for (const i of cart) {
        const id = String(i?.id || '');
        const productId = String(i?.productId || id.match(UUID_RE)?.[0] || '');
        map.set(id, { qty: Number(i?.quantity) || 1, productId, price: Number(i?.price) || 0 });
      }
    }
    return map;
  } catch {
    return new Map();
  }
};

// סופר כניסות לעמודים, שולח "עדיין כאן" כל 30 שניות בזמן שהדף פתוח, ומזהה הוספות לעגלה מכל מקום באתר
export default function SiteTracker() {
  const pathname = usePathname();
  const cartRef = useRef<ReturnType<typeof readCart> | null>(null);

  // מנהלים לא נספרים
  useEffect(() => {
    const check = async (signedIn: boolean) => {
      if (!signedIn) return setTrackingExcluded(false);
      const { data } = await supabase.rpc('is_admin');
      setTrackingExcluded(data === true);
    };
    supabase.auth.getSession().then(({ data }) => check(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => check(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    if (!pathname.startsWith('/product/')) setCurrentProduct(null);
    track('page_view');
  }, [pathname]);

  useEffect(() => {
    cartRef.current = readCart();
    const onCart = () => {
      const before = cartRef.current || new Map();
      const after = readCart();
      after.forEach((item, id) => {
        const added = item.qty - (before.get(id)?.qty || 0);
        if (added > 0 && item.productId) track('add_to_cart', { product_id: item.productId, value: Math.round(item.price * added) });
      });
      cartRef.current = after;
      heartbeat();
    };
    window.addEventListener('cartUpdated', onCart);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') heartbeat();
    }, 30000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('cartUpdated', onCart);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  return null;
}
