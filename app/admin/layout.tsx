'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'ניהול מוצרים 📦', href: '/admin/products' },
    { name: 'ניהול הזמנות 📋', href: '/admin/orders' },
    { name: 'ניהול קטגוריות 📁', href: '/admin/categories' },
    { name: 'ניהול מותגים 🏷️', href: '/admin/brands' },
    { name: 'ניהול כשרות ⭐', href: '/admin/kosher' },
    { name: 'ניהול באנרים 🖼️', href: '/admin/banners' },
    { name: 'ניהול גירסאות ⚙️', href: '/admin/versions' },
    { name: 'ספריית מדיה 🖼️', href: '/admin/media' },
    { name: 'קופונים 🎟️', href: '/admin/coupons' },
    { name: 'לקוחות והודעות 👥', href: '/admin/customers' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      {/* כותרת עליונה ראשית וחזרה לחנות */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">פאנל ניהול האתר 🛠️</h1>
          <p className="text-xs text-gray-500 font-medium">ניהול מלא של חנות הסלולר, המוצרים והמערכת.</p>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          חזרה לחנות ➔
        </Link>
      </div>

      {/* תפריט ניהול עליון אחיד לכל העמודים עם כל האפשרויות */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b pb-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                isActive ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* תוכן העמוד הספציפי */}
      <main>{children}</main>
    </div>
  );
}
