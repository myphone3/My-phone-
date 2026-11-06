'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { A11Y_DEFAULT, A11Y_KEY, A11ySettings, applyA11y, readA11y } from '@/lib/a11y';

// כפתור נגישות צף: הגדלת טקסט, ניגודיות, הדגשת קישורים ועצירת אנימציות
export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<A11ySettings>(A11Y_DEFAULT);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setS(readA11y());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const update = (next: A11ySettings) => {
    setS(next);
    applyA11y(next);
    try {
      localStorage.setItem(A11Y_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  if (pathname?.startsWith('/admin')) return null;

  const Option = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`w-full text-right px-3 py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
        on ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-200 hover:border-blue-400'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`fixed bottom-5 right-5 ${open ? 'z-[70]' : 'z-40'}`} dir="rtl">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="תפריט נגישות"
          className="absolute bottom-16 right-0 w-64 bg-white border-2 border-blue-700 rounded-2xl shadow-2xl p-3 space-y-2"
        >
          <div className="flex justify-between items-center">
            <span className="font-black text-gray-900">נגישות</span>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 cursor-pointer" aria-label="סגירת תפריט הנגישות">
              ✕
            </button>
          </div>
          <Option on={s.text > 0} onClick={() => update({ ...s, text: ((s.text + 1) % 3) as 0 | 1 | 2 })}>
            🔠 הגדלת טקסט {s.text > 0 ? `(${s.text === 1 ? 'גדול' : 'גדול מאוד'})` : ''}
          </Option>
          <Option on={s.contrast} onClick={() => update({ ...s, contrast: !s.contrast })}>🌓 ניגודיות גבוהה</Option>
          <Option on={s.links} onClick={() => update({ ...s, links: !s.links })}>🔗 הדגשת קישורים</Option>
          <Option on={s.noMotion} onClick={() => update({ ...s, noMotion: !s.noMotion })}>⏸️ עצירת אנימציות</Option>
          <Link href="/accessibility" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-bold text-blue-700 hover:underline">
            📄 הצהרת נגישות
          </Link>
          <button onClick={() => update(A11Y_DEFAULT)} className="w-full text-center text-xs text-gray-500 hover:text-gray-800 py-1 cursor-pointer">
            איפוס הגדרות
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="תפריט נגישות"
        className="w-14 h-14 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-lg flex items-center justify-center cursor-pointer"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M19 9.5h-5v12h-2v-6h-2v6H8v-12H3v-2h16z" />
        </svg>
      </button>
    </div>
  );
}
