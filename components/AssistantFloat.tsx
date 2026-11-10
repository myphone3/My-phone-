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
      {/* העיגול הקטן */}
      <div className="fixed left-6 bottom-[5.5rem] [body[data-consent=open]_&]:bottom-[8.25rem] z-40 flex items-center gap-2" dir="rtl">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="צ'אט עם הנציג החכם"
          aria-expanded={open}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg hover:scale-110 transition flex items-center justify-center cursor-pointer border-2 border-white"
        >
          <Icon name={open ? 'x' : 'bot'} size={open ? 20 : 24} />
          {!open && <span className="absolute -top-1 -right-1 bg-white text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow border border-orange-200">AI</span>}
          {!seen && !open && <span className="absolute inset-0 rounded-full animate-ping bg-orange-400/40 pointer-events-none" />}
        </button>
        {!seen && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden sm:block bg-white border-2 border-orange-200 text-gray-800 text-xs font-black px-3 py-2 rounded-2xl shadow-md cursor-pointer"
          >
            לא בטוחים איזה מכשיר? שאלו אותי
          </button>
        )}
      </div>

      {/* החלונית */}
      {open && (
        <div
          role="dialog"
          aria-label="הנציג החכם"
          dir="rtl"
          className="fixed z-50 left-4 right-4 sm:right-auto bottom-[9.75rem] [body[data-consent=open]_&]:bottom-[12.5rem] sm:w-[380px] h-[min(560px,calc(100vh-12rem))] bg-white rounded-3xl shadow-2xl border-2 border-orange-200 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150"
        >
          {/* כותרת */}
          <div className="bg-gradient-to-l from-orange-600 to-orange-500 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="bot" size={24} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-black text-sm">הנציג החכם של NEW PHONE</span>
              <span className="block text-[11px] text-white/85">עונה מיד, 24/7 · נציג AI</span>
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

          {/* תוכן */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-orange-50/40">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tr-sm p-3 text-sm text-gray-800 shadow-xs max-w-[90%]">
              שלום! אני הנציג החכם של החנות. אפשר לשאול אותי כל שאלה על המכשירים, או לתת לי למצוא לכם את המכשיר המתאים.
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
