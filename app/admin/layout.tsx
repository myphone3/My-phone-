'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'ניהול מוצרים 📦', href: '/admin/products' },
    { name: 'ניהול הזמנות 🧾', href: '/admin/orders' },
    { name: 'ניהול קטגוריות 📁', href: '/admin/categories' },
    { name: 'ניהול מותגים 🏷️', href: '/admin/brands' },
    { name: 'ניהול כשרויות ⭐', href: '/admin/kosher' },
    { name: 'ספריית מדיה 🖼️', href: '/admin/media' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir="rtl">
      <aside className="w-full md:w-64 bg-white border-l p-6 space-y-6">
        <h2 className="text-xl font-black text-gray-900 border-b pb-4">פאנל ניהול 🛠️</h2>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-3 rounded-xl font-bold transition text-sm ${
                  isActive ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="pt-6 border-t">
          <Link href="/" className="block text-center bg-gray-100 text-gray-800 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition">
            מעבר לחנות 🏠
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
