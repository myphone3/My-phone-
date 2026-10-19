import React from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
    { name: 'קופונים 🎟️', href: '/admin/coupons' },
    { name: 'לקוחות והודעות 👥', href: '/admin/customers' },
    { name: 'ניהול ושליחת מייל ✉️', href: '/admin/email' },
    { name: 'SEO ומעקב 🔍', href: '/admin/seo' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* תפריט ניהול עליון */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b">
        
        {/* כפתור מעבר ישיר לחנות עם לוגו החנות */}
        <a
          href="/"
          className="px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer shrink-0 bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 shadow-xs flex items-center gap-2"
        >
          <img src="/logo.png" alt="My Phone" className="w-5 h-5 object-contain rounded-md" />
          <span>מעבר לחנות</span>
        </a>

        <div className="h-6 w-[1px] bg-gray-200 mx-1 shrink-0"></div>

        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-600 hover:text-white shadow-xs"
          >
            {item.name}
          </a>
        ))}
      </div>

      <main>{children}</main>
    </div>
  );
}
