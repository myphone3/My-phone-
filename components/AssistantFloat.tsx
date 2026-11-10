'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import { WhatsAppIcon } from './Logos';
import { BUSINESS } from '@/lib/business';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/track';

// עיגול קטן מעל כפתור הוואטסאפ: הנציג החכם (AI).
// בפנים: "ממליץ המכשירים" (שאלון קצר) וצ'אט חופשי עם הנציג.
// אפשר לפתוח מכל מקום באתר: window.dispatchEvent(new Event('openAssistant'))

type Msg = { role: 'user' | 'assistant'; text: string; productIds?: string[] };

const STORE_KEY = 'assistantChat';
const SEEN_KEY = 'assistantSeen';

const QUICK = [
  'מה ההבדל בין מכשיר כשר לתומך כשר?',
  'אני צריך וואטסאפ, איזה מכשיר מתאים?',
  'מכשיר פשוט עם מקשים גדולים להורים',
  'יש לכם נגן MP3 כשר?',
];

const imageOf = (p: any) => {
  if (p?.image_url) return p.image_url;
  if (Array.isArray(p?.images)) return p.images[0] || '';
  try {
    const v = JSON.parse(p?.images || '[]');
    return Array.isArray(v) ? v[0] || '' : '';
  } catch {
    return '';
  }
};
const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;

function ProductChips({ ids, onPick }: { ids: string[]; onPick: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from('products')
      .select('id, name, price, sale_price, image_url, images')
      .in('id', ids)
      .then(({ data }) => alive && setItems(ids.map((id) => (data || []).find((p: any) => String(p.id) === id)).filter(Boolean)));
    return () => {
      alive = false;
    };
  }, [ids]);
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 mt-2">
      <span className="block text-[10px] font-bold text-gray-500 px-1">מוצרים מהאתר שלנו · הפרטים המחייבים בדף המוצר</span>
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/product/${p.id}`}
          onClick={onPick}
          className="flex items-center gap-2.5 bg-white border-2 border-orange-100 hover:border-orange-300 rounded-xl p-2 transition"
        >
          <span className="w-11 h-11 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
            {imageOf(p) ? <img src={imageOf(p)} alt="" className="max-w-full max-h-full object-contain" /> : <Icon name="phone" size={18} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-black text-gray-900 leading-snug line-clamp-2">{p.name}</span>
            <span className="block text-xs font-black text-orange-600">₪{Math.round(priceOf(p))}</span>
          </span>
          <span className="text-orange-600 font-black text-sm shrink-0">←</span>
        </Link>
      ))}
    </div>
  );
}

// סמל הנציג: בועת צ'אט לבנה עם ניצוץ בצבעי הלוגו
export function AiMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0 drop-shadow-sm">
      <defs>
        <linearGradient id="aiMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="0.55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M12 3.2c-5.08 0-9.2 3.47-9.2 7.75 0 2.3 1.2 4.37 3.1 5.79l-.62 3.66a.5.5 0 0 0 .72.53l3.73-1.92c.73.15 1.49.23 2.27.23 5.08 0 9.2-3.47 9.2-7.75S17.08 3.2 12 3.2Z" fill="#fff" />
      <path d="M11.4 6.6c.33 2.02 1.43 3.12 3.45 3.45-2.02.33-3.12 1.43-3.45 3.45-.33-2.02-1.43-3.12-3.45-3.45 2.02-.33 3.12-1.43 3.45-3.45Z" fill="url(#aiMarkGrad)" />
      <path d="M15.9 11.9c.16.95.67 1.46 1.62 1.62-.95.16-1.46.67-1.62 1.62-.16-.95-.67-1.46-1.62-1.62.95-.16 1.46-.67 1.62-1.62Z" fill="url(#aiMarkGrad)" />
    </svg>
  );
}

export default function AssistantFloat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]');
      if (Array.isArray(saved)) setMessages(saved);
    } catch {
      setSeen(false);
    }
    const openIt = () => setOpen(true);
    window.addEventListener('openAssistant', openIt);
    return () => window.removeEventListener('openAssistant', openIt);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!seen) {
      setSeen(true);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        // ignore
      }
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => setOpen(false), [pathname]);

  if (pathname?.startsWith('/admin')) return null;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || sending) return;
    const next: Msg[] = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })) }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', text: data.reply || 'סליחה, משהו השתבש. נסו שוב.', productIds: data.productIds || [] }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'אין חיבור כרגע. נסו שוב עוד רגע, או כתבו לנו בוואטסאפ.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      {/* העיגול הקטן: בצבעי הלוגו של החנות */}
      <div className="fixed left-[1.625rem] bottom-[5.6rem] [body[data-consent=open]_&]:bottom-[8.35rem] z-40 flex items-center gap-2 group" dir="rtl">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="צ'אט עם הנציג החכם"
          aria-expanded={open}
          className="relative w-[52px] h-[52px] rounded-full cursor-pointer transition duration-300 hover:scale-110 active:scale-95"
        >
          {/* הילה רכה שזזה לאט */}
          {!open && <span className="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,#f97316,#ec4899,#8b5cf6,#f97316)] opacity-60 blur-md animate-[spin_6s_linear_infinite] pointer-events-none" />}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 shadow-[0_6px_18px_-4px_rgba(236,72,153,0.55)] ring-2 ring-white" />
          <span className="relative w-full h-full flex items-center justify-center text-white">
            {open ? <Icon name="x" size={20} strokeWidth={2.2} /> : <AiMark size={30} />}
          </span>
          {!seen && !open && <span className="absolute inset-0 rounded-full animate-ping bg-pink-400/40 pointer-events-none" />}
        </button>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${seen ? 'hidden sm:group-hover:block' : 'hidden sm:block'} bg-white/95 backdrop-blur border border-pink-100 text-gray-800 text-xs font-black px-3 py-2 rounded-2xl rounded-bl-sm shadow-lg cursor-pointer whitespace-nowrap`}
          >
            <span className="bg-gradient-to-l from-orange-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">הנציג החכם</span> · איזה מכשיר מתאים לי?
          </button>
        )}
      </div>

      {/* החלונית */}
      {open && (
        <div
          role="dialog"
          aria-label="הנציג החכם"
          dir="rtl"
          className="fixed z-50 left-4 right-4 sm:right-auto bottom-[9.75rem] [body[data-consent=open]_&]:bottom-[12.5rem] sm:w-[380px] h-[min(560px,calc(100vh-12rem))] bg-white rounded-3xl shadow-2xl border-2 border-pink-100 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150"
        >
          {/* כותרת */}
          <div className="bg-gradient-to-l from-orange-500 via-pink-500 to-purple-600 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/40 flex items-center justify-center shrink-0">
              <AiMark size={26} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-black text-sm">הנציג החכם של NEW PHONE</span>
              <span className="block text-[11px] text-white/85">נציג AI · ממליץ רק על מוצרים מהאתר שלנו</span>
            </span>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="text-[11px] font-bold text-white/85 hover:text-white cursor-pointer" title="שיחה חדשה">
                ↻ חדש
              </button>
            )}
            <button type="button" onClick={close} aria-label="סגירה" className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center cursor-pointer">
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* הודעה מודגשת: ממליץ רק מתוך האתר (מוצגת תמיד) */}
          <div className="bg-amber-50 border-b-2 border-amber-300 px-3 py-2 flex items-start gap-2 shrink-0" role="note">
            <span className="text-base leading-none mt-0.5" aria-hidden="true">⚠️</span>
            <p className="text-[11px] leading-snug text-amber-900">
              <strong className="font-black">ממליץ רק על מוצרים שנמכרים באתר NEW PHONE.</strong> ההמלצות הן הצעה כללית שנכתבת
              אוטומטית על ידי AI, וייתכנו בהן טעויות. המחיר, המלאי והפרטים המחייבים הם אלה שבדף המוצר באתר. לפני רכישה מומלץ
              לבדוק את דף המוצר.{' '}
              <Link href="/terms#ai" onClick={close} className="font-bold underline">
                לתנאים המלאים
              </Link>
            </p>
          </div>

          {/* תוכן */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-orange-50/40">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tr-sm p-3 text-sm text-gray-800 shadow-xs max-w-[90%]">
              שלום! אני הנציג החכם של החנות. אני ממליץ <strong className="font-black">רק על מוצרים מהאתר שלנו</strong>. אפשר לשאול
              אותי כל שאלה על המכשירים, או לתת לי למצוא לכם את המכשיר המתאים.
            </div>

            {/* ממליץ המכשירים */}
            <Link
              href="/quiz"
              onClick={close}
              className="flex items-center gap-3 bg-white border-2 border-orange-300 hover:border-orange-500 rounded-2xl p-3 transition shadow-sm group"
            >
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-orange-600 text-white flex items-center justify-center group-hover:scale-105 transition">
                <Icon name="compass" size={26} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-black text-gray-900">איזה מכשיר מתאים לי?</span>
                <span className="block text-[11px] text-gray-500 leading-snug">עונים על כמה שאלות קצרות (דקה אחת) ומקבלים את המכשיר והגרסה המדויקים</span>
              </span>
              <span className="text-orange-600 font-black shrink-0">←</span>
            </Link>

            {messages.length === 0 && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-gray-500 px-1">או שאלו אותי, למשל:</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="text-[11px] font-bold bg-white border border-orange-200 hover:border-orange-400 text-orange-800 px-2.5 py-1.5 rounded-full text-right cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-orange-600 text-white rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="max-w-[90%]">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tr-sm p-3 text-sm text-gray-800 shadow-xs whitespace-pre-wrap leading-relaxed">{m.text}</div>
                  {m.productIds && m.productIds.length > 0 && <ProductChips ids={m.productIds} onPick={close} />}
                </div>
              )
            )}

            {sending && (
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tr-sm px-4 py-3 shadow-xs inline-flex gap-1" aria-label="הנציג כותב">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </div>
            )}
          </div>

          {/* שורת כתיבה */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-gray-100 p-2.5 flex items-center gap-2 shrink-0 bg-white"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="כתבו שאלה..."
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="שליחה"
              className="w-10 h-10 shrink-0 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 text-white flex items-center justify-center cursor-pointer transition"
            >
              <Icon name="send" size={18} className="-scale-x-100" />
            </button>
          </form>
          <a
            href={`https://wa.me/${BUSINESS.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click')}
            className="text-[11px] font-bold text-gray-500 hover:text-green-700 text-center pb-2 bg-white inline-flex items-center justify-center gap-1"
          >
            <WhatsAppIcon size={13} color="#25D366" /> מעדיפים לדבר עם נציג אמיתי? וואטסאפ
          </a>
        </div>
      )}
    </>
  );
}
