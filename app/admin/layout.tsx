'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const activeRef = useRef<HTMLAnchorElement | null>(null);
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

  const navItems = [
    { name: 'ראשי 🏠', href: '/admin' },
    { name: 'ניהול מוצרים 📦', href: '/admin/products' },
    { name: 'ניהול הזמנות 📋', href: '/admin/orders' },
    { name: 'ניהול קטגוריות 📁', href: '/admin/categories' },
    { name: 'ניהול מותגים 🏷️', href: '/admin/brands' },
    { name: 'ניהול כשרות ⭐', href: '/admin/kosher' },
    { name: 'ניהול באנרים 🖼️', href: '/admin/banners' },
    { name: 'ניהול גירסאות ⚙️', href: '/admin/versions' },
    { name: 'ספריית מדיה 🖼️', href: '/admin/media' },
    { name: 'מבצעים וקופונים 🎟️', href: '/admin/coupons' },
    { name: 'לקוחות 👥', href: '/admin/customers' },
    { name: 'ניהול ושליחת מייל ✉️', href: '/admin/email' },
    { name: 'SEO ומעקב 🔍', href: '/admin/seo' },
  ];

  // שומר על הלשונית הפעילה במרכז הסרגל ללא קפיצות
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [pathname, access]);

  if (access === 'checking') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3" dir="rtl">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-600">בודק הרשאות ניהול...</p>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-md border border-orange-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-lg font-black text-gray-900">אין לך הרשאה לפאנל הניהול</h1>
          <p className="text-sm text-gray-600">
            האזור הזה מיועד למנהלי החנות בלבד. אם אתה מנהל, התחבר עם החשבון המורשה.
          </p>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black bg-orange-600 text-white hover:bg-orange-700 transition"
          >
            <img src="/Logo.JPG" alt="New Phone" className="w-6 h-6 object-contain rounded-md bg-white" />
            <span>חזרה לחנות</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול עליון */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b">
        
        {/* כפתור מעבר לחנות */}
        <Link
          href="/"
          className="px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer shrink-0 bg-white border-2 border-orange-300 text-orange-700 hover:bg-orange-50 shadow-xs flex items-center gap-2"
        >
          <img 
            src="/Logo.JPG" 
            alt="New Phone" 
            className="w-6 h-6 object-contain rounded-md"
          />
          <span>מעבר לחנות</span>
        </Link>

        <div className="h-6 w-[1px] bg-gray-200 mx-1 shrink-0"></div>

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : null}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 shadow-sm ${
                isActive
                  ? 'bg-orange-800 text-white border-2 border-orange-950 shadow-md scale-105'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      <main>{children}</main>
    </div>
  );
}
