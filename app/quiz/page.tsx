'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getBestSellers } from '@/lib/shop';
import { BUSINESS } from '@/lib/business';
import { track } from '@/lib/track';
import { FeatureKey, FEATURES, VersionInfo, resolveVersion } from '@/lib/versionGuide';
import { versionName } from '@/lib/versionPrice';
import { KosherPlayMark, VersionMark, WhatsAppIcon } from '@/components/Logos';
import Icon from '@/components/Icon';
import { PHONE_CERT } from '@/components/KosherExplainer';

// "איזה מכשיר מתאים לי?": שאלות קצרות שמשתנות לפי התשובות, ובסוף 3 המלצות מהחנות:
// המכשיר, הגרסה המדויקת שמתאימה (לפי מה שצריך שיהיה פתוח), לוגו הכשרות, ולמה הוא מתאים.

type Answers = {
  type?: 'phone' | 'player' | 'any';
  who?: 'me' | 'senior' | 'kid' | 'gift';
  level?: 'kosher' | 'support' | 'open' | 'unsure';
  cert?: string; // שם הכשרות, או 'any'
  needs?: FeatureKey[];
  budget?: string; // 'min-max' או 'any'
  extras?: string[];
};

type StepKey = 'type' | 'who' | 'level' | 'cert' | 'needs' | 'budget' | 'extras';

// המוצרים שרלוונטיים לפי מה שכבר נענה (לפיהם בונים את שאלת הכשרות ואת טווחי המחיר)
function poolFor(a: Answers, products: any[]) {
  const kinds =
    a.type === 'player'
      ? ['player']
      : a.level === 'kosher'
        ? ['kosher']
        : a.level === 'support'
          ? ['support']
          : a.level === 'open'
            ? ['open']
            : ['kosher', 'support', 'open'];
  return products.filter((p) => kinds.includes(kindOf(p)));
}

// הכשרויות שקיימות בפועל במוצרים האלה. בטלפונים יש רק ועדת הרבנים, ולכן לא שואלים
const certsIn = (pool: any[]) => Array.from(new Set(pool.map((p) => String(p.kosher || '').trim()).filter(Boolean)));

const roundTo50 = (n: number) => Math.round(n / 50) * 50;
const shekel = (n: number) => `₪${n.toLocaleString('he-IL')}`;

// טווחי מחיר לפי המחירים האמיתיים של המוצרים הרלוונטיים (שלושה טווחים בערך שווים)
function budgetsFor(pool: any[]): { key: string; label: string }[] | null {
  const prices = pool.map(priceOf).filter((x) => x > 0).sort((x, y) => x - y);
  if (prices.length < 3) return null;
  const lo = prices[0];
  const hi = prices[prices.length - 1];
  if (hi < lo * 1.25) return null;
  const edges = Array.from(new Set([prices[Math.floor(prices.length / 3)], prices[Math.floor((prices.length * 2) / 3)]].map(roundTo50)))
    .filter((e) => e > lo && e < hi)
    .sort((x, y) => x - y);
  if (!edges.length) return null;
  const out: { key: string; label: string }[] = [{ key: `0-${edges[0]}`, label: `עד ${shekel(edges[0])}` }];
  if (edges[1]) out.push({ key: `${edges[0]}-${edges[1]}`, label: `${shekel(edges[0])} – ${shekel(edges[1])}` });
  const last = edges[edges.length - 1];
  out.push({ key: `${last}-999999`, label: `מעל ${shekel(last)}` });
  out.push({ key: 'any', label: 'לא משנה לי' });
  return out;
}

// אילו שאלות מוצגות, לפי מה שכבר נענה ולפי המוצרים שבחנות
function stepsFor(a: Answers, products: any[]): StepKey[] {
  const steps: StepKey[] = ['type'];
  const pool = poolFor(a, products);
  const askCert = certsIn(pool).length > 1;
  const askBudget = !products.length || !!budgetsFor(pool);
  if (a.type === 'player') {
    if (askCert) steps.push('cert');
    if (askBudget) steps.push('budget');
    return steps;
  }
  steps.push('who', 'level');
  if (a.level === 'kosher' && askCert) steps.push('cert');
  if (a.level === 'support' || a.level === 'unsure' || a.level === 'open') steps.push('needs');
  if (askBudget) steps.push('budget');
  steps.push('extras');
  return steps;
}

const NEED_OPTIONS: { key: FeatureKey; label: string; icon: React.ReactNode; note?: string }[] = [
  { key: 'sms', label: 'הודעות SMS', icon: 'sms' },
  { key: 'camera', label: 'מצלמה', icon: 'camera' },
  { key: 'music', label: 'שירים ושיעורים', icon: 'music' },
  { key: 'whatsapp', label: 'וואטסאפ', icon: <WhatsAppIcon size={30} color="#25D366" />, note: 'כשר פליי' },
  { key: 'navigation', label: 'Waze / מוביט', icon: 'map', note: 'כשר פליי' },
];


const EXTRAS: { key: string; label: string; icon: string; re: RegExp; reason: string }[] = [
  { key: 'battery', label: 'סוללה חזקה', icon: 'battery', re: /סוללה|mah|battery/i, reason: 'סוללה חזקה' },
  { key: 'screen', label: 'מסך גדול / מגע', icon: 'screen', re: /מסך גדול|מסך מגע|טאץ|touch|אינץ/i, reason: 'מסך גדול' },
  { key: 'buttons', label: 'מקשים גדולים', icon: 'keypad', re: /מקשים|כפתורים|מקלדת|מבוגר/i, reason: 'מקשים נוחים' },
  { key: 'rugged', label: 'קטן ועמיד', icon: 'shield', re: /עמיד|מוקשח|ip6[78]|קומפקטי|קטן|flip|פליפ/i, reason: 'קטן ועמיד' },
  { key: 'dualsim', label: '2 כרטיסי סים', icon: 'sim', re: /2 כרטיסי|שני כרטיסי|dual ?sim|2 סים/i, reason: '2 כרטיסי סים' },
];

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const textOf = (p: any) =>
  [p.name, p.category, p.brand, p.tags, p.kosher, p.short_description, p.description, p.specs, p.spec_battery, p.spec_storage]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;
const versionsOf = (p: any) => asArray(p.product_variants || p.versions || p.product_versions || p.variants).map(versionName).filter(Boolean);

function kindOf(p: any) {
  const t = textOf(p);
  const cat = String(p.category || '');
  if (/נגן|mp3|mp4/i.test(cat) || /^נגן|נגן mp/i.test(p.name || '')) return 'player';
  if (/אביזר|כיסו|מטע[ןנ]|מגן מסך|אוזני|כבל|רמקול|שעו|מעמד|זיכרון|כרטיס|סוללה|מתאם/.test(cat)) return 'accessory';
  if (/תומך/.test(cat) || /תומך כשר/.test(t)) return 'support';
  if (/כשר/.test(cat) || p.kosher) return 'kosher';
  if (/סמארטפון|smartphone|iphone|galaxy/i.test(t)) return 'open';
  if (versionsOf(p).length) return 'support';
  // רק קטגוריות של טלפונים נחשבות מכשיר; כל השאר אביזרים
  return /טלפון|מכשיר|סלולר|פלאפון/.test(cat) ? 'kosher' : 'accessory';
}

type Result = {
  p: any;
  s: number;
  reasons: string[];
  missing: string[];
  version?: VersionInfo;
};

function score(p: any, a: Answers, best: Set<string>, versionRows: any[]): Result {
  const t = textOf(p);
  const kind = kindOf(p);
  let s = 0;
  const reasons: string[] = [];
  const missing: string[] = [];

  // סוג המכשיר: סינון קשיח
  if (kind === 'accessory') s -= 50;
  if (a.type === 'player') kind === 'player' ? ((s += 8), reasons.push('נגן')) : (s -= 50);
  if (a.type === 'phone' && kind === 'player') s -= 50;

  // רמת הכשרות
  if (a.level === 'kosher') kind === 'kosher' ? ((s += 8), reasons.push('מכשיר כשר')) : (s -= 30);
  if (a.level === 'support') kind === 'support' ? ((s += 8), reasons.push('תומך כשר')) : kind === 'open' ? (s -= 30) : (s -= 6);
  if (a.level === 'open') kind === 'open' ? ((s += 8), reasons.push('סמארטפון פתוח')) : kind === 'support' ? (s += 1) : (s -= 20);

  // כשרות מסוימת (לפי הלוגו שבחרו)
  if (a.cert && a.cert !== 'any') {
    if (String(p.kosher || '').trim() === a.cert) {
      s += 6;
      reasons.push(`כשרות ${a.cert}`);
    } else s -= 8;
  }

  // מה צריך שיהיה פתוח: מוצאים את הגרסה הכי פשוטה של המוצר שיש בה את כל מה שצריך
  let version: VersionInfo | undefined;
  const needs = a.needs || [];
  const names = versionsOf(p);
  if (needs.length) {
    const infos = names.map((n) => resolveVersion(n, versionRows)).filter((v) => !/רגיל|פתוח/.test(v.name) || a.level === 'open');
    const fits = infos
      .filter((v) => needs.every((k) => v.features[k] === 'yes'))
      .sort((x, y) => Object.values(x.features).filter((f) => f === 'yes').length - Object.values(y.features).filter((f) => f === 'yes').length);
    if (fits.length) {
      version = fits[0];
      s += 4 + needs.length * 2;
      reasons.push(`גרסת ${version.title} מתאימה`);
    } else if (kind === 'open') {
      s += needs.length;
    } else if (infos.length) {
      // אין גרסה שמכסה הכל: מציעים את הגרסה שמכסה הכי הרבה
      const ranked = infos
        .map((v) => ({ v, hit: needs.filter((k) => v.features[k] === 'yes').length }))
        .sort((x, y) => y.hit - x.hit);
      version = ranked[0].hit ? ranked[0].v : undefined;
      s += (ranked[0]?.hit || 0) * 2 - (needs.length - (ranked[0]?.hit || 0)) * 5;
      needs.filter((k) => version?.features[k] !== 'yes').forEach((k) => missing.push(FEATURES.find((f) => f.key === k)?.label || k));
    } else {
      // מכשיר בלי גרסאות: לפי התיאור
      for (const k of needs) {
        const f = FEATURES.find((x) => x.key === k);
        const re = k === 'whatsapp' ? /וואטסאפ|ווטסאפ|whatsapp/i : k === 'navigation' ? /waze|ווייז|ניווט|מוביט/i : k === 'camera' ? /מצלמה|camera/i : k === 'sms' ? /sms|הודעות/i : /נגן|mp3|שירים|שיעורים/i;
        if (re.test(t)) s += 2;
        else {
          s -= 5;
          if (f) missing.push(f.label);
        }
      }
    }
  } else if (names.length) {
    // לא ביקשו כלום מיוחד: הגרסה הכי פשוטה
    const infos = names.map((n) => resolveVersion(n, versionRows)).filter((v) => !/רגיל|פתוח/.test(v.name));
    version = infos.sort((x, y) => Object.values(x.features).filter((f) => f === 'yes').length - Object.values(y.features).filter((f) => f === 'yes').length)[0];
  }

  // תקציב
  if (a.budget && a.budget !== 'any' && /^\d+-\d+$/.test(a.budget)) {
    const [min, max] = a.budget.split('-').map(Number);
    const price = priceOf(p);
    if (price >= min && price <= max) {
      s += 5;
      reasons.push('בתקציב שלכם');
    } else if (price > max && price <= max * 1.15) s += 1;
    else if (price < min) s += 1;
    else s -= 6;
  }

  // תוספות
  for (const key of a.extras || []) {
    const e = EXTRAS.find((x) => x.key === key);
    if (e && e.re.test(t)) {
      s += 2;
      reasons.push(e.reason);
    }
  }

  if (a.who === 'senior' && /מבוגר|מקשים גדולים|כפתורים גדולים|sos|פשוט/.test(t)) {
    s += 3;
    reasons.push('מתאים למבוגרים');
  }
  if (a.who === 'kid' && /ילד|נוער|בסיסי|פשוט|עמיד/.test(t)) {
    s += 3;
    reasons.push('מתאים לילדים ונוער');
  }

  const out = p.stock !== null && p.stock !== undefined && p.stock !== '' && Number(p.stock) <= 0;
  if (out) s -= 15;
  if (best.has(String(p.id))) {
    s += 1;
    reasons.push('מהנמכרים ביותר');
  }
  if (p.sale_price && Number(p.sale_price) < Number(p.price)) {
    s += 1;
    reasons.push('במבצע עכשיו');
  }
  return { p, s, reasons: Array.from(new Set(reasons)).slice(0, 5), missing, version };
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative p-4 rounded-2xl border-2 text-sm font-black flex flex-col items-center justify-center gap-2 text-center transition cursor-pointer min-h-[104px] ${
        selected ? 'border-orange-600 bg-orange-50 text-orange-800 shadow-sm' : 'border-gray-100 bg-white hover:border-orange-300 text-gray-800'
      }`}
    >
      {selected && <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">✓</span>}
      {children}
    </button>
  );
}

const Emoji = ({ c }: { c: string }) => <Icon name={c} size={30} className="text-orange-600" strokeWidth={1.5} />;

export default function QuizPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [versionRows, setVersionRows] = useState<any[]>([]);
  const [best, setBest] = useState<Set<string>>(new Set());

  const steps = stepsFor(answers, products);
  const done = stepIdx >= steps.length;
  const step = steps[stepIdx];

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .or('is_published.is.null,is_published.eq.true')
      .then(({ data }) => setProducts(data || []));
    supabase
      .from('kosher_options')
      .select('*')
      .then(({ data }) => setKosherList(data || []));
    supabase
      .from('versions')
      .select('*')
      .then(({ data }) => setVersionRows(data || []));
    getBestSellers().then(setBest);
  }, []);

  useEffect(() => {
    if (!done) return;
    track('quiz_done');
    // ההתראה "המלצת מכשיר" באזור האישי כבר לא צריכה להופיע
    try {
      const saved = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
      const list = Array.isArray(saved) ? saved : [];
      if (!list.includes('quiz')) localStorage.setItem('dismissedNotifications', JSON.stringify([...list, 'quiz']));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch {
      // ignore
    }
  }, [done]);

  // רק הכשרויות שיש להן מוצרים מהסוג שנבחר (בטלפונים: ועדת הרבנים בלבד)
  const pool = useMemo(() => poolFor(answers, products), [answers, products]);
  const certs = useMemo(() => {
    const used = new Set(certsIn(pool));
    return kosherList.filter((k) => used.has(String(k.name).trim()));
  }, [kosherList, pool]);
  const phoneCerts = useMemo(() => certsIn(products.filter((p) => kindOf(p) === 'kosher')), [products]);
  const phoneCertName = phoneCerts[0] || PHONE_CERT;
  const budgets = useMemo(() => budgetsFor(pool) || [], [pool]);
  const logoOf = (name?: string) => kosherList.find((k) => String(k.name).trim() === String(name || '').trim())?.image_url || '';
  const kosherPlayLogo = versionRows.find((r) => /כשר ?פליי/.test(r?.name) && r?.image_url)?.image_url;

  const results = useMemo(() => {
    if (!done) return [];
    return products
      .map((p) => score(p, answers, best, versionRows))
      .filter((r) => r.s > -20)
      .sort((x, y) => y.s - x.s)
      .slice(0, 3);
  }, [done, products, answers, best, versionRows]);

  const next = (patch: Partial<Answers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setStepIdx((i) => i + 1);
  };
  const toggle = (key: 'needs' | 'extras', value: string) =>
    setAnswers((a) => {
      const cur = (a[key] || []) as string[];
      return { ...a, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  const restart = () => {
    setAnswers({});
    setStepIdx(0);
  };

  const summary = [
    answers.type === 'player' ? 'נגן' : answers.type === 'phone' ? 'טלפון' : '',
    ({ me: 'בשבילי', senior: 'למבוגרים', kid: 'לילד/נער', gift: 'מתנה' } as Record<string, string>)[answers.who || ''] || '',
    ({ kosher: 'כשר', support: 'תומך כשר', open: 'פתוח', unsure: '' } as Record<string, string>)[answers.level || ''] || '',
    answers.cert && answers.cert !== 'any' ? `כשרות ${answers.cert}` : '',
    (answers.needs || []).map((k) => NEED_OPTIONS.find((n) => n.key === k)?.label).join(', '),
    budgets.find((b) => b.key === answers.budget && b.key !== 'any')?.label || '',
    (answers.extras || []).map((k) => EXTRAS.find((e) => e.key === k)?.label).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const playNeeded = (answers.needs || []).some((k) => k === 'whatsapp' || k === 'navigation');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center justify-center gap-2"><Icon name="compass" size={30} className="text-orange-600" /> איזה מכשיר מתאים לי?</h1>
        <p className="text-sm text-gray-500">כמה שאלות קצרות, ונמליץ על המכשיר והגרסה המדויקת מהחנות</p>
      </div>

      {/* התקדמות */}
      <div className="max-w-md mx-auto space-y-1">
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition ${i < stepIdx ? 'bg-orange-600' : i === stepIdx ? 'bg-orange-300' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {!done ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">
              שאלה {stepIdx + 1} מתוך {steps.length}
            </span>
            {stepIdx > 0 && (
              <button onClick={() => setStepIdx((s) => s - 1)} className="text-xs font-bold text-orange-700 cursor-pointer">
                → חזרה
              </button>
            )}
          </div>

          {step === 'type' && (
            <>
              <h2 className="text-xl font-black text-gray-900">מה אתם מחפשים?</h2>
              <div className="grid grid-cols-3 gap-3">
                <OptionButton selected={answers.type === 'phone'} onClick={() => next({ type: 'phone' })}>
                  <Emoji c="phone" /> טלפון
                </OptionButton>
                <OptionButton selected={answers.type === 'player'} onClick={() => next({ type: 'player', level: undefined, needs: [], extras: [] })}>
                  <Emoji c="headphones" /> נגן MP3 / MP4
                </OptionButton>
                <OptionButton selected={answers.type === 'any'} onClick={() => next({ type: 'any' })}>
                  <Emoji c="help" /> עוד לא בטוח
                </OptionButton>
              </div>
            </>
          )}

          {step === 'who' && (
            <>
              <h2 className="text-xl font-black text-gray-900">למי המכשיר?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ['me', 'user', 'בשבילי'],
                  ['senior', 'users', 'להורים / מבוגרים'],
                  ['kid', 'child', 'לילד או נער'],
                  ['gift', 'gift', 'מתנה'],
                ] as const).map(([k, icon, label]) => (
                  <OptionButton key={k} selected={answers.who === k} onClick={() => next({ who: k })}>
                    <Emoji c={icon} /> {label}
                  </OptionButton>
                ))}
              </div>
            </>
          )}

          {step === 'level' && (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900">איזה סוג מכשיר?</h2>
                <p className="text-xs text-gray-500 mt-1">
                  לא בטוחים?{' '}
                  <Link href="/guide/kosher-vs-supported" className="text-orange-700 font-bold underline">
                    ההבדל בין כשר לתומך כשר
                  </Link>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OptionButton selected={answers.level === 'kosher'} onClick={() => next({ level: 'kosher', needs: [], cert: undefined })}>
                  {logoOf(phoneCertName) ? (
                    <img src={logoOf(phoneCertName)} alt={phoneCertName} className="w-11 h-11 object-contain rounded-lg bg-white border p-0.5" />
                  ) : (
                    <Emoji c="kosher" />
                  )}
                  <span>מכשיר כשר</span>
                  <span className="text-[11px] font-medium text-gray-500">שיחות בלבד, באישור {phoneCertName}</span>
                </OptionButton>
                <OptionButton selected={answers.level === 'support'} onClick={() => next({ level: 'support', cert: undefined })}>
                  <Emoji c="supported" />
                  <span>תומך כשר</span>
                  <span className="text-[11px] font-medium text-gray-500">בוחרים מה פתוח: נגן, מצלמה, SMS או וואטסאפ</span>
                </OptionButton>
                <OptionButton selected={answers.level === 'open'} onClick={() => next({ level: 'open', cert: undefined })}>
                  <Emoji c="globe" />
                  <span>סמארטפון פתוח</span>
                  <span className="text-[11px] font-medium text-gray-500">בלי סינון</span>
                </OptionButton>
                <OptionButton selected={answers.level === 'unsure'} onClick={() => next({ level: 'unsure', cert: undefined })}>
                  <Emoji c="help" />
                  <span>עוד לא יודע</span>
                  <span className="text-[11px] font-medium text-gray-500">נשאל מה צריך ונמליץ</span>
                </OptionButton>
              </div>
            </>
          )}

          {step === 'cert' && (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900">איזו כשרות?</h2>
                <p className="text-xs text-gray-500 mt-1">אם יש הנחיה מהרב או מהקהילה, בחרו אותה. אחרת: לא משנה</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {certs.map((k) => (
                  <OptionButton key={k.name} selected={answers.cert === k.name} onClick={() => next({ cert: k.name })}>
                    {k.image_url ? <img src={k.image_url} alt="" className="w-14 h-14 object-contain" /> : <Emoji c="kosher" />}
                    <span>{k.name}</span>
                  </OptionButton>
                ))}
                <OptionButton selected={answers.cert === 'any'} onClick={() => next({ cert: 'any' })}>
                  <Emoji c="check" /> לא משנה לי
                </OptionButton>
              </div>
            </>
          )}

          {step === 'needs' && (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900">מה חייב להיות במכשיר?</h2>
                <p className="text-xs text-gray-500 mt-1">אפשר לבחור כמה. שיחות יש בכל מכשיר. לפי זה נבחר לכם את הגרסה המדויקת</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {NEED_OPTIONS.map((n) => (
                  <OptionButton key={n.key} selected={(answers.needs || []).includes(n.key)} onClick={() => toggle('needs', n.key)}>
                    {typeof n.icon === 'string' ? <Emoji c={n.icon} /> : n.icon}
                    <span>{n.label}</span>
                    {n.note && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-sky-700">
                        <KosherPlayMark logo={kosherPlayLogo} size={14} /> {n.note}
                      </span>
                    )}
                  </OptionButton>
                ))}
              </div>
              {playNeeded && (
                <p className="flex items-center gap-2 text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded-xl p-3">
                  <KosherPlayMark logo={kosherPlayLogo} size={22} />
                  וואטסאפ וניווט יש רק בגרסת כשר פליי (חנות אפליקציות מסוננת, בלי דפדפן וגוגל).
                </p>
              )}
              <button onClick={() => setStepIdx((s) => s + 1)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black cursor-pointer">
                {(answers.needs || []).length ? 'המשך ←' : 'רק שיחות, המשך ←'}
              </button>
            </>
          )}

          {step === 'budget' && (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900">מה התקציב?</h2>
                <p className="text-xs text-gray-500 mt-1">הטווחים לפי המחירים של המכשירים שמתאימים לבחירה שלכם</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {budgets.map((b) => (
                  <OptionButton key={b.key} selected={answers.budget === b.key} onClick={() => next({ budget: b.key })}>
                    <Emoji c={b.key === 'any' ? 'help' : 'wallet'} /> {b.label}
                  </OptionButton>
                ))}
              </div>
            </>
          )}

          {step === 'extras' && (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900">עוד משהו חשוב?</h2>
                <p className="text-xs text-gray-500 mt-1">לא חובה, אפשר לבחור כמה</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {EXTRAS.map((e) => (
                  <OptionButton key={e.key} selected={(answers.extras || []).includes(e.key)} onClick={() => toggle('extras', e.key)}>
                    <Emoji c={e.icon} /> {e.label}
                  </OptionButton>
                ))}
              </div>
              <button onClick={() => setStepIdx((s) => s + 1)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black cursor-pointer">
                הצגת ההמלצות ←
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-orange-900">
              <b>חיפשתם:</b> {summary || 'הכל'}
            </p>
            <button onClick={restart} className="text-xs font-black text-orange-700 cursor-pointer">
              ↻ מתחילים מחדש
            </button>
          </div>

          {!products.length ? (
            <p className="text-center text-gray-500 py-10">טוען המלצות...</p>
          ) : results.length === 0 ? (
            <div className="text-center bg-white border rounded-3xl p-8 space-y-2">
              <p className="flex justify-center text-gray-300"><Icon name="search" size={40} /></p>
              <p className="font-black text-gray-900">לא מצאנו מכשיר שמתאים בדיוק</p>
              <p className="text-xs text-gray-500">כתבו לנו בוואטסאפ, ונמצא לכם מכשיר גם אם הוא עוד לא באתר</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r, i) => {
                const p = r.p;
                const img = p.image_url || asArray(p.images)[0] || '';
                const certLogo = logoOf(p.kosher);
                const onSale = p.sale_price && Number(p.sale_price) < Number(p.price);
                const href = `/product/${p.id}${r.version ? `?v=${encodeURIComponent(r.version.name)}` : ''}`;
                return (
                  <Link
                    key={p.id}
                    href={href}
                    className={`flex gap-4 bg-white rounded-3xl p-4 border-2 transition hover:shadow-md ${i === 0 ? 'border-orange-400' : 'border-gray-100'}`}
                  >
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0 bg-gray-50 rounded-2xl flex items-center justify-center p-2">
                      {img ? <img src={img} alt="" className="max-h-full object-contain" /> : <span className="text-3xl">📱</span>}
                      {certLogo && (
                        <img src={certLogo} alt={p.kosher} title={`כשרות ${p.kosher}`} className="absolute -bottom-1 -left-1 w-9 h-9 object-contain bg-white rounded-lg border p-0.5 shadow-sm" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-lg ${i === 0 ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {i === 0 ? '★ ההתאמה הכי טובה' : `התאמה מספר ${i + 1}`}
                      </span>
                      <h3 className="font-black text-gray-900 text-sm sm:text-base leading-snug line-clamp-2">{p.name}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-orange-600">₪{Math.round(priceOf(p))}</span>
                        {onSale && <span className="text-xs text-gray-400 line-through">₪{Math.round(Number(p.price))}</span>}
                      </div>
                      {r.version && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-black bg-sky-50 text-sky-900 border border-sky-200 px-2 py-1 rounded-lg">
                          <VersionMark v={r.version} size={16} />
                          הגרסה בשבילכם: {r.version.title}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {r.reasons.map((x) => (
                          <span key={x} className="text-[10px] font-bold bg-green-50 text-green-800 px-2 py-0.5 rounded-lg">
                            ✓ {x}
                          </span>
                        ))}
                        {r.missing.map((x) => (
                          <span key={x} className="text-[10px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-lg">
                            ✕ אין {x}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="self-center text-orange-600 font-black text-lg shrink-0">←</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="bg-[#25D366]/10 border border-[#25D366]/40 rounded-3xl p-5 flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="text-center sm:text-right">
              <p className="font-black text-gray-900">רוצים שנעזור לבחור?</p>
              <p className="text-xs text-gray-600">נשלח לנו את מה שבחרתם, ונמליץ על המכשיר והגרסה המדויקים</p>
            </div>
            <a
              href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, אשמח להתייעץ על מכשיר. חיפשתי: ${summary}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click')}
              className="bg-[#25D366] hover:bg-[#1fb857] text-white px-5 py-3 rounded-2xl text-sm font-black shrink-0 inline-flex items-center gap-2"
            >
              <WhatsAppIcon size={18} color="#fff" /> התייעצות בוואטסאפ
            </a>
          </div>
          <p className="text-center">
            <Link href="/" className="text-xs font-bold text-gray-500 hover:text-orange-600">
              לכל המוצרים בחנות ←
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
