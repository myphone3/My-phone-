'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [role, setRole] = useState<'owner' | 'staff'>('owner');

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
        const [{ data, error }, roleRes] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('my_admin_role')]);
        if (cancelled) return;
        // עובד (staff) רואה רק את המסכים של העבודה השוטפת; בעלים רואה הכל
        setRole(!roleRes.error && roleRes.data === 'staff' ? 'staff' : 'owner');
        setAccess(!error && data === true ? 'allowed' : 'denied');
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

  // כל המסכים בסרגל אחד, בלחיצה אחת, מסודרים לפי כמה משתמשים בהם (קבוצות מופרדות בקו)
  const groups = [
    [
      { name: 'ראשי', icon: '🏠', href: '/admin' },
      { name: 'הזמנות', icon: '📋', href: '/admin/orders' },
      { name: 'מוצרים', icon: '📦', href: '/admin/products' },
      { name: 'לקוחות', icon: '👥', href: '/admin/customers' },
      { name: 'דוחות', icon: '📊', href: '/admin/reports' },
    ],
    [
      { name: 'מבצעים וקופונים', icon: '🎟️', href: '/admin/coupons' },
      { name: 'קישורי פרסום', icon: '📣', href: '/admin/campaigns' },
      { name: 'באנרים', icon: '🪧', href: '/admin/banners' },
      { name: 'מיילים', icon: '✉️', href: '/admin/email' },
    ],
    [
      { name: 'ביקורות', icon: '⭐', href: '/admin/reviews' },
      { name: 'שאלות נפוצות', icon: '❓', href: '/admin/faq' },
      { name: 'גוגל (SEO)', icon: '🔍', href: '/admin/seo' },
    ],
    [
      { name: 'קטגוריות', icon: '📁', href: '/admin/categories' },
      { name: 'מותגים', icon: '🏷️', href: '/admin/brands' },
      { name: 'כשרויות', icon: '✡️', href: '/admin/kosher' },
      { name: 'גרסאות', icon: '⚙️', href: '/admin/versions' },
      { name: 'מדיה', icon: '🖼️', href: '/admin/media' },
      { name: 'צוות והרשאות', icon: '🔐', href: '/admin/staff' },
    ],
  ];
  // המסכים שעובד רשאי לראות (בלי הכנסות, לקוחות, דוחות והגדרות)
  const STAFF_PAGES = ['/admin/orders', '/admin/products', '/admin/reviews', '/admin/faq'];
  const staffAllowed = (href: string) => STAFF_PAGES.some((p) => href === p || href.startsWith(p + '/'));
  const visibleGroups = role === 'staff' ? groups.map((g) => g.filter((i) => staffAllowed(i.href))).filter((g) => g.length) : groups;
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // הלשונית הפעילה תמיד נראית בסרגל
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname, access]);

  // מי שאינו מנהל מוחזר לדף הבית בשקט
  useEffect(() => {
    if (access === 'denied') router.replace('/');
    else if (access === 'allowed' && role === 'staff' && !staffAllowed(pathname)) router.replace('/admin/orders');
  }, [access, role, pathname, router]);

  // עד שהבדיקה מסתיימת (או בזמן ההעברה לדף הבית) לא מציגים כלום
  if (access !== 'allowed') return null;
  if (role === 'staff' && !staffAllowed(pathname)) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול: כל המסכים בלחיצה אחת. בטלפון גוללים את הסרגל הצידה */}
      <nav className="-mx-4 px-4 pb-3 border-b border-orange-100">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar lg:flex-wrap">
          <Link href="/" className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-orange-700 bg-white border border-orange-200" title="מעבר לחנות">
            <img src="/Logo.JPG" alt="" className="w-5 h-5 object-contain rounded" />
            לחנות
          </Link>
          {visibleGroups.map((items, gi) => (
            <React.Fragment key={gi}>
              <span className="shrink-0 w-px h-6 bg-orange-200 mx-1" aria-hidden="true" />
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={active ? activeRef : null}
                    aria-current={active ? 'page' : undefined}
                    className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      active ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-orange-100 hover:border-orange-300 hover:text-orange-700'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
