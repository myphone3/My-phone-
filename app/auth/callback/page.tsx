'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// לכאן Google מחזיר את המשתמש אחרי התחברות. מחכים שההתחברות תיקלט ומעבירים לדף הבית
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let done = false;
    const goHome = () => {
      if (done) return;
      done = true;
      router.replace('/');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') goHome();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goHome();
    });

    // גיבוי: אם משהו נתקע, חוזרים לדף הבית בכל מקרה
    const timer = setTimeout(goHome, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  return null;
}
