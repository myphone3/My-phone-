'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/lib/csv';
import { fetchAll } from '@/lib/fetchAll';
import { LoadErrorBox } from '@/components/admin/LoadErrorBox';
import { Order, orderTotals } from '@/lib/orders';
import { isCountedOrder } from '@/lib/stats';
import { showToast } from '@/lib/toast';

type Campaign = {
  id: string;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
};

const EMPTY = { code: '', name: '', start_date: '', end_date: '', budget: '' };
const money = (n: number) => `₪${Math.round(n).toLocaleString()}`;

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [visits, setVisits] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<(Order & { ref?: string | null })[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missingTables, setMissingTables] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    const [c, v, o] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.rpc('campaign_visit_counts'),
      fetchAll((from, to) => supabase.from('orders').select('*').not('ref', 'is', null).order('id').range(from, to)),
    ]);
    setMissingTables(!!c.error);
    if (c.data) setCampaigns(c.data as Campaign[]);
    // בלי נתונים מלאים לא מציגים מדדים ולא מייצאים (כדי לא להציג מספרים חסרים)
    const failed = v.error || o.error;
    setLoadError(failed ? failed.message || 'שגיאה בטעינה' : '');
    if (!failed) {
      const counts: Record<string, number> = {};
      ((v.data as any[]) || []).forEach((row) => (counts[row.code] = Number(row.visits) || 0));
      setVisits(counts);
      setOrders(o.data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () =>
      campaigns.map((c) => {
        const own = orders.filter((o) => o.ref === c.code && isCountedOrder(o));
        const revenue = own.reduce((s, o) => s + orderTotals(o).total, 0);
        const budget = Number(c.budget) || 0;
        const clicks = visits[c.code] || 0;
        return { ...c, clicks, purchases: own.length, revenue, profit: revenue - budget, conversion: clicks ? (own.length / clicks) * 100 : 0 };
      }),
    [campaigns, orders, visits]
  );

  // לחיצה על מקום הפרסום ממלאת שם וקוד לבד (למשל facebook-11-26)
  const SOURCES = [
    { key: 'facebook', label: 'פייסבוק', icon: '📘' },
    { key: 'instagram', label: 'אינסטגרם', icon: '📸' },
    { key: 'whatsapp', label: 'וואטסאפ', icon: '💬' },
    { key: 'google', label: 'גוגל', icon: '🔎' },
    { key: 'tiktok', label: 'טיקטוק', icon: '🎵' },
    { key: 'flyer', label: 'פלאייר / שלט', icon: '📄' },
  ];
  const pickSource = (src: { key: string; label: string }) => {
    const d = new Date();
    const month = d.toLocaleDateString('he-IL', { month: 'long' });
    let code = `${src.key}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(2)}`;
    const taken = new Set(campaigns.map((c) => c.code));
    for (let n = 2; taken.has(code); n++) code = `${src.key}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(2)}-${n}`;
    setForm({ ...form, code, name: `${src.label} ${month}` });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(code)) {
      showToast('הקוד יכול להכיל רק אותיות באנגלית, מספרים, מקף וקו תחתון', { kind: 'error' });
      return;
    }
    const payload = {
      code,
      name: form.name.trim() || code,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget === '' ? null : Number(form.budget),
    };
    const { error } = editingId
      ? await supabase.from('campaigns').update(payload).eq('id', editingId)
      : await supabase.from('campaigns').insert(payload);
    if (error) {
      showToast(error.code === '23505' ? 'כבר יש קמפיין עם הקוד הזה' : 'שגיאה בשמירה: ' + error.message, { kind: 'error' });
      return;
    }
    showToast('הקמפיין נשמר', { kind: 'success' });
    setForm(EMPTY);
    setEditingId(null);
    load();
  };

  const edit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, start_date: c.start_date || '', end_date: c.end_date || '', budget: c.budget?.toString() || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`למחוק את הקמפיין "${c.name}"? הנתונים של ההזמנות נשארים.`)) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', c.id);
    if (error) showToast('שגיאה במחיקה: ' + error.message, { kind: 'error' });
    else load();
  };

  const linkFor = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${code}`;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      showToast('הקישור הועתק 📋', { kind: 'success' });
    } catch {
      showToast(linkFor(code), { kind: 'info' });
    }
  };

  const exportCsv = () =>
    downloadCsv('campaigns.csv', [
      ['קמפיין', 'קוד', 'מתאריך', 'עד תאריך', 'תקציב', 'כניסות', 'רכישות', 'אחוז המרה', 'הכנסות', 'רווח (הכנסות פחות תקציב)'],
      ...rows.map((r) => [r.name, r.code, r.start_date || '', r.end_date || '', Number(r.budget) || 0, r.clicks, r.purchases, r.conversion.toFixed(1), Math.round(r.revenue), Math.round(r.profit)]),
    ]);

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium" dir="rtl">טוען קמפיינים...</div>;

  if (!missingTables && loadError) return <LoadErrorBox error={loadError} what="נתוני הקמפיינים" onRetry={load} />;
  if (missingTables) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-sm text-amber-900 font-bold" dir="rtl">
        מסך הקמפיינים יעבוד אחרי שיתווספו לבסיס הנתונים הטבלאות שלו (קובץ ה-SQL שהוכן).
      </div>
    );
  }

  const input = 'w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600';

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-xl font-black text-gray-900">📣 קישורי פרסום</h1>
        <p className="text-xs text-gray-500">
          קישור מיוחד לכל פרסום. כך רואים כמה אנשים נכנסו מכל פרסום וכמה מהם קנו.
        </p>
      </div>

      <form onSubmit={save} className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
        <h3 className="font-black text-base text-gray-900">{editingId ? 'עריכת קישור' : 'קישור חדש: איפה מפרסמים?'}</h3>
        {!editingId && (
          <div className="grid grid-cols-3 gap-2">
            {SOURCES.map((src) => (
              <button
                key={src.key}
                type="button"
                onClick={() => pickSource(src)}
                className={`rounded-2xl border p-3 text-center cursor-pointer transition ${
                  form.code.startsWith(src.key + '-') ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white hover:border-orange-300 text-gray-800'
                }`}
              >
                <span className="block text-xl">{src.icon}</span>
                <span className="block text-[11px] font-bold mt-0.5">{src.label}</span>
              </button>
            ))}
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">שם (בשבילך)</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="למשל: פייסבוק נובמבר" className={input} />
        </div>

        <button type="button" onClick={() => setShowMore((v) => !v)} className="text-xs font-bold text-gray-500 cursor-pointer">
          {showMore ? '▾' : '◂'} אפשרויות נוספות (קוד, תאריכים, תקציב)
        </button>
        {(showMore || editingId) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קוד בקישור (אותיות באנגלית)</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="facebook-nov" className={input} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תקציב הפרסום (₪)</label>
              <input type="number" inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="500" className={input} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מתאריך</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">עד תאריך</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={input} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={!form.code} className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-sm font-black cursor-pointer">
            {editingId ? 'שמירת שינויים' : 'יצירת הקישור'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-3 rounded-xl text-sm font-bold cursor-pointer">
              ביטול
            </button>
          )}
        </div>
        {!form.code && !editingId && <p className="text-[11px] text-gray-400">בוחרים למעלה איפה מפרסמים, והקישור מוכן.</p>}
      </form>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-base text-gray-900">הקישורים שלך</h3>
          {rows.length > 0 && (
            <button onClick={exportCsv} className="bg-white border border-orange-200 text-orange-700 hover:bg-orange-50 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
              ייצוא לאקסל ⬇
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">עדיין אין קישורים. בוחרים למעלה איפה מפרסמים.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="border rounded-2xl p-4 space-y-3">
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-gray-900">{r.name}</div>
                    {(r.start_date || r.end_date) && (
                      <div className="text-[11px] text-gray-400">{r.start_date || '…'} – {r.end_date || '…'}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => edit(r)} className="text-gray-500 hover:text-gray-800 px-2 py-1 text-xs font-bold cursor-pointer">עריכה</button>
                    <button onClick={() => remove(r)} className="text-red-500 hover:text-red-700 px-2 py-1 text-xs font-bold cursor-pointer">מחיקה</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl p-2">
                  <span className="flex-1 min-w-0 truncate text-xs text-gray-700" dir="ltr">{linkFor(r.code)}</span>
                  <button onClick={() => copy(r.code)} className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-xs font-black cursor-pointer">
                    העתקה 📋
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['נכנסו', String(r.clicks)],
                    ['קנו', `${r.purchases}${r.clicks ? ` (${r.conversion.toFixed(0)}%)` : ''}`],
                    ['הכנסות', money(r.revenue)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl py-2">
                      <div className="text-[11px] text-gray-500">{label}</div>
                      <div className="text-sm font-black text-gray-900">{value}</div>
                    </div>
                  ))}
                </div>
                {Number(r.budget) > 0 && (
                  <div className={`text-[11px] font-bold ${r.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    תקציב {money(Number(r.budget))} · {r.profit >= 0 ? 'הרווחת' : 'הפסד של'} {money(Math.abs(r.profit))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
