'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// הסרה מרשימת המבצעים במייל: הקישור שבתחתית כל מייל פרסומי מוביל לכאן
function Unsubscribe() {
  const token = useSearchParams()?.get('token') || '';
  const [state, setState] = useState<'working' | 'done' | 'invalid' | 'error'>('working');

  useEffect(() => {
    if (!UUID.test(token)) {
      setState('invalid');
      return;
    }
    supabase.rpc('unsubscribe_marketing', { p_token: token }).then(
      ({ data, error }) => setState(error ? 'error' : data ? 'done' : 'invalid'),
      () => setState('error')
    );
  }, [token]);

  const text = {
    working: ['⏳', 'מסירים אותך מהרשימה...', ''],
    done: ['✅', 'הוסרת מרשימת המבצעים', 'לא נשלח לך יותר מבצעים במייל. עדכונים על הזמנות שביצעת ימשיכו להגיע כרגיל.'],
    invalid: ['🔗', 'הקישור לא תקין', 'אפשר להסיר את עצמך גם מהתפריט האישי באתר, אחרי התחברות.'],
    error: ['⚠️', 'משהו השתבש', 'נסו שוב בעוד רגע, או הסירו את עצמכם מהתפריט האישי באתר.'],
  }[state];

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-3" dir="rtl">
      <div className="text-5xl">{text[0]}</div>
      <h1 className="text-xl font-black text-gray-900">{text[1]}</h1>
      {text[2] && <p className="text-sm text-gray-600">{text[2]}</p>}
      <Link href="/" className="inline-block mt-4 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl text-sm font-black">
        לחנות
      </Link>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <Unsubscribe />
    </Suspense>
  );
}
