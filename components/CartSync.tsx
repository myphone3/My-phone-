'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const OWNER_KEY = 'np_cart_owner';

const readCart = () => {
  try {
    const c = JSON.parse(localStorage.getItem('cart') || '[]');
    // רק פריטים תקינים (אובייקטים), כדי שעגלה פגומה לא תשבור את דף העגלה
    return Array.isArray(c) ? c.filter((i) => i && typeof i === 'object') : [];
  } catch {
    return [];
  }
};

const writeCart = (items: any[]) => {
  localStorage.setItem('cart', JSON.stringify(items));
  window.dispatchEvent(new Event('cartUpdated'));
};

// עגלה של לקוח מחובר נשמרת גם בחשבון: מופיעה בכל מכשיר, ומאפשרת מייל תזכורת אם לא הושלמה.
// כל עגלה במכשיר "שייכת" לחשבון שמחובר אליה, כדי שעגלה של חשבון אחד לא תישמר בחשבון אחר.
export default function CartSync() {
  useEffect(() => {
    let userId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let changeCounter = 0;

    const save = () => {
      if (!userId) return;
      clearTimeout(timer);
      const uid = userId;
      timer = setTimeout(() => {
        if (localStorage.getItem(OWNER_KEY) !== uid) return;
        supabase.rpc('save_my_cart', { p_items: readCart() }).then(() => undefined, () => undefined);
      }, 1500);
    };

    const onCartChanged = () => {
      changeCounter++;
      if (userId && !localStorage.getItem(OWNER_KEY)) localStorage.setItem(OWNER_KEY, userId);
      save();
    };

    const onLogin = async (uid: string) => {
      if (userId === uid) return;
      userId = uid;
      const owner = localStorage.getItem(OWNER_KEY);
      const local = readCart();

      // עגלה של אורח (בלי בעלים) או של אותו חשבון: שייכת לחשבון הזה
      if (local.length && (!owner || owner === uid)) {
        localStorage.setItem(OWNER_KEY, uid);
        return save();
      }

      // עגלה ריקה, או עגלה של חשבון אחר: טוענים את העגלה השמורה של החשבון הזה
      const before = changeCounter;
      const { data, error } = await supabase.rpc('get_my_cart');
      if (error || userId !== uid) return;
      // אם הלקוח שינה את העגלה בזמן הטעינה, לא דורסים את השינוי
      if (changeCounter !== before) {
        localStorage.setItem(OWNER_KEY, uid);
        return save();
      }
      const saved = Array.isArray(data) ? data.filter((i: any) => i && typeof i === 'object') : [];
      localStorage.setItem(OWNER_KEY, uid);
      if (saved.length || (owner && owner !== uid)) writeCart(saved);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) onLogin(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) onLogin(session.user.id);
      else userId = null;
    });
    window.addEventListener('cartUpdated', onCartChanged);
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      window.removeEventListener('cartUpdated', onCartChanged);
    };
  }, []);
  return null;
}
