'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function StoreHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsOpen(false);
    window.location.reload();
  };

  return (
    <header className="bg-white border-b sticky top-0 z-50 px-4 py-3" dir="rtl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* לוגו ושם החנות החדש */}
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="NEW PHONE" className="w-10 h-10 object-contain rounded-full shadow-xs" />
          <div className="flex flex-col">
            <span className="font-black text-base text-gray-900 tracking-wider">NEW PHONE</span>
            <span className="text-[10px] text-gray-500 font-bold">הפלאפון החדש שלי</span>
          </div>
        </Link>

        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          <Link href="/admin/products" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5">
            ⚙️ פאנל ניהול
          </Link>

          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-full bg-gray-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-black transition cursor-pointer"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">👤</span>
            )}
          </button>

          {isOpen && (
            <div className="absolute left-0 top-12 w-80 bg-white border rounded-3xl shadow-xl p-4 space-y-3 z-50 text-right" dir="rtl">
              <div className="border-b pb-2 text-xs font-bold text-gray-600 truncate px-1">
                {user?.email ? user.email : 'משתמש מחובר'}
              </div>

              <div className="space-y-1 text-xs font-medium text-gray-800">
                <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-xl transition">
                  <span>🔔</span>
                  <span>הזמנה שלך נקלטה בהצלחה!</span>
                </div>
                <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-xl transition">
                  <span>🔥</span>
                  <span>מוצרים חדשים הגיעו לחנות</span>
                </div>
              </div>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full mt-2 bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  התנתק מהמערכת 🚪
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-center w-full mt-2 bg-black text-white hover:bg-gray-800 py-2.5 rounded-2xl text-xs font-bold transition"
                >
                  התחברות / הרשמה
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
