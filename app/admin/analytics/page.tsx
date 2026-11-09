'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { addDays, startOfDay } from '@/lib/stats';
import { downloadCsv } from '@/lib/csv';
import { BestSellers, CompareTile, OrdersByTime, SummaryPanel, TrendChart } from '@/components/admin/AnalyticsWidgets';

// סטטיסטיקה של האתר: מי באתר עכשיו, כמה נכנסו, מה הכי נצפה, איפה לקוחות נוטשים, מאיפה הם מגיעים ומה הם מחפשים.
// הנתונים נאספים באתר עצמו (lib/track.ts), בלי Google Analytics. מנהלים לא נספרים.

type Tab = 'summary' | 'live' | 'overview' | 'sales' | 'products' | 'sources' | 'hours' | 'searches' | 'visitors';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: '📋 סיכום יומי ושבועי' },
  { key: 'live', label: '🟢 עכשיו באתר' },
  { key: 'overview', label: '📊 פעילות לאורך זמן' },
  { key: 'sales', label: '🏆 מכירות' },
  { key: 'products', label: '📦 מוצרים' },
  { key: 'sources', label: '📍 מקורות ומכשירים' },
  { key: 'hours', label: '⏰ שעות וימים' },
  { key: 'searches', label: '🔎 חיפושים' },
  { key: 'visitors', label: '👤 מבקרים' },
];

const PERIODS = [
  { key: 'today', label: 'היום' },
  { key: 'yesterday', label: 'אתמול' },
  { key: '7', label: '7 ימים' },
  { key: '30', label: '30 ימים' },
  { key: 'month', label: 'החודש' },
  { key: 'lastmonth', label: 'חודש שעבר' },
  { key: '90', label: '90 ימים' },
  { key: '365', label: 'שנה' },
  { key: 'custom', label: '📅 בחירת תאריכים' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => n(v).toLocaleString('he-IL');
const money = (v: any) => `₪${Math.round(n(v)).toLocaleString('he-IL')}`;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const dayInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function range(key: PeriodKey, custom: { from: string; to: string }) {
  const today = startOfDay(new Date());
  if (key === 'today') return { from: today, to: addDays(today, 1) };
  if (key === 'yesterday') return { from: addDays(today, -1), to: today };
  if (key === 'month') return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
  if (key === 'lastmonth') return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 1) };
  if (key === 'custom') {
    const f = parseDay(custom.from) || addDays(today, -6);
    const t = parseDay(custom.to) || today;
    return f <= t ? { from: f, to: addDays(t, 1) } : { from: t, to: addDays(f, 1) };
  }
  return { from: addDays(today, -(Number(key) - 1)), to: addDays(today, 1) };
}

// התקופה הקודמת באותו אורך, להשוואה
function previousRange(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - ms), to: new Date(from) };
}

function duration(sec: number) {
  if (sec < 60) return `${Math.round(sec)} שנ׳`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} דק׳`;
  return `${Math.floor(m / 60)} שע׳ ${m % 60} דק׳`;
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.floor(s / 3600)} שע׳`;
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

const visitorLabel = (v: any) => v?.name || v?.email || `מבקר #${String(v?.visitor_id || '').slice(-4).toUpperCase()}`;

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, 'דף הבית'],
  [/^\/cart/, 'עגלה / קופה'],
  [/^\/search/, 'חיפוש'],
  [/^\/category\//, 'קטגוריה'],
  [/^\/categories/, 'כל הקטגוריות'],
  [/^\/brand\//, 'מותג'],
  [/^\/product\//, 'עמוד מוצר'],
  [/^\/quiz/, 'שאלון התאמה'],
  [/^\/compare/, 'השוואה'],
  [/^\/(terms|privacy|returns|accessibility)/, 'עמוד מידע'],
];
function pageName(path?: string | null, product?: string | null) {
  if (!path) return '';
  if (product) return `📦 ${product}`;
  const hit = PAGE_NAMES.find(([re]) => re.test(path));
  let extra = '';
  try {
    if (/^\/(category|brand)\//.test(path)) extra = `: ${decodeURIComponent(path.split('/')[2] || '')}`;
  } catch {
    extra = '';
  }
  return hit ? hit[1] + extra : path;
}

const EVENT_LABELS: Record<string, string> = {
  page_view: '👁️ נכנס לעמוד',
  product_view: '📦 צפה במוצר',
  add_to_cart: '🛒 הוסיף לעגלה',
  checkout_start: '💳 התחיל קופה',
  order: '✅ ביצע הזמנה',
  search: '🔎 חיפש',
  compare: '⚖️ הוסיף להשוואה',
  favorite: '♥ שמר במועדפים',
  quiz_done: '🧭 סיים את השאלון',
  whatsapp_click: '💬 לחץ על וואטסאפ',
};

// ===== רכיבי תצוגה קטנים =====

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-orange-100 shadow-sm space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-sm sm:text-base text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone = 'text-gray-900' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-orange-50 rounded-2xl border border-orange-200 p-3 min-w-0">
      <span className="block text-[11px] font-bold text-orange-900 truncate">{label}</span>
      <span className={`block text-xl sm:text-2xl font-black mt-0.5 tabular-nums truncate ${tone}`}>{value}</span>
      {sub && <span className="block text-[11px] text-orange-800/70 truncate">{sub}</span>}
    </div>
  );
}

// פס אופקי: שם, ערך, ופס יחסי לערך הגבוה
function BarList({ rows, format = fmt, empty = 'אין נתונים עדיין' }: { rows: { label: string; value: number; note?: string }[]; format?: (v: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-xs text-gray-400 py-4 text-center">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.label + i} className="text-xs" title={`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
          <div className="flex justify-between gap-2 mb-1">
            <span className="font-bold text-gray-800 truncate" dir="auto">
              {r.label}
            </span>
            <span className="text-gray-600 tabular-nums shrink-0">
              {format(r.value)}
              {r.note && <span className="text-gray-400"> · {r.note}</span>}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ===== הדף =====

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const [period, setPeriod] = useState<PeriodKey>('7');
  const [custom, setCustom] = useState(() => ({ from: dayInput(addDays(new Date(), -6)), to: dayInput(new Date()) }));
  const [data, setData] = useState<any>(null);
  const [prevData, setPrevData] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [visitors, setVisitors] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<{ visitor: any; events: any[] | null } | null>(null);
  const [productSort, setProductSort] = useState<'views' | 'carts' | 'sold' | 'gap'>('views');

  const { from, to } = useMemo(() => range(period, custom), [period, custom]);

  const loadPeriod = useCallback(async () => {
    setLoading(true);
    const res = await supabase.rpc('admin_analytics', { p_from: from.toISOString(), p_to: to.toISOString() });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setError('');
    setData(res.data);
    const prev = previousRange(from, to);
    const p = await supabase.rpc('admin_analytics', { p_from: prev.from.toISOString(), p_to: prev.to.toISOString() });
    setPrevData(p.error ? null : p.data);
  }, [from, to]);

  const loadLive = useCallback(async () => {
    const res = await supabase.rpc('admin_live');
    if (res.error) setError(res.error.message);
    else setLive(res.data);
  }, []);

  const loadVisitors = useCallback(async () => {
    setVisitors(null);
    const res = await supabase.rpc('admin_visitors', { p_from: from.toISOString(), p_to: to.toISOString() });
    if (!res.error) setVisitors((res.data as any[]) || []);
    else setVisitors([]);
  }, [from, to]);

  useEffect(() => {
    loadPeriod();
  }, [loadPeriod]);

  useEffect(() => {
    if (tab === 'visitors') loadVisitors();
  }, [tab, loadVisitors]);

  // "עכשיו באתר" מתרענן כל 15 שניות
  useEffect(() => {
    loadLive();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadLive();
    }, 15000);
    return () => clearInterval(t);
  }, [loadLive]);

  const openTimeline = async (visitor: any) => {
    setTimeline({ visitor, events: null });
    const res = await supabase.rpc('admin_visitor_timeline', { p_visitor: visitor.visitor_id });
    setTimeline({ visitor, events: (res.data as any[]) || [] });
  };

  const k = data?.kpis || {};
  const funnel = data?.funnel || {};
  const online: any[] = live?.online || [];
  const openCarts: any[] = live?.open_carts || [];

  const products: any[] = useMemo(() => {
    const list = [...(data?.products || [])].map((p: any) => ({
      ...p,
      gap: n(p.views) >= 5 && n(p.sold) === 0 ? n(p.views) : 0,
    }));
    return list.sort((a, b) => n(b[productSort]) - n(a[productSort]));
  }, [data, productSort]);

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of data?.hours || []) grid[n(c.dow)][n(c.hour)] = n(c.n);
    const max = Math.max(1, ...grid.flat());
    let best = { dow: 0, hour: 0, v: 0 };
    grid.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { dow: d, hour: h, v })));
    const byDay = grid.map((row) => row.reduce((a, b) => a + b, 0));
    const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((a, row) => a + row[h], 0));
    return { grid, max, best, byDay, byHour };
  }, [data]);

  const conversion = pct(n(k.orders), n(k.sessions));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-black text-gray-900">📈 סטטיסטיקה של האתר</h1>
          <p className="text-[11px] text-gray-500">מנהלים לא נספרים · לקוחות מחוברים שאישרו עוגיות מופיעים בשם</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${period === p.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <span className="flex items-center gap-1 text-xs">
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="bg-white border rounded-lg px-2 py-1" aria-label="מתאריך" />
              <span>עד</span>
              <input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="bg-white border rounded-lg px-2 py-1" aria-label="עד תאריך" />
            </span>
          )}
          <button
            onClick={() => {
              loadPeriod();
              loadLive();
              if (tab === 'visitors') loadVisitors();
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-orange-200 text-orange-700 cursor-pointer"
          >
            🔄 {loading ? 'טוען...' : 'רענון'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs space-y-1">
          <b className="block">לא הצלחנו לטעון את הסטטיסטיקה</b>
          <span className="block">
            אם זו הפעם הראשונה: צריך להריץ ב-Supabase את הקובץ <code dir="ltr">supabase/2026-11-analytics.sql</code>.
          </span>
          <span className="block text-red-600/70" dir="ltr">
            {error}
          </span>
        </div>
      )}

      {/* פס עליון קבוע: עכשיו באתר */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setTab('live')} className="text-right bg-green-50 border-2 border-green-300 rounded-2xl p-3 cursor-pointer">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-900">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600" />
            </span>
            עכשיו באתר
          </span>
          <span className="block text-2xl font-black text-green-800 tabular-nums">{fmt(online.length)}</span>
          <span className="block text-[11px] text-green-800/70">{fmt(live?.today_visitors)} מבקרים היום</span>
        </button>
        <CompareTile label="מבקרים בתקופה" value={fmt(k.visitors)} now={n(k.visitors)} before={prevData ? n(prevData.kpis?.visitors) : undefined} sub={`${fmt(k.sessions)} ביקורים`} />
        <CompareTile label="הזמנות" value={fmt(k.orders)} now={n(k.orders)} before={prevData ? n(prevData.kpis?.orders) : undefined} sub={`${conversion}% קנו`} />
        <CompareTile label="הכנסות" value={money(k.revenue)} now={n(k.revenue)} before={prevData ? n(prevData.kpis?.revenue) : undefined} sub={k.orders ? `ממוצע ${money(n(k.revenue) / n(k.orders))}` : ''} />
      </div>

      {/* לשוניות */}
      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
              tab === t.key ? 'bg-orange-600 text-white' : 'bg-white border border-orange-100 text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {prevData && tab !== 'summary' && tab !== 'live' && <p className="text-[10px] text-gray-400 -mt-2">↑↓ = שינוי לעומת התקופה הקודמת באותו אורך</p>}

      {/* ===== סיכום יומי ושבועי ===== */}
      {tab === 'summary' && <SummaryPanel />}

      {/* ===== מכירות ===== */}
      {tab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="🏆 המוצרים הכי נמכרים בתקופה">
            <BestSellers from={from} to={to} />
          </Card>
          <Card title="📅 מכירות לפי ימים ושעות">
            <OrdersByTime from={from} to={to} />
          </Card>
        </div>
      )}

      {/* ===== עכשיו באתר ===== */}
      {tab === 'live' && (
        <div className="space-y-4">
          <Card title={`🟢 גולשים באתר ברגע זה (${online.length})`} action={<span className="text-[10px] text-gray-400">מתרענן כל 15 שניות</span>}>
            {online.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">אין כרגע גולשים באתר</p>
            ) : (
              <ul className="divide-y divide-orange-50">
                {online.map((s) => (
                  <li key={s.session_id}>
                    <button onClick={() => openTimeline(s)} className="w-full text-right py-3 flex items-center gap-3 hover:bg-orange-50/50 -mx-2 px-2 rounded-xl cursor-pointer">
                      <span className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-sm ${s.name || s.email ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {s.name || s.email ? String(s.name || s.email).charAt(0).toUpperCase() : '?'}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-black text-gray-900 truncate">{visitorLabel(s)}</span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          נמצא ב: <b className="text-gray-700">{pageName(s.path, s.product)}</b>
                        </span>
                        <span className="block text-[10px] text-gray-400 truncate">
                          {s.device} · {s.browser} · הגיע מ{s.source || 'ישיר'} · {fmt(s.page_views)} עמודים · {duration((new Date(s.last_seen).getTime() - new Date(s.started_at).getTime()) / 1000)} באתר
                        </span>
                      </span>
                      {n(s.cart_items) > 0 && (
                        <span className="shrink-0 text-[11px] font-black bg-amber-100 text-amber-900 px-2 py-1 rounded-lg">
                          🛒 {s.cart_items} · {money(s.cart_value)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`🛒 עגלות פתוחות ב-24 השעות האחרונות (${openCarts.length})`}>
            <p className="text-[11px] text-gray-500 -mt-1">לקוחות שהוסיפו מוצרים לעגלה ועוד לא הזמינו. שווי כולל: {money(openCarts.reduce((a, c) => a + n(c.cart_value), 0))}</p>
            {openCarts.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">אין עגלות פתוחות</p>
            ) : (
              <ul className="divide-y divide-orange-50">
                {openCarts.map((c) => (
                  <li key={c.visitor_id}>
                    <button onClick={() => openTimeline(c)} className="w-full text-right py-2.5 flex items-center justify-between gap-3 hover:bg-orange-50/50 -mx-2 px-2 rounded-xl cursor-pointer">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-gray-900 truncate">{visitorLabel(c)}</span>
                        <span className="block text-[11px] text-gray-400">{ago(c.last_seen)}</span>
                      </span>
                      <span className="text-xs font-black text-gray-800 shrink-0">
                        {c.cart_items} מוצרים · {money(c.cart_value)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-gray-400">לקוחות רשומים שאישרו דיוור מקבלים תזכורת אוטומטית במייל.</p>
          </Card>
        </div>
      )}

      {/* ===== סקירה ===== */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompareTile label="צפיות בעמודים" value={fmt(k.page_views)} now={n(k.page_views)} before={prevData ? n(prevData.kpis?.page_views) : undefined} sub={`${k.avg_pages || 0} עמודים בממוצע לביקור`} />
            <Tile label="זמן ממוצע באתר" value={duration(n(k.avg_seconds))} sub="לכל ביקור" />
            <Tile label="יצאו אחרי עמוד אחד" value={`${fmt(k.bounce)}%`} sub="ככל שנמוך יותר, טוב יותר" />
            <Tile label="מבקרים חוזרים" value={fmt(k.returning)} sub={`${pct(n(k.returning), n(k.visitors))}% מהמבקרים`} />
            <CompareTile label="צפיות במוצרים" value={fmt(k.product_views)} now={n(k.product_views)} before={prevData ? n(prevData.kpis?.product_views) : undefined} />
            <CompareTile label="הוספות לעגלה" value={fmt(k.add_to_cart)} now={n(k.add_to_cart)} before={prevData ? n(prevData.kpis?.add_to_cart) : undefined} />
            <Tile label="לקוחות מחוברים" value={fmt(k.signed_in)} sub="שאישרו עוגיות" />
            <Tile label="אחוז המרה" value={`${conversion}%`} sub="ביקורים שהסתיימו בהזמנה" tone="text-green-700" />
          </div>

          <Card title="📈 פעילות לאורך זמן">
            <TrendChart from={from} to={to} />
          </Card>

          <Card title="🔻 משפך הקנייה: איפה לקוחות נוטשים?">
            {(() => {
              const steps = [
                { label: 'נכנסו לאתר', v: n(funnel.visit) },
                { label: 'צפו במוצר', v: n(funnel.product) },
                { label: 'הוסיפו לעגלה', v: n(funnel.cart) },
                { label: 'התחילו קופה', v: n(funnel.checkout) },
                { label: 'הזמינו', v: n(funnel.order) },
              ];
              const top = Math.max(1, steps[0].v);
              let worst = { i: -1, drop: 0 };
              steps.forEach((s, i) => {
                if (i === 0 || !steps[i - 1].v) return;
                const drop = 100 - pct(s.v, steps[i - 1].v);
                if (drop > worst.drop) worst = { i, drop };
              });
              return (
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3 text-xs" title={`${s.label}: ${fmt(s.v)}`}>
                      <span className="w-24 shrink-0 font-bold text-gray-700">{s.label}</span>
                      <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-lg flex items-center px-2 text-white font-black" style={{ width: `${Math.max(14, (s.v / top) * 100)}%` }}>
                          {fmt(s.v)}
                        </div>
                      </div>
                      <span className={`w-20 shrink-0 text-left tabular-nums ${i === worst.i ? 'text-red-600 font-black' : 'text-gray-500'}`}>
                        {i === 0 ? '100%' : `${pct(s.v, steps[i - 1].v)}% המשיכו`}
                      </span>
                    </div>
                  ))}
                  {worst.i > 0 && steps[0].v >= 10 && (
                    <p className="text-[11px] bg-red-50 border border-red-100 text-red-800 rounded-xl p-2.5">
                      💡 הנטישה הכי גדולה: בין &quot;{steps[worst.i - 1].label}&quot; ל&quot;{steps[worst.i].label}&quot; ({Math.round(worst.drop)}% עזבו). כדאי לבדוק את השלב הזה.
                    </p>
                  )}
                </div>
              );
            })()}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="העמודים הכי נצפים">
              <BarList rows={(data?.pages || []).slice(0, 10).map((p: any) => ({ label: pageName(p.path), value: n(p.n) }))} />
            </Card>
            <Card title="פעולות של לקוחות">
              <BarList
                rows={[
                  { label: '💬 לחיצות על וואטסאפ', value: n(data?.actions?.whatsapp_click) },
                  { label: '⚖️ הוספה להשוואה', value: n(data?.actions?.compare) },
                  { label: '🧭 סיימו את השאלון', value: n(data?.actions?.quiz_done) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ===== מוצרים ===== */}
      {tab === 'products' && (
        <Card
          title="📦 מה קורה עם כל מוצר"
          action={
            <button
              onClick={() =>
                downloadCsv(
                  'product-stats.csv',
                  [['מוצר', 'צפיות', 'מבקרים שצפו', 'הוספות לעגלה', 'נמכרו'], ...products.map((p) => [p.name, n(p.views), n(p.viewers), n(p.carts), n(p.sold)])]
                )
              }
              className="text-[11px] font-bold text-orange-700 cursor-pointer"
            >
              ⬇️ הורדה לאקסל
            </button>
          }
        >
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['views', 'הכי נצפים'],
              ['carts', 'הכי הרבה לעגלה'],
              ['sold', 'הכי נמכרים'],
              ['gap', 'מסתכלים ולא קונים'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setProductSort(key as any)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${productSort === key ? 'bg-gray-900 text-white' : 'bg-gray-50 border text-gray-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {products.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">עדיין אין צפיות במוצרים בתקופה הזו</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-right p-2 font-bold">מוצר</th>
                    <th className="p-2 font-bold">צפיות</th>
                    <th className="p-2 font-bold">אנשים</th>
                    <th className="p-2 font-bold">לעגלה</th>
                    <th className="p-2 font-bold">נמכרו</th>
                    <th className="p-2 font-bold">מצפייה לעגלה</th>
                  </tr>
                </thead>
                <tbody>
                  {(productSort === 'gap' ? products.filter((p) => p.gap > 0) : products).map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-orange-50/40">
                      <td className="p-2">
                        <Link href={`/product/${p.id}`} target="_blank" className="flex items-center gap-2 min-w-0">
                          <span className="w-9 h-9 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                            {p.image && <img src={p.image} alt="" className="max-h-full object-contain" />}
                          </span>
                          <span className="font-bold text-gray-800 line-clamp-2" dir="auto">
                            {p.name}
                          </span>
                        </Link>
                      </td>
                      <td className="p-2 text-center tabular-nums font-black">{fmt(p.views)}</td>
                      <td className="p-2 text-center tabular-nums">{fmt(p.viewers)}</td>
                      <td className="p-2 text-center tabular-nums">{fmt(p.carts)}</td>
                      <td className="p-2 text-center tabular-nums font-black text-green-700">{fmt(p.sold)}</td>
                      <td className="p-2 text-center tabular-nums">
                        {n(p.views) ? `${pct(n(p.carts), n(p.views))}%` : '—'}
                        {p.gap > 0 && <span className="block text-[10px] font-bold text-red-600">👀 צופים ולא קונים</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-gray-500">
            💡 מוצר שהרבה צופים בו ומעט מוסיפים לעגלה: כדאי לבדוק את המחיר, התמונות והתיאור, או להוסיף אותו ל&quot;מבצע השבוע&quot;.
          </p>
        </Card>
      )}

      {/* ===== מקורות ומכשירים ===== */}
      {tab === 'sources' && (
        <div className="space-y-4">
          <Card title="📍 מאיפה הגיעו המבקרים">
            {(data?.sources || []).length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">אין נתונים עדיין</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs min-w-[420px]">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="text-right p-2 font-bold">מקור</th>
                      <th className="p-2 font-bold">ביקורים</th>
                      <th className="p-2 font-bold">הזמנות</th>
                      <th className="p-2 font-bold">המרה</th>
                      <th className="p-2 font-bold">הכנסות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.sources || []).map((s: any) => (
                      <tr key={s.source} className="border-b border-gray-50">
                        <td className="p-2 font-bold text-gray-800">{s.source}</td>
                        <td className="p-2 text-center tabular-nums">{fmt(s.sessions)}</td>
                        <td className="p-2 text-center tabular-nums">{fmt(s.orders)}</td>
                        <td className="p-2 text-center tabular-nums">{pct(n(s.orders), n(s.sessions))}%</td>
                        <td className="p-2 text-center tabular-nums font-black">{money(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-500">
              💡 כדי לדעת בדיוק איזה פרסום הביא לקוחות, צרו קישור במסך <Link href="/admin/campaigns" className="underline">קישורי פרסום</Link>. כניסה מוואטסאפ מופיעה לפעמים כ&quot;ישיר&quot;, כי וואטסאפ לא תמיד מוסר מאיפה הגיעו.
            </p>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="📱 מכשירים">
              <BarList rows={(data?.devices || []).map((d: any) => ({ label: d.name, value: n(d.n), note: `${pct(n(d.n), n(k.sessions))}%` }))} />
            </Card>
            <Card title="🌐 דפדפנים">
              <BarList rows={(data?.browsers || []).map((d: any) => ({ label: d.name, value: n(d.n), note: `${pct(n(d.n), n(k.sessions))}%` }))} />
            </Card>
          </div>
        </div>
      )}

      {/* ===== שעות וימים ===== */}
      {tab === 'hours' && (
        <div className="space-y-4">
          <Card title="⏰ מתי הכי הרבה גולשים">
            {heat.best.v > 0 ? (
              <p className="text-xs bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-orange-900">
                💡 השעה הכי עמוסה: <b>יום {DAYS[heat.best.dow]} בשעה {heat.best.hour}:00</b>. זה זמן טוב לפרסם מבצע או לשלוח מייל.
              </p>
            ) : (
              <p className="text-xs text-gray-400">אין נתונים עדיין</p>
            )}
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="min-w-[560px] space-y-[2px]" dir="ltr">
                {heat.grid.map((row, d) => (
                  <div key={d} className="flex items-center gap-[2px]">
                    {row.map((v, h) => (
                      <span
                        key={h}
                        title={`יום ${DAYS[d]} ${h}:00 · ${v} צפיות`}
                        className="flex-1 h-6 rounded-[3px]"
                        style={{ backgroundColor: v ? `rgba(234, 88, 12, ${0.12 + 0.88 * (v / heat.max)})` : '#f3f4f6' }}
                      />
                    ))}
                    <span className="w-6 text-[10px] text-gray-500 font-bold text-center">{DAYS[d]}</span>
                  </div>
                ))}
                <div className="flex gap-[2px] pr-7 text-[9px] text-gray-400">
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} className="flex-1 text-center">
                      {h % 3 === 0 ? h : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-500" dir="ltr">
              <span>מעט</span>
              {[0.15, 0.4, 0.65, 1].map((o) => (
                <span key={o} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(234, 88, 12, ${o})` }} />
              ))}
              <span>הרבה</span>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="צפיות לפי יום בשבוע">
              <BarList rows={heat.byDay.map((v, d) => ({ label: `יום ${DAYS[d]}`, value: v }))} />
            </Card>
            <Card title="הזמנות לפי שעה">
              <BarList
                rows={(data?.order_hours || [])
                  .slice()
                  .sort((a: any, b: any) => n(a.hour) - n(b.hour))
                  .map((r: any) => ({ label: `${r.hour}:00`, value: n(r.n) }))}
                empty="עדיין אין הזמנות בתקופה"
              />
            </Card>
          </div>
        </div>
      )}

      {/* ===== חיפושים ===== */}
      {tab === 'searches' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="❌ חיפשו ולא מצאו">
            <p className="text-[11px] text-gray-500 -mt-1">כדאי להוסיף את המוצרים האלה לחנות, או לשנות שמות של מוצרים כך שיימצאו.</p>
            <BarList
              rows={(data?.searches || []).filter((s: any) => n(s.results) === 0).map((s: any) => ({ label: s.query, value: n(s.n) }))}
              empty="כל החיפושים מצאו תוצאות 🎉"
            />
          </Card>
          <Card title="🔎 החיפושים הנפוצים">
            <BarList rows={(data?.searches || []).slice(0, 20).map((s: any) => ({ label: s.query, value: n(s.n), note: `${fmt(s.results)} תוצאות` }))} />
          </Card>
        </div>
      )}

      {/* ===== מבקרים ===== */}
      {tab === 'visitors' && (
        <Card title={`👤 מבקרים בתקופה${visitors ? ` (${visitors.length})` : ''}`}>
          <p className="text-[11px] text-gray-500 -mt-1">לחיצה על מבקר מציגה כל מה שעשה באתר, לפי הסדר.</p>
          {visitors === null ? (
            <p className="text-xs text-gray-400 py-6 text-center">טוען...</p>
          ) : visitors.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">אין מבקרים בתקופה הזו</p>
          ) : (
            <ul className="divide-y divide-orange-50">
              {visitors.map((v) => (
                <li key={v.visitor_id}>
                  <button onClick={() => openTimeline(v)} className="w-full text-right py-2.5 flex items-center gap-3 hover:bg-orange-50/50 -mx-2 px-2 rounded-xl cursor-pointer">
                    <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${v.name || v.email ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {v.name || v.email ? String(v.name || v.email).charAt(0).toUpperCase() : '?'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-gray-900 truncate">
                        {visitorLabel(v)}
                        {n(v.sessions) > 1 && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mr-1.5">חוזר · {v.sessions} ביקורים</span>}
                      </span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {v.device || ''} · הגיע מ{v.source || 'ישיר'} · {fmt(v.page_views)} עמודים · {fmt(v.products)} מוצרים
                      </span>
                    </span>
                    <span className="shrink-0 text-left">
                      <span className="block text-[11px] text-gray-400">{ago(v.last_seen)}</span>
                      {n(v.orders) > 0 ? (
                        <span className="block text-[10px] font-black text-green-700">✅ הזמין</span>
                      ) : n(v.carts) > 0 ? (
                        <span className="block text-[10px] font-black text-amber-700">🛒 הוסיף לעגלה</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ===== מה עשה המבקר ===== */}
      {timeline && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setTimeline(null)}>
          <div className="bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-gray-900 truncate">{visitorLabel(timeline.visitor)}</h3>
                {timeline.visitor.email && <p className="text-[11px] text-gray-500 truncate">{timeline.visitor.email}</p>}
              </div>
              <button onClick={() => setTimeline(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 shrink-0 cursor-pointer" aria-label="סגירה">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto -mx-1 px-1">
              {timeline.events === null ? (
                <p className="text-xs text-gray-400 py-6 text-center">טוען...</p>
              ) : timeline.events.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">אין פעולות</p>
              ) : (
                <ol className="space-y-0">
                  {timeline.events.map((e, i) => {
                    const prev = timeline.events![i - 1];
                    const newVisit = prev && prev.session_id !== e.session_id;
                    return (
                      <React.Fragment key={i}>
                        {newVisit && <li className="text-[10px] font-bold text-gray-400 text-center py-2">── ביקור קודם ──</li>}
                        <li className="flex gap-3 py-1.5 text-xs border-r-2 border-orange-100 pr-3">
                          <span className="text-[10px] text-gray-400 w-16 shrink-0 tabular-nums">
                            {new Date(e.created_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="min-w-0">
                            <span className="font-bold text-gray-800">{EVENT_LABELS[e.type] || e.type}</span>{' '}
                            <span className="text-gray-500" dir="auto">
                              {e.type === 'search'
                                ? `"${e.query}" (${fmt(e.results)} תוצאות)`
                                : e.product
                                  ? e.product
                                  : e.type === 'page_view'
                                    ? pageName(e.path)
                                    : ''}
                              {e.value ? ` · ${money(e.value)}` : ''}
                            </span>
                          </span>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
