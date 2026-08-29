'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function StoreHeader() {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // רשימת המיילים המורשים להיות מנהלים בחנות
  const ADMIN_EMAILS = [
    'your-email@gmail.com',
    'manager2@gmail.com',
  ];

  const updateCartCount = () => {
    try {
      const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const total = savedCart.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      setCartCount(total);
    } catch (e) {
      setCartCount(0);
    }
  };

  useEffect(() => {
    updateCartCount();
    checkUser();

    const handleCartUpdate = () => updateCartCount();
    window.addEventListener('cartUpdated', handleCartUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('storage', handleCartUpdate);
    };
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('שגיאת התחברות: ' + error.message);
    } else {
      checkUser();
      setShowLoginModal(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin = user && ADMIN_EMAILS.map(e => e.trim().toLowerCase()).includes(user.email?.trim().toLowerCase());

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-40 shadow-xs" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-black text-gray-900 tracking-tight">
            📱 החנות שלי
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <Link href="/admin/products" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-800 transition">
                  מעבר לפאנל ניהול 🛠️
                </Link>
                <button onClick={handleLogout} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200">
                  התנתק
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="text-xs text-gray-500 hover:text-black font-semibold px-3 py-2 rounded-xl border bg-gray-50">
                כניסת מנהלים 🔐
              </button>
            )}

            <Link 
              href="/cart"
              className="relative bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition shadow-sm"
            >
              <span>🛒 עגלה</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-black">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={handleLogin} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">התחברות מנהל מערכת</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@store.com" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">סיסמה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={loading} className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm">
                {loading ? 'מתחבר...' : 'התחבר'}
              </button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold text-sm">
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
