'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ToastOptions } from '@/lib/toast';

type Toast = ToastOptions & { id: number; message: string };

const STYLES = {
  success: 'bg-gray-900 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-900 text-white',
};

export default function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setToast({ id: Date.now(), message: String(detail.message || ''), kind: detail.kind, action: detail.action });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), detail.action ? 4500 : 3000);
    };
    window.addEventListener('app-toast', onToast);
    return () => {
      window.removeEventListener('app-toast', onToast);
      clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 sm:bottom-5 z-[100] flex justify-center px-4 pointer-events-none" dir="rtl">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl text-sm font-bold max-w-md w-full sm:w-auto animate-[toast-in_.2s_ease-out] ${STYLES[toast.kind || 'info']}`}
      >
        <span className="flex-1">{toast.message}</span>
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={() => setToast(null)}
            className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black px-3 py-2 rounded-xl transition"
          >
            {toast.action.label}
          </Link>
        )}
        <button onClick={() => setToast(null)} aria-label="סגירה" className="shrink-0 text-white/60 hover:text-white text-lg leading-none cursor-pointer">
          ×
        </button>
      </div>
    </div>
  );
}
