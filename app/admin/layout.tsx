'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// מחלקת הגנה מפני קריסות (ErrorBoundary)
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto mt-12 bg-white rounded-3xl border shadow-lg text-center space-y-4" dir="rtl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-black text-gray-900">אופס, אירעה שגיאה באזור הניהול</h2>
          <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl font-mono break-all text-left" dir="ltr">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => window.location.href = '/admin'}
            className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
          >
            איפוס וחזרה לדשבורד הראשי ➔
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
      {/* תפריט ניהול עליון הכולל את כפתור המעבר לחנות */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b">
        
        {/* כפתור מעבר לחנות בולט בצד */}
        <Link
          href="/"
          className="px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer shrink-0 bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 shadow-xs flex items-center gap-1.5"
        >
          <span>🛒</span>
          <span>מעבר לחנות</span>
        </Link>

        <div className="h-6 w-[1px] bg-gray-200 mx-1 shrink-0"></div>

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

      <ErrorBoundary>
        <main>{children}</main>
      </ErrorBoundary>
    </div>
  );
}
