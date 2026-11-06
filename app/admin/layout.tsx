'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');

  // שער כניסה: שואלים את בסיס הנתונים (הפונקציה is_admin) האם המשתמש המחובר מנהל
  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setAccess('denied');
          return;
        }
        const { data, error } = await supabase.rpc('is_admin');
        if (!cancelled) setAccess(!error && data === true ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    };

    checkAccess();

    // בדיקה מחדש בכל התחברות או התנתקות
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // התפריט מסודר בקבוצות. ארבעת המסכים הנפוצים מופיעים תמיד למעלה, השאר בתפריט "כל המסכים"
  const quickItems = [
    { name: 'ראשי', icon: '🏠', href: '/admin' },
    { name: 'הזמנות', icon: '📋', href: '/admin/orders' },
    { name: 'מוצרים', icon: '📦', href: '/admin/products' },
    { name: 'לקוחות', icon: '👥', href: '/admin/customers' },
  ];
  const groups = [
    {
      title: 'מכירות',
      items: [
        { name: 'הזמנות', icon: '📋', href: '/admin/orders' },
        { name: 'לקוחות', icon: '👥', href: '/admin/customers' },
        { name: 'דוחות מכירות', icon: '📊', href: '/admin/reports' },
      ],
    },
    {
      title: 'מוצרים וקטלוג',
      items: [
        { name: 'מוצרים', icon: '📦', href: '/admin/products' },
        { name: 'קטגוריות', icon: '📁', href: '/admin/categories' },
        { name: 'מותגים', icon: '🏷️', href: '/admin/brands' },
        { name: 'כשרויות', icon: '✡️', href: '/admin/kosher' },
        { name: 'גרסאות', icon: '⚙️', href: '/admin/versions' },
        { name: 'ספריית מדיה', icon: '🖼️', href: '/admin/media' },
      ],
    },
    {
      title: 'שיווק ומבצעים',
      items: [
        { name: 'מבצעים וקופונים', icon: '🎟️', href: '/admin/coupons' },
        { name: 'באנרים בעמוד הבית', icon: '🪧', href: '/admin/banners' },
        { name: 'קישורי פרסום', icon: '📣', href: '/admin/campaigns' },
        { name: 'מיילים ללקוחות', icon: '✉️', href: '/admin/email' },
      ],
    },
    {
      title: 'תוכן האתר והגדרות',
      items: [
        { name: 'ביקורות לקוחות', icon: '⭐', href: '/admin/reviews' },
        { name: 'שאלות נפוצות', icon: '❓', href: '/admin/faq' },
        { name: 'גוגל ומעקב (SEO)', icon: '🔍', href: '/admin/seo' },
      ],
    },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));
  const current = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))).find((i) => isActive(i.href));

  // סוגר את התפריט במעבר בין מסכים
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // מי שאינו מנהל מוחזר לדף הבית בשקט
  useEffect(() => {
    if (access === 'denied') router.replace('/');
  }, [access, router]);

  // עד שהבדיקה מסתיימת (או בזמן ההעברה לדף הבית) לא מציגים כלום
  if (access !== 'allowed') return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול עליון */}
      <div className="bg-white border rounded-2xl shadow-sm p-2 space-y-2">
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold text-gray-600 hover:bg-gray-100"
            title="מעבר לחנות"
          >
            <img src="/Logo.JPG" alt="" className="w-6 h-6 object-contain rounded-md" />
            <span className="hidden sm:inline">לחנות</span>
          </Link>
          <div className="h-6 w-px bg-gray-200 shrink-0" />
          <nav className="flex-1 grid grid-cols-4 gap-1">
            {quickItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition ${
                  isActive(item.href) ? 'bg-orange-600 text-white' : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                <span className="text-base sm:text-sm leading-none">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            className={`shrink-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold cursor-pointer ${
              menuOpen ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            <span className="text-base sm:text-sm leading-none">{menuOpen ? '✕' : '☰'}</span>
            עוד
          </button>
        </div>

        {menuOpen && (
          <div className="border-t pt-3 pb-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {groups.map((g) => (
              <div key={g.title} className="space-y-1">
                <div className="text-[11px] font-black text-gray-400 tracking-wide px-2">{g.title}</div>
                {g.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-bold ${
                      isActive(item.href) ? 'bg-orange-50 text-orange-700' : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="w-7 text-center">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* איפה אני עכשיו */}
      {current && current.href !== '/admin' && (
        <div className="text-[11px] text-gray-400 font-bold px-1">
          {current.group} · <span className="text-gray-700">{current.name}</span>
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}
