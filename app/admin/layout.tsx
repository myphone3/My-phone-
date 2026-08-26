'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'דשבורד', href: '/admin', icon: '📊' },
    { name: 'מוצרים', href: '/admin/products', icon: '📦' },
    { name: 'הזמנות', href: '/admin/orders', icon: '🛍️' },
    { name: 'לקוחות', href: '/admin/customers', icon: '👥' },
    { name: 'קופונים', href: '/admin/coupons', icon: '🏷️' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir="rtl">
      {/* תפריט צד (Sidebar) */}
      <aside className="w-full md:w-64 bg-white border-l shadow-sm flex flex-col justify-between p-4">
        <div>
          {/* כותרת / לוגו */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <span className="font-bold text-xl text-gray-800">ניהול חנות</span>
            <Link 
              href="/" 
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg transition"
            >
              צפה באתר ↗
            </Link>
          </div>

          {/* קישורים בתפריט */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition ${
                    isActive 
                      ? 'bg-black text-white shadow-sm' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* חלק תחתון של התפריט */}
        <div className="pt-4 border-t mt-6">
          <div className="text-xs text-gray-400 text-center">
            מערכת ניהול מאובטחת
          </div>
        </div>
      </aside>

      {/* תוכן העמוד הראשי של הניהול */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
