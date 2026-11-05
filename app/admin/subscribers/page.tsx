'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { fetchAll } from '@/lib/fetchAll';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/orders';
import { LoadErrorBox, isMissingTable } from '@/components/admin/LoadErrorBox';

type Row = { user_id: string; email: string; name: string | null; consent: boolean; consented_at: string | null; updated_at: string };

// רשימת הלקוחות שאישרו קבלת מבצעים במייל (חוק הספאם: שולחים רק למי שאישר)
export default function SubscribersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await fetchAll<Row>((a, b) =>
      supabase.from('marketing_consents').select('user_id, email, name, consent, consented_at, updated_at').order('updated_at', { ascending: false }).order('user_id').range(a, b)
    );
    setLoadError(error ? (isMissingTable(error) ? 'missing' : error.message || 'שגיאה בטעינה') : '');
    if (!error) setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (r: Row) => {
    if (!confirm(`להסיר את ${r.email} מרשימת המבצעים?`)) return;
    const { data, error } = await supabase.rpc('admin_unsubscribe_marketing', { p_user_id: r.user_id });
    if (error || !data) return showToast('ההסרה נכשלה' + (error ? ': ' + error.message : ''), { kind: 'error' });
    showToast('הלקוח הוסר מהרשימה', { kind: 'success' });
    load();
  };

  if (loading) return <div className="text-center py-20 text-gray-500" dir="rtl">טוען...</div>;
  if (loadError) return <LoadErrorBox error={loadError} what="רשימת הדיוור" onRetry={load} />;

  const subscribed = rows.filter((r) => r.consent);
  const shown = showRemoved ? rows : subscribed;

  const exportCsv = () =>
    downloadCsv('subscribers.csv', [
      ['שם', 'מייל', 'תאריך אישור'],
      ...subscribed.map((r) => [r.name || '', r.email, formatDate(r.consented_at || undefined)]),
    ]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">📧 רשימת דיוור</h1>
          <p className="text-xs text-gray-500 mt-1">
            לקוחות שאישרו בהרשמה לקבל מבצעים במייל. מותר לשלוח מבצעים רק להם, ובכל מייל צריך להופיע קישור הסרה.
          </p>
        </div>
        {subscribed.length > 0 && (
          <button onClick={exportCsv} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0">
            ייצוא לאקסל ⬇
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black text-base text-gray-900">ברשימה: {subscribed.length}</h3>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} className="accent-orange-600" />
            להציג גם מי שהוסר ({rows.length - subscribed.length})
          </label>
        </div>
        {shown.length === 0 && <p className="text-xs text-gray-500">עדיין אין לקוחות ברשימה.</p>}
        {shown.map((r) => (
          <div key={r.user_id} className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${r.consent ? '' : 'opacity-50'}`}>
            <div className="min-w-0 text-sm">
              <div className="font-black text-gray-900 truncate">{r.name || r.email}</div>
              <div className="text-xs text-gray-500 truncate" dir="ltr">{r.email}</div>
              <div className="text-[11px] text-gray-400">
                {r.consent ? `אישר/ה ב-${formatDate(r.consented_at || undefined)}` : `הוסר/ה ב-${formatDate(r.updated_at)}`}
              </div>
            </div>
            {r.consent && (
              <button onClick={() => remove(r)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0">
                הסרה מהרשימה
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
