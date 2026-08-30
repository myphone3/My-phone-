'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StoreHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // אם אנחנו נמצאים בדפי הניהול - הסתר לחלוטין את התפריט העליון של החנות
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) {
        fetchNotifications(session.user.id);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchNotifications(session.user.id);
      } else {
        setNotifications([]);
      }
    });

    // מעקב אחר פריטים בעגלת הקניות
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const totalItems = cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        setCartCount(totalItems);
      } catch (e) {
        setCartCount(0);
      }
    };
    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false });
    
    if (data) {
      setNotifications(data);
    }
  };

  return (
    <header className="bg-white border-b sticky top-0 z-40 shadow-sm" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        {/* לוגו החנות */}
        <Link href="/" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          📱 <span>חנות הסלולר</span>
        </Link>

        {/* פעולות ותפריט מצד שמאל */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* כפתור מעבר מהיר לניהול */}
          <Link 
            href="/admin/products" 
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1"
            title="פאנל ניהול"
          >
            🛠️ ניהול
          </Link>

          {/* עגלת קניות */}
          <Link 
            href="/cart" 
            className="relative p-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm transition flex items-center justify-center"
            title="עגלת קניות"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shadow-sm">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {/* פעמון התראות */}
              <button 
                onClick={() => setShowNotificationsModal(true)}
                className="relative p-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm transition flex items-center justify-center cursor-pointer"
                title="התראות ומבצעים"
              >
                🔔
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shadow-sm">
                    {notifications.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => supabase.auth.signOut()}
                className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition cursor-pointer"
              >
                התנתק 🚪
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="bg-black text-white px-4 py-2.5 rounded-2xl text-xs font-bold hover:bg-gray-800 transition shadow-sm"
            >
              התחברות / הרשמה 👤
            </Link>
          )}
        </div>
      </div>

      {/* מודל פופ-אפ להצגת ההתראות והמבצעים */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-gray-900">התראות ומבצעים אישיים 🔔</h3>
              <button 
                onClick={() => setShowNotificationsModal(false)} 
                className="text-gray-400 hover:text-black font-bold text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <span className="text-3xl">📭</span>
                <p className="text-gray-500 text-sm font-medium">אין התראות חדשות כרגע.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 hover:bg-gray-100/60 transition">
                    <h4 className="font-bold text-sm text-gray-900">{n.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-gray-400 block pt-1">
                      {new Date(n.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
