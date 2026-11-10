'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Icon from './Icon';

// כפתור "קטגוריות" ליד שורת החיפוש: פותח חלון עם כל הקטגוריות כעיגולים עם תמונות (כמו בדף הבית)
type Category = { id: string | number; name: string; image_url?: string | null };

let cache: Category[] | null = null;

export default function CategoriesMenu() {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Category[]>(cache || []);

  useEffect(() => {
    if (!open || cache) return;
    supabase
      .from('categories')
      .select('id, name, image_url')
      .then(({ data }) => {
        cache = ((data as Category[]) || []).filter((c) => c?.name);
        setCats(cache);
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="shrink-0 flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 hover:border-orange-300 text-orange-700 rounded-2xl px-3 text-xs font-bold transition shadow-2xs cursor-pointer"
      >
        <Icon name="grid" size={15} />
        <span>קטגוריות</span>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="קטגוריות"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in duration-150">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900 border-r-4 border-orange-600 pr-3">קטגוריות</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center cursor-pointer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-5">
              {cats.length === 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4" aria-busy="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-5">
                  {cats.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/category/${encodeURIComponent(cat.name)}`}
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-center text-center gap-2 group"
                    >
                      <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border border-orange-500/30 shadow-xs overflow-hidden flex items-center justify-center group-hover:scale-105 transition">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
                        ) : (
                          <Icon name="box" size={28} className="text-orange-500" />
                        )}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-orange-600 leading-tight">{cat.name.trim()}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 pb-4 pt-2 border-t border-gray-100" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              <Link
                href="/categories"
                onClick={() => setOpen(false)}
                className="block w-full text-center bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-black text-sm py-3 rounded-2xl transition"
              >
                לכל הקטגוריות והמותגים ←
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
