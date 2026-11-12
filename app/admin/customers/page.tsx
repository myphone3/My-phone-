'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { fetchAll } from '@/lib/fetchAll';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatMoney } from '@/lib/orders';
import { LoadErrorBox } from '@/components/admin/LoadErrorBox';

// מסך אחד ללקוחות ולמיילים: מיילים אוטומטיים (הפעלה/כיבוי), עגלות שלא הושלמו,
// שליחת מייל ללקוחות, ורשימת כל הלקוחות (רשומים, וגם מי שהזמין בלי להירשם).

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

type SavedCart = {
  user_id: string;
  email: string;
  name: string | null;
  items: any[];
  updated_at: string;
  reminded_at: string | null;
  consent: boolean;
  ordered_since: boolean;
};

type LogRow = { id: number; sent_at: string; kind: string; subject: string | null; recipients: number; failed: number };

type Filter = 'all' | 'consent' | 'registered' | 'guests';

const TEMPLATES = [
  {
    key: 'sale',
    label: '⚡ מבצע',
    subject: 'מבצע חדש ב-NEW PHONE ⚡',
    message: 'יש לנו מבצע חדש על מכשירים ואביזרים, לזמן מוגבל.\n\nכנסו לאתר לראות את כל המבצעים.',
    buttonText: 'למבצעים',
    buttonUrl: '/catalog',
  },
  {
    key: 'new',
    label: '📱 מוצר חדש',
    subject: 'הגיע מכשיר חדש לחנות 📱',
    message: 'שמחים לעדכן שהגיע אלינו מכשיר חדש.\n\nכל הפרטים, הגרסאות והמחיר באתר.',
    buttonText: 'לצפייה במוצר',
    buttonUrl: '/',
  },
  {
    key: 'holiday',
    label: '🎉 חג שמח',
    subject: 'חג שמח מ-NEW PHONE 🎉',
    message: 'לכבוד החג, מאחלים לכם ולכל המשפחה חג שמח!\n\nלפני החג המשלוחים יוצאים כרגיל.',
    buttonText: 'לחנות',
    buttonUrl: '/',
  },
  {
    key: 'general',
    label: '📢 עדכון',
    subject: 'עדכון מ-NEW PHONE',
    message: '',
    buttonText: '',
    buttonUrl: '',
  },
];

const KIND_LABEL: Record<string, string> = { campaign: 'מייל ללקוחות', cart: 'תזכורת עגלה', personal: 'מייל אישי' };

function ago(iso?: string | null) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `לפני ${Math.max(1, m)} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

const cartTotal = (items: any[]) => items.reduce((s, i) => s + (Number(i?.sale_price || i?.price) || 0) * (Number(i?.quantity) || 1), 0);

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' };
}

function Switch({ on, onChange, label, busy }: { on: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`relative w-12 h-7 rounded-full transition shrink-0 cursor-pointer disabled:opacity-50 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'right-1' : 'right-6'}`} />
    </button>
  );
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carts, setCarts] = useState<SavedCart[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [settings, setSettings] = useState<{ id: any; abandoned_cart_enabled: boolean; review_requests_enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingSwitch, setSavingSwitch] = useState('');
  const [remindingId, setRemindingId] = useState('');
  const [showAllCarts, setShowAllCarts] = useState(false);

  // שליחת מייל
  const [audience, setAudience] = useState<'consent' | 'selected'>('consent');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [sending, setSending] = useState<'' | 'test' | 'all'>('');
  const composeRef = useRef<HTMLDivElement>(null);

  // מייל אישי ללקוח אחד
  const [personal, setPersonal] = useState<Customer | null>(null);
  const [personalSubject, setPersonalSubject] = useState('');
  const [personalBody, setPersonalBody] = useState('');
  const [personalSending, setPersonalSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const [cust, cartRes, logRes, setRes] = await Promise.all([
      fetchAll<Customer>((a, b) => supabase.rpc('admin_list_customers').range(a, b)),
      supabase.rpc('admin_list_saved_carts'),
      supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(10),
      supabase.from('settings').select('id, abandoned_cart_enabled, review_requests_enabled').order('id').limit(1).maybeSingle(),
    ]);
    setLoadError(cust.error ? cust.error.message || 'שגיאה בטעינה' : '');
    if (!cust.error) setCustomers(cust.data);
    setCarts((cartRes.data as SavedCart[]) || []);
    setLog((logRes.data as LogRow[]) || []);
    if (setRes.data) setSettings(setRes.data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (window.location.hash === '#compose') setTimeout(() => composeRef.current?.scrollIntoView({ behavior: 'smooth' }), 400);
  }, []);

  const counts = useMemo(
    () => ({
      all: customers.length,
      consent: customers.filter((c) => c.consent).length,
      registered: customers.filter((c) => c.registered).length,
      guests: customers.filter((c) => !c.registered).length,
    }),
    [customers]
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (filter === 'all' || (filter === 'consent' ? c.consent : filter === 'registered' ? c.registered : !c.registered)) &&
        (!q || [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q)))
    );
  }, [customers, filter, search]);

  const openCarts = carts.filter((c) => !c.ordered_since);
  const sentThisMonth = log.filter((l) => new Date(l.sent_at).getMonth() === new Date().getMonth()).reduce((s, l) => s + l.recipients, 0);
  const selectedIds = Array.from(selected);
  const recipientsCount = audience === 'consent' ? counts.consent : selectedIds.length;

  const toggleSetting = async (key: 'abandoned_cart_enabled' | 'review_requests_enabled', value: boolean) => {
    if (!settings) return;
    setSavingSwitch(key);
    const { error } = await supabase.from('settings').update({ [key]: value }).eq('id', settings.id);
    setSavingSwitch('');
    if (error) return showToast('השמירה נכשלה: ' + error.message, { kind: 'error' });
    setSettings({ ...settings, [key]: value });
    showToast(value ? 'הופעל ✓' : 'כובה', { kind: 'success' });
  };

  const remindNow = async (cart: SavedCart) => {
    if (!confirm(`לשלוח עכשיו מייל תזכורת ל-${cart.email}?`)) return;
    setRemindingId(cart.user_id);
    try {
      const res = await fetch('/api/admin/cart-reminder', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ userId: cart.user_id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      showToast('התזכורת נשלחה ✓', { kind: 'success' });
      load();
    } catch (e: any) {
      showToast('לא נשלח: ' + e.message, { kind: 'error' });
    } finally {
      setRemindingId('');
    }
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setSubject(t.subject);
    setMessage(t.message);
    setButtonText(t.buttonText);
    setButtonUrl(t.buttonUrl);
  };

  const sendCampaign = async (test: boolean) => {
    if (!subject.trim() || !message.trim()) return showToast('נא למלא נושא ותוכן', { kind: 'error' });
    if (!test) {
      if (!recipientsCount) return showToast(audience === 'selected' ? 'לא סימנת לקוחות בטבלה' : 'אין עדיין לקוחות שאישרו מבצעים', { kind: 'error' });
      if (!confirm(`לשלוח את המייל ל-${recipientsCount} לקוחות?`)) return;
    }
    setSending(test ? 'test' : 'all');
    try {
      const res = await fetch('/api/admin/campaign', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ subject, message, buttonText, buttonUrl, test, userIds: audience === 'selected' ? selectedIds : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      if (test) showToast('נשלח עותק ניסיון לתיבת המייל של החנות ✓', { kind: 'success' });
      else {
        showToast(`נשלח ל-${data.sent} לקוחות${data.failed ? ` (${data.failed} נכשלו)` : ''} ✓`, { kind: 'success' });
        setSelected(new Set());
        load();
      }
    } catch (e: any) {
      showToast('השליחה נכשלה: ' + e.message, { kind: 'error' });
    } finally {
      setSending('');
    }
  };

  const sendPersonal = async () => {
    if (!personal || !personalSubject.trim() || !personalBody.trim()) return showToast('נא למלא נושא ותוכן', { kind: 'error' });
    setPersonalSending(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ to: personal.email, subject: personalSubject, message: personalBody }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'שגיאה');
      await supabase.from('email_log').insert({ kind: 'personal', subject: personalSubject, recipients: 1, failed: 0 });
      showToast('המייל נשלח ✓', { kind: 'success' });
      setPersonal(null);
      load();
    } catch (e: any) {
      showToast('השליחה נכשלה: ' + e.message, { kind: 'error' });
    } finally {
      setPersonalSending(false);
    }
  };

  const removeFromMailing = async (c: Customer) => {
    if (!c.user_id || !confirm(`להסיר את ${c.email} מרשימת המבצעים במייל?`)) return;
    const { data, error } = await supabase.rpc('admin_unsubscribe_marketing', { p_user_id: c.user_id });
    if (error || !data) return showToast('ההסרה נכשלה' + (error ? ': ' + error.message : ''), { kind: 'error' });
    showToast('הלקוח הוסר מרשימת המבצעים', { kind: 'success' });
    load();
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportList = () =>
    downloadCsv('customers.csv', [
      ['שם', 'מייל', 'טלפון', 'רשום', 'הזמנות', 'אישר מבצעים'],
      ...shown.map((c) => [c.name || '', c.email, c.phone || '', c.registered ? 'כן' : 'לא', String(c.orders_count), c.consent ? 'כן' : 'לא']),
    ]);

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl" role="status" aria-label="טוען">
        <span className="skeleton h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <span className="skeleton h-40 rounded-3xl" />
        <span className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }
  if (loadError) return <LoadErrorBox error={loadError} what="הלקוחות" onRetry={load} />;

  const tiles: { label: string; value: number | string; color: string; onClick?: () => void; active?: boolean }[] = [
    { label: 'לקוחות', value: counts.all, color: 'text-gray-900', onClick: () => setFilter('all'), active: filter === 'all' },
    { label: 'אישרו מבצעים במייל', value: counts.consent, color: 'text-green-600', onClick: () => setFilter('consent'), active: filter === 'consent' },
    { label: 'עגלות פתוחות', value: openCarts.length, color: 'text-orange-600', onClick: () => document.getElementById('carts')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'מיילים שנשלחו החודש', value: sentThisMonth, color: 'text-blue-600', onClick: () => document.getElementById('email-log')?.scrollIntoView({ behavior: 'smooth' }) },
  ];

  const cartsShown = showAllCarts ? carts : carts.slice(0, 4);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">👥 לקוחות ומיילים</h1>
        <button
          type="button"
          onClick={() => composeRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
        >
          ✉️ מייל חדש
        </button>
      </div>

      {/* סיכום */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.onClick}
            className={`bg-white p-4 rounded-2xl border shadow-sm text-right cursor-pointer transition ${t.active ? 'ring-2 ring-orange-500' : 'hover:border-orange-300'}`}
          >
            <span className="text-[11px] font-bold text-gray-500 block">{t.label}</span>
            <span className={`text-2xl font-black ${t.color}`}>{t.value}</span>
          </button>
        ))}
      </div>

      {/* מיילים אוטומטיים */}
      <section className="bg-white rounded-3xl border shadow-sm divide-y">
        <h2 className="px-5 py-3.5 text-sm font-black text-gray-900">🤖 מיילים אוטומטיים</h2>
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <b className="text-xs font-black text-gray-900 block">אישור הזמנה ועדכוני סטטוס</b>
            <span className="text-[11px] text-gray-500">כל לקוח שמזמין מקבל אישור עם PDF, ומייל בכל שינוי סטטוס (נשלח, נמסר...)</span>
          </div>
          <span className="text-[11px] font-black text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full shrink-0">תמיד פעיל</span>
        </div>
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <b className="text-xs font-black text-gray-900 block">🛒 תזכורת על עגלה שלא הושלמה</b>
            <span className="text-[11px] text-gray-500">
              פעם ביום (בערב), ללקוח רשום שאישר מבצעים והשאיר מוצרים בעגלה בין 3 שעות ל-7 ימים. כל עגלה מקבלת תזכורת אחת בלבד.
            </span>
          </div>
          <Switch
            label="תזכורת עגלה"
            on={settings?.abandoned_cart_enabled ?? true}
            busy={!settings || savingSwitch === 'abandoned_cart_enabled'}
            onChange={(v) => toggleSetting('abandoned_cart_enabled', v)}
          />
        </div>
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <b className="text-xs font-black text-gray-900 block">⭐ בקשת ביקורת אחרי מסירה</b>
            <span className="text-[11px] text-gray-500">יום אחרי שההזמנה סומנה כהושלמה (או 5 ימים אחרי שנשלחה), פעם אחת לכל הזמנה</span>
          </div>
          <Switch
            label="בקשת ביקורת"
            on={settings?.review_requests_enabled ?? true}
            busy={!settings || savingSwitch === 'review_requests_enabled'}
            onChange={(v) => toggleSetting('review_requests_enabled', v)}
          />
        </div>
      </section>

      {/* עגלות שלא הושלמו */}
      <section id="carts" className="bg-white rounded-3xl border shadow-sm scroll-mt-4">
        <div className="px-5 py-3.5 flex items-center justify-between gap-2 border-b">
          <h2 className="text-sm font-black text-gray-900">🛒 עגלות שלא הושלמו ({openCarts.length})</h2>
          <span className="text-[11px] text-gray-400">לקוחות רשומים, 30 הימים האחרונים</span>
        </div>
        {carts.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">אין כרגע עגלות פתוחות</p>
        ) : (
          <div className="divide-y">
            {cartsShown.map((c) => {
              const items = Array.isArray(c.items) ? c.items : [];
              const status = c.ordered_since
                ? { text: '✓ הזמין אחר כך', cls: 'bg-green-50 text-green-700' }
                : c.reminded_at && c.reminded_at >= c.updated_at
                  ? { text: `תזכורת נשלחה ${ago(c.reminded_at)}`, cls: 'bg-blue-50 text-blue-700' }
                  : !c.consent
                    ? { text: 'לא אישר מבצעים', cls: 'bg-gray-100 text-gray-500' }
                    : { text: 'ממתין לתזכורת', cls: 'bg-orange-50 text-orange-700' };
              return (
                <div key={c.user_id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex -space-x-2 space-x-reverse shrink-0">
                    {items.slice(0, 3).map((i, k) => (
                      <span key={k} className="w-9 h-9 rounded-lg bg-gray-50 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                        {i?.image || i?.image_url ? <img src={i.image || i.image_url} alt="" className="max-w-full max-h-full object-contain" /> : '📦'}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-[10rem]">
                    <b className="text-xs font-black text-gray-900 block truncate">{c.name || c.email}</b>
                    <span className="text-[11px] text-gray-500">
                      {items.length} מוצרים · {formatMoney(cartTotal(items))} · עודכנה {ago(c.updated_at)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${status.cls}`}>{status.text}</span>
                  {c.consent && !c.ordered_since && (
                    <button
                      type="button"
                      onClick={() => remindNow(c)}
                      disabled={remindingId === c.user_id}
                      className="text-[11px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {remindingId === c.user_id ? 'שולח...' : 'שליחת תזכורת עכשיו'}
                    </button>
                  )}
                </div>
              );
            })}
            {carts.length > 4 && (
              <button type="button" onClick={() => setShowAllCarts((v) => !v)} className="w-full py-2.5 text-[11px] font-black text-orange-700 hover:bg-orange-50 cursor-pointer">
                {showAllCarts ? 'פחות' : `לכל ${carts.length} העגלות`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* שליחת מייל */}
      <section id="compose" ref={composeRef} className="bg-white rounded-3xl border shadow-sm p-5 space-y-4 scroll-mt-4">
        <h2 className="text-sm font-black text-gray-900">✉️ שליחת מייל ללקוחות</h2>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className={`flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer ${audience === 'consent' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-100'}`}>
            <input type="radio" name="audience" checked={audience === 'consent'} onChange={() => setAudience('consent')} className="accent-orange-600" />
            <span className="text-xs font-bold text-gray-800">כל מי שאישר מבצעים ({counts.consent})</span>
          </label>
          <label className={`flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer ${audience === 'selected' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-100'}`}>
            <input type="radio" name="audience" checked={audience === 'selected'} onChange={() => setAudience('selected')} className="accent-orange-600" />
            <span className="text-xs font-bold text-gray-800">רק מי שסימנתי בטבלה למטה ({selectedIds.length})</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => applyTemplate(t)} className="bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-700 cursor-pointer">
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="נושא המייל"
          maxLength={150}
          className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-bold outline-none focus:border-orange-600"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="תוכן המייל. שורה ריקה מתחילה פסקה חדשה. הפנייה בשם (שלום דוד,) מתווספת לבד."
          rows={5}
          className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
        />
        <div className="grid grid-cols-5 gap-2">
          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="טקסט לכפתור (רשות)"
            maxLength={40}
            className="col-span-2 bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
          />
          <input
            value={buttonUrl}
            onChange={(e) => setButtonUrl(e.target.value)}
            placeholder="קישור, למשל /product/... או https://..."
            dir="ltr"
            className="col-span-3 bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
          />
        </div>

        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl p-3">
          לפי החוק, מייל פרסומי נשלח רק ללקוחות שאישרו קבלת מבצעים. כל לקוח מקבל מייל אישי משלו, עם קישור להסרה מהרשימה.
          למייל שירות ללקוח אחד (גם מי שלא אישר), לחצו על ✉️ בשורה שלו בטבלה.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => sendCampaign(true)}
            disabled={!!sending}
            className="sm:flex-1 bg-white border-2 border-orange-200 text-orange-700 py-3 rounded-2xl text-xs font-black cursor-pointer disabled:opacity-50"
          >
            {sending === 'test' ? 'שולח...' : 'שליחת ניסיון אליי'}
          </button>
          <button
            type="button"
            onClick={() => sendCampaign(false)}
            disabled={!!sending || !recipientsCount}
            className="sm:flex-[2] bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-sm font-black cursor-pointer shadow-md disabled:opacity-50"
          >
            {sending === 'all' ? 'שולח...' : `🚀 שליחה ל-${recipientsCount} לקוחות`}
          </button>
        </div>
      </section>

      {/* כל הלקוחות */}
      <section className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-4 space-y-3 border-b">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', `הכל (${counts.all})`],
                ['consent', `אישרו מבצעים (${counts.consent})`],
                ['registered', `רשומים (${counts.registered})`],
                ['guests', `הזמינו בלי הרשמה (${counts.guests})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${filter === key ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={exportList} className="mr-auto text-[11px] font-bold text-green-700 hover:underline cursor-pointer">
              ייצוא לאקסל ⬇
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, מייל או טלפון..."
            className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-600 font-bold">
              <tr>
                <th className="p-3 w-8" title="סימון למייל">✓</th>
                <th className="p-3">לקוח</th>
                <th className="p-3">טלפון</th>
                <th className="p-3">הזמנות</th>
                <th className="p-3">מבצעים במייל</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {shown.length ? (
                shown.map((c) => (
                  <tr key={c.user_id || c.email} className="hover:bg-gray-50 transition">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        disabled={!c.consent || !c.user_id}
                        checked={!!c.user_id && selected.has(c.user_id)}
                        onChange={() => {
                          if (!c.user_id) return;
                          toggleSelect(c.user_id);
                          setAudience('selected');
                        }}
                        title={c.consent ? 'סימון לשליחת מייל' : 'לא אישר מבצעים במייל'}
                        className="w-4 h-4 accent-orange-600 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="p-3">
                      <b className="font-black text-gray-900 block">{c.name || '—'}</b>
                      <span className="text-blue-600" dir="ltr">{c.email}</span>
                      <span className="block text-[10px] text-gray-400">
                        {c.registered ? `נרשם ${formatDate(c.signed_up_at || undefined)}` : 'הזמין בלי הרשמה'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap" dir="ltr">{c.phone || '—'}</td>
                    <td className="p-3">
                      {c.orders_count > 0 ? (
                        <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="text-orange-700 font-bold hover:underline whitespace-nowrap">
                          {c.orders_count} ←
                        </Link>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {c.consent ? (
                        <span className="flex items-center gap-2">
                          <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ אישר</span>
                          <button type="button" onClick={() => removeFromMailing(c)} className="text-red-600 text-[11px] font-bold hover:underline cursor-pointer">
                            הסרה
                          </button>
                        </span>
                      ) : (
                        <span className="text-gray-400">לא</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPersonal(c);
                          setPersonalSubject('');
                          setPersonalBody(`שלום ${(c.name || '').split(' ')[0] || ''},\n\n`);
                        }}
                        title="מייל אישי ללקוח"
                        aria-label={`מייל אישי ל-${c.email}`}
                        className="w-8 h-8 rounded-lg hover:bg-orange-50 cursor-pointer"
                      >
                        ✉️
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    לא נמצאו לקוחות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* נשלחו לאחרונה */}
      <section id="email-log" className="bg-white rounded-3xl border shadow-sm scroll-mt-4">
        <h2 className="px-5 py-3.5 text-sm font-black text-gray-900 border-b">📜 נשלחו לאחרונה מהפאנל</h2>
        {log.length ? (
          <div className="divide-y">
            {log.map((l) => (
              <div key={l.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                <span className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">{KIND_LABEL[l.kind] || l.kind}</span>
                <span className="flex-1 min-w-0 truncate font-bold text-gray-800">{l.subject}</span>
                <span className="text-gray-500 shrink-0">
                  {l.recipients} נמענים{l.failed ? ` · ${l.failed} נכשלו` : ''}
                </span>
                <span className="text-gray-400 shrink-0 hidden sm:inline">{formatDate(l.sent_at, true)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-center text-xs text-gray-400">עדיין לא נשלחו מיילים מהמסך הזה</p>
        )}
      </section>

      {/* חלון מייל אישי */}
      {personal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-3" onClick={() => setPersonal(null)}>
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="מייל אישי">
            <div className="flex items-center justify-between">
              <b className="text-sm font-black text-gray-900">✉️ מייל אישי</b>
              <button type="button" onClick={() => setPersonal(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="סגירה">
                ✕
              </button>
            </div>
            <p className="text-[11px] text-gray-500" dir="ltr">{personal.email}</p>
            <input
              value={personalSubject}
              onChange={(e) => setPersonalSubject(e.target.value)}
              placeholder="נושא"
              className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-bold outline-none focus:border-orange-600"
            />
            <textarea
              value={personalBody}
              onChange={(e) => setPersonalBody(e.target.value)}
              rows={6}
              className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
            />
            <button
              type="button"
              onClick={sendPersonal}
              disabled={personalSending}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-sm font-black cursor-pointer disabled:opacity-50"
            >
              {personalSending ? 'שולח...' : 'שליחה'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
