'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { fetchAll } from '@/lib/fetchAll';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/orders';
import { LoadErrorBox } from '@/components/admin/LoadErrorBox';

type Customer = {
  user_id: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  registered: boolean;
  signed_up_at: string | null;
  first_order_at: string | null;
  orders_count: number;
  consent: boolean;
  consented_at: string | null;
};

type Filter = 'all' | 'registered' | 'consent';

// לקוחות: מי שנרשם לאתר ומי שרק הזמין, כמה הזמנות, ואם אישר/ה קבלת מבצעים במייל
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await fetchAll<Customer>((a, b) => supabase.rpc('admin_list_customers').range(a, b));
    setLoadError(error ? error.message || 'שגיאה בטעינה' : '');
    if (!error) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeFromMailing = async (c: Customer) => {
    if (!c.user_id || !confirm(`להסיר את ${c.email} מרשימת המבצעים במייל?`)) return;
    const { data, error } = await supabase.rpc('admin_unsubscribe_marketing', { p_user_id: c.user_id });
    if (error || !data) return showToast('ההסרה נכשלה' + (error ? ': ' + error.message : ''), { kind: 'error' });
    showToast('הלקוח הוסר מרשימת המבצעים', { kind: 'success' });
    load();
  };

  const counts = useMemo(
    () => ({
      all: customers.length,
      registered: customers.filter((c) => c.registered).length,
      consent: customers.filter((c) => c.consent).length,
    }),
    [customers]
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (filter === 'all' || (filter === 'registered' ? c.registered : c.consent)) &&
        (!q || [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q)))
    );
  }, [customers, filter, search]);

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium" dir="rtl">טוען לקוחות...</div>;
  if (loadError) return <LoadErrorBox error={loadError} what="הלקוחות" onRetry={load} />;

  // ייצוא רק של מי שאישר מבצעים במייל (רק להם מותר לשלוח)
  const exportMailing = () =>
    downloadCsv('mailing-list.csv', [
      ['שם', 'מייל', 'תאריך אישור'],
      ...customers.filter((c) => c.consent).map((c) => [c.name || '', c.email, formatDate(c.consented_at || undefined)]),
    ]);

  const cards: { key: Filter; label: string; value: number; color: string }[] = [
    { key: 'all', label: 'סה"כ לקוחות', value: counts.all, color: 'text-gray-900' },
    { key: 'registered', label: 'נרשמו לאתר', value: counts.registered, color: 'text-blue-600' },
    { key: 'consent', label: 'אישרו מבצעים במייל', value: counts.consent, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>👥</span>
          <span>לקוחות</span>
        </h1>
        {counts.consent > 0 && (
          <button onClick={exportMailing} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer self-start">
            ייצוא רשימת הדיוור לאקסל ⬇
          </button>
        )}
      </div>

      {/* סיכום. לחיצה על קובייה מסננת את הטבלה */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`bg-white p-4 rounded-2xl border shadow-sm text-right cursor-pointer transition ${filter === c.key ? 'ring-2 ring-orange-500' : 'hover:border-orange-300'}`}
          >
            <span className="text-[11px] sm:text-xs font-bold text-gray-500 block">{c.label}</span>
            <span className={`text-2xl font-black ${c.color}`}>{c.value}</span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-500">
        מותר לשלוח מבצעים במייל רק ללקוחות שאישרו, ובכל מייל כזה צריך להופיע קישור הסרה. עדכונים על הזמנות נשלחים לכל מי שהזמין.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="חיפוש לפי שם, מייל או טלפון..."
        className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
      />

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-700 font-bold">
              <tr>
                <th className="p-4">שם</th>
                <th className="p-4">מייל</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">נרשם/ה לאתר</th>
                <th className="p-4">הזמנות</th>
                <th className="p-4">מבצעים במייל</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {shown.length > 0 ? (
                shown.map((c) => (
                  <tr key={c.user_id || c.email} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-black text-gray-900">{c.name || '—'}</td>
                    <td className="p-4 text-blue-600 font-bold" dir="ltr">{c.email}</td>
                    <td className="p-4" dir="ltr">{c.phone || '—'}</td>
                    <td className="p-4 text-gray-600 whitespace-nowrap">
                      {c.registered ? formatDate(c.signed_up_at || undefined) : <span className="text-gray-400">לא נרשם (הזמין כאורח)</span>}
                    </td>
                    <td className="p-4">{c.orders_count}</td>
                    <td className="p-4 whitespace-nowrap">
                      {c.consent ? (
                        <span className="flex items-center gap-2">
                          <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ אישר/ה {formatDate(c.consented_at || undefined)}</span>
                          <button onClick={() => removeFromMailing(c)} className="text-red-600 font-bold hover:underline cursor-pointer">הסרה</button>
                        </span>
                      ) : (
                        <span className="text-gray-400">לא</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    אין לקוחות להצגה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
