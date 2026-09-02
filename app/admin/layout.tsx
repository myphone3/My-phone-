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
    { name: 'ניהול ושליחת מייל ✉️', href: '/admin/email' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול עליון נקי ומוצהר בלבד */}
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

      <main>{children}</main>
    </div>
  );
}
