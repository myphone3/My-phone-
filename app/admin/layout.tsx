'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const activeRef = useRef<HTMLAnchorElement | null>(null);

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
    { name: 'לקוחות והודעות 👥', href: '/admin/customers' },
    { name: 'ניהול ושליחת מייל ✉️', href: '/admin/email' },
    { name: 'SEO ומעקב 🔍', href: '/admin/seo' },
  ];

  // גלילה אוטומטית שומרת על הלשונית הפעילה גלויה בסרגל
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [pathname]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול עליון */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b no-scrollbar">
        
        {/* כפתור מעבר ישיר לחנות */}
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
