'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { getBestSellers } from '@/lib/shop';
import { BUSINESS } from '@/lib/business';
import { track } from '@/lib/track';

// "איזה מכשיר מתאים לי?": 5 שאלות קצרות, ובסוף 3 המלצות מהמוצרים שבחנות עם הסבר למה.
// ההתאמה לפי המילים בשם, בקטגוריה, בתגיות, בכשרות ובתיאורים של המוצר. כדי לדייק: להוסיף תגיות למוצרים
// (למשל: וואטסאפ, מצלמה, סוללה, ניווט, מסך גדול, עמיד, מבוגרים, ילדים).

type Option = { key: string; label: string; icon: string };
type Question = { key: string; title: string; hint?: string; multi?: boolean; options: Option[] };

const QUESTIONS: Question[] = [
  {
    key: 'type',
    title: 'מה אתם מחפשים?',
    options: [
      { key: 'phone', label: 'טלפון', icon: '📱' },
      { key: 'player', label: 'נגן MP3 / MP4', icon: '🎧' },
      { key: 'accessory', label: 'אביזר', icon: '🔌' },
      { key: 'any', label: 'עוד לא בטוח', icon: '🤔' },
    ],
  },
  {
    key: 'who',
    title: 'למי המכשיר?',
    options: [
      { key: 'me', label: 'בשבילי', icon: '🙋' },
      { key: 'senior', label: 'להורים / מבוגרים', icon: '👴' },
      { key: 'kid', label: 'לילד או נער', icon: '🧒' },
      { key: 'gift', label: 'מתנה', icon: '🎁' },
    ],
  },
  {
    key: 'kosher',
    title: 'איזו כשרות צריך?',
    options: [
      { key: 'kosher', label: 'כשר מאושר', icon: '✡️' },
      { key: 'support', label: 'תומך כשר', icon: '✅' },
      { key: 'any', label: 'לא משנה לי', icon: '🤷' },
    ],
  },
  {
    key: 'budget',
    title: 'מה התקציב?',
    options: [
      { key: '0-250', label: 'עד ₪250', icon: '💰' },
      { key: '250-600', label: '₪250 עד ₪600', icon: '💰' },
      { key: '600-1200', label: '₪600 עד ₪1,200', icon: '💰' },
      { key: '1200-99999', label: 'מעל ₪1,200', icon: '💎' },
      { key: 'any', label: 'לא משנה', icon: '🤷' },
    ],
  },
  {
    key: 'needs',
    title: 'מה הכי חשוב לכם?',
    hint: 'אפשר לבחור כמה',
    multi: true,
    options: [
      { key: 'battery', label: 'סוללה חזקה', icon: '🔋' },
      { key: 'whatsapp', label: 'וואטסאפ', icon: '💬' },
      { key: 'camera', label: 'מצלמה טובה', icon: '📷' },
      { key: 'navigation', label: 'ניווט (Waze)', icon: '🗺️' },
      { key: 'screen', label: 'מסך גדול', icon: '🖥️' },
      { key: 'rugged', label: 'קטן ועמיד', icon: '🛡️' },
      { key: 'music', label: 'שירים ושיעורים', icon: '🎵' },
    ],
  },
];

const NEED_WORDS: Record<string, { re: RegExp; reason: string }> = {
  battery: { re: /סוללה|mah|battery|סוללת/i, reason: 'סוללה חזקה' },
  whatsapp: { re: /וואטסאפ|ווטסאפ|whatsapp/i, reason: 'תומך וואטסאפ' },
  camera: { re: /מצלמה|camera|מגה ?פיקסל|mp\b/i, reason: 'מצלמה' },
  navigation: { re: /waze|ווייז|ניווט|gps|מפות/i, reason: 'ניווט' },
  screen: { re: /מסך גדול|אינץ|"|מסך מגע|touch/i, reason: 'מסך גדול' },
  rugged: { re: /עמיד|מוקשח|ip6[78]|קומפקטי|קטן/i, reason: 'קטן ועמיד' },
  music: { re: /נגן|mp3|mp4|שירים|שיעורים|מוזיקה|רדיו/i, reason: 'שירים ושיעורים' },
};

const textOf = (p: any) =>
  [p.name, p.category, p.brand, p.tags, p.kosher, p.short_description, p.description, p.specs, p.spec_battery, p.spec_storage]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;

function score(p: any, a: Record<string, string[]>, best: Set<string>) {
  const t = textOf(p);
  let s = 0;
  const reasons: string[] = [];
  const type = a.type?.[0];
  const isPlayer = /נגן|mp3|mp4/.test(t);
  const isAccessory = /אביזר|כיסוי|מטען|מגן מסך|אוזניות|כבל/.test(t);
  if (type === 'player') isPlayer ? ((s += 6), reasons.push('נגן')) : (s -= 6);
  if (type === 'accessory') isAccessory ? (s += 6) : (s -= 6);
  if (type === 'phone') isPlayer || isAccessory ? (s -= 6) : (s += 3);

  const kosher = a.kosher?.[0];
  const isSupport = /תומך/.test(t);
  if (kosher === 'kosher') {
    if ((p.kosher || /כשר/.test(t)) && !isSupport) {
      s += 4;
      reasons.push(p.kosher ? `כשרות ${p.kosher}` : 'מכשיר כשר');
    } else s -= 3;
  }
  if (kosher === 'support') isSupport ? ((s += 4), reasons.push('תומך כשר')) : (s -= 1);

  const budget = a.budget?.[0];
  if (budget && budget !== 'any') {
    const [min, max] = budget.split('-').map(Number);
    const price = priceOf(p);
    if (price >= min && price <= max) {
      s += 4;
      reasons.push('בתקציב שלך');
    } else if (price > max && price <= max * 1.2) s += 1;
    else s -= 4;
  }

  for (const need of a.needs || []) {
    const w = NEED_WORDS[need];
    if (w && w.re.test(t)) {
      s += 2;
      reasons.push(w.reason);
    }
  }

  const who = a.who?.[0];
  if (who === 'senior' && /מבוגר|מקשים גדולים|כפתורים גדולים|sos|פשוט/.test(t)) {
    s += 3;
    reasons.push('מתאים למבוגרים');
  }
  if (who === 'kid' && /ילד|נוער|בסיסי|פשוט/.test(t)) {
    s += 3;
    reasons.push('מתאים לילדים ונוער');
  }

  const out = p.stock !== null && p.stock !== undefined && p.stock !== '' && Number(p.stock) <= 0;
  if (out) s -= 10;
  if (best.has(String(p.id))) {
    s += 1;
    reasons.push('מהנמכרים ביותר');
  }
  if (p.sale_price && Number(p.sale_price) < Number(p.price)) {
    s += 1;
    reasons.push('במבצע עכשיו');
  }
  return { s, reasons: Array.from(new Set(reasons)).slice(0, 4) };
}

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [best, setBest] = useState<Set<string>>(new Set());
  const done = step >= QUESTIONS.length;

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .or('is_published.is.null,is_published.eq.true')
      .then(({ data }) => setProducts(data || []));
    getBestSellers().then(setBest);
  }, []);

  useEffect(() => {
    if (done) track('quiz_done');
  }, [done]);

  const results = useMemo(() => {
    if (!done) return [];
    return products
      .map((p) => ({ p, ...score(p, answers, best) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [done, products, answers, best]);

  const q = QUESTIONS[step];
  const choose = (opt: string) => {
    if (q.multi) {
      setAnswers((a) => {
        const cur = a[q.key] || [];
        return { ...a, [q.key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
      });
      return;
    }
    setAnswers((a) => ({ ...a, [q.key]: [opt] }));
    setStep((s) => s + 1);
  };

  const restart = () => {
    setAnswers({});
    setStep(0);
  };

  const summary = QUESTIONS.map((qq) =>
    (answers[qq.key] || []).map((k) => qq.options.find((o) => o.key === k)?.label).filter(Boolean).join(', ')
  )
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">🧭 איזה מכשיר מתאים לי?</h1>
        <p className="text-sm text-gray-500">5 שאלות קצרות, ונמליץ לכם על המכשירים הכי מתאימים מהחנות</p>
      </div>

      {/* התקדמות */}
      <div className="flex gap-1.5 max-w-md mx-auto" aria-hidden="true">
        {QUESTIONS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-orange-600' : i === step ? 'bg-orange-300' : 'bg-gray-200'}`} />
        ))}
      </div>

      {!done ? (
        <div className="bg-white rounded-3xl border-2 border-orange-100 shadow-sm p-5 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">
              שאלה {step + 1} מתוך {QUESTIONS.length}
            </span>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="text-xs font-bold text-orange-700 cursor-pointer">
                → חזרה
              </button>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">{q.title}</h2>
            {q.hint && <p className="text-xs text-gray-500 mt-1">{q.hint}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {q.options.map((o) => {
              const selected = (answers[q.key] || []).includes(o.key);
              return (
                <button
                  key={o.key}
                  onClick={() => choose(o.key)}
                  aria-pressed={selected}
                  className={`p-4 rounded-2xl border-2 text-sm font-black flex flex-col items-center gap-2 transition cursor-pointer ${
                    selected ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-gray-100 bg-gray-50 hover:border-orange-300 text-gray-800'
                  }`}
                >
                  <span className="text-3xl">{o.icon}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
          {q.multi && (
            <button onClick={() => setStep((s) => s + 1)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black cursor-pointer">
              {(answers[q.key] || []).length ? 'הצגת ההמלצות ←' : 'דילוג והצגת ההמלצות ←'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-orange-900">
              <b>חיפשתם:</b> {summary || 'הכל'}
            </p>
            <button onClick={restart} className="text-xs font-black text-orange-700 cursor-pointer">
              🔄 מתחילים מחדש
            </button>
          </div>

          {results.length === 0 ? (
            <p className="text-center text-gray-500 py-10">טוען המלצות...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {results.map(({ p, reasons }, i) => (
                <div key={p.id} className={`space-y-2 ${i === 0 ? 'sm:-mt-2' : ''}`}>
                  <div className={`text-center text-xs font-black py-1.5 rounded-xl ${i === 0 ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {i === 0 ? '🏆 ההתאמה הכי טובה' : `התאמה מספר ${i + 1}`}
                  </div>
                  <ProductCard product={p} />
                  {reasons.length > 0 && (
                    <ul className="flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <li key={r} className="text-[10px] font-bold bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded-lg">
                          ✓ {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border rounded-2xl p-5 text-center space-y-2">
            <p className="font-black text-gray-900">רוצים המלצה אישית?</p>
            <p className="text-xs text-gray-500">נשמח לעזור לבחור את המכשיר המדויק, בלי התחייבות</p>
            <a
              href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, אשמח להתייעץ על מכשיר. חיפשתי: ${summary}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click')}
              className="inline-block bg-[#25D366] text-white px-5 py-2.5 rounded-xl text-xs font-black"
            >
              💬 התייעצות בוואטסאפ
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
