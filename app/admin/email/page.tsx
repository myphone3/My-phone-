'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminEmailPage() {
  const [emails, setEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerEmails();
  }, []);

  const fetchCustomerEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('email');
    if (data) {
      // איסוף כתובות מייל ייחודיות ללא כפילויות
      const uniqueEmails = Array.from(new Set(data.map((o: any) => o.email).filter(Boolean)));
      setEmails(uniqueEmails);
    }
    setLoading(false);
  };

  const applyTemplate = (type: string) => {
    if (type === 'cart') {
      setSubject('שכחת מוצרים בעגלה שלך ב-NEW PHONE! 🛒');
      setBody('שלום רב,\n\nשמנו לב שהשארת מוצרים בעגלה שלך באתר NEW PHONE. הם מחכים לך כאן עם משלוח מהיר עד הבית!\n\nלמעבר להשלמת ההזמנה, היכנס כעת לאתר.');
    } else if (type === 'promo')  {
      setSubject('מבצע ענק חדש בחנות NEW PHONE! ⚡');
      setBody('שלום רב,\n\nשמחים לעדכן אותך על מבצעים חדשים וחמים במיוחד על מכשירים סלולריים ואביזרים באתר.\n\nאל תפספס את ההזדמנות!');
    } else if (type === 'general') {
      setSubject('עדכון חשוב מחנות NEW PHONE 📱');
      setBody('שלום רב,\n\nהודעה חדשה ומעניינת עבורך מחנות NEW PHONE...');
    }
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0) {
      alert('אין עדיין כתובות אימייל של לקוחות במערכת.');
      return;
    }
    if (!subject || !body) {
      alert('נא למלא נושא וגוף הודעה.');
      return;
    }

    // פתיחת מייל עם BCC לכל הלקוחות
    const bccList = emails.join(',');
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען רשימת לקוחות...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
            ניהול ושליחת אימייל ללקוחות ({emails.length} לקוחות רשומים)
          </h1>
          <p className="text-xs text-gray-500 mt-1">שלח מבצעים, עדכונים או תזכורות לכל הלקוחות במכה אחת.</p>
        </div>
        <Link href="/admin/orders" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          🔙 חזרה להזמנות
        </Link>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-700 block">בחר תבנית מהירה:</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyTemplate('cart')} className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-100 cursor-pointer">
              🛒 תזכורת עזיבת עגלה
            </button>
            <button type="button" onClick={() => applyTemplate('promo')} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-green-100 cursor-pointer">
              ⚡ מבצע חם בחנות
            </button>
            <button type="button" onClick={() => applyTemplate('general')} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 cursor-pointer">
              📢 מודעה / עדכון כללי
            </button>
          </div>
        </div>

        <form onSubmit={handleSendEmail} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">נושא ההודעה</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="נושא המייל..."
              className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תוכן ההודעה</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="כתוב את תוכן המייל כאן..."
              rows={6}
              className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
              required
            ></textarea>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border text-xs text-gray-600 space-y-1">
            <strong>למי יישלח המייל?</strong>
            <p>המערכת תאסוף אוטומטית את כל כתובות האימייל של הלקוחות שהזמינו (${emails.length} כתובות) ותכניס אותן להסתרת כתובות (BCC) כך שכל לקוח יקבל את המייל באופן אישי ומכובד.</p>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition shadow-md cursor-pointer"
          >
            🚀 פתח שליחת מייל לכל הלקוחות
          </button>
        </form>
      </div>
    </div>
  );
}
