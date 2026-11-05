'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const readCart = () => {
  try {
    const c = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
};

// עגלה של לקוח מחובר נשמרת גם בחשבון: מופיעה בכל מכשיר, ומאפשרת מייל תזכורת אם לא הושלמה.
export default function CartSync() {
  useEffect(() => {
    let userId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = () => {
      if (!userId) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        supabase.rpc('save_my_cart', { p_items: readCart().slice(0, 50) }).then(() => undefined, () => undefined);
      }, 1500);
    };

    // בהתחברות: אם העגלה במכשיר הזה ריקה, מחזירים את העגלה השמורה; אחרת שומרים את העגלה הנוכחית
    const onLogin = async (uid: string) => {
      if (userId === uid) return;
      userId = uid;
      const local = readCart();
      if (local.length) return save();
      const { data, error } = await supabase.rpc('get_my_cart');
      if (!error && Array.isArray(data) && data.length) {
        localStorage.setItem('cart', JSON.stringify(data));
        window.dispatchEvent(new Event('cartUpdated'));
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) onLogin(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) onLogin(session.user.id);
      else userId = null;
    });
    window.addEventListener('cartUpdated', save);
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      window.removeEventListener('cartUpdated', save);
    };
  }, []);
  return null;
}
