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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUpMode) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert('שגיאת הרשמה: ' + error.message);
      } else {
        alert('נרשמת בהצלחה! אנא בדוק את תיבת המייל שלך לאישור החשבון.');
        setShowAuthModal(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('שגיאת התחברות: ' + error.message);
      } else {
        checkUser();
        setShowAuthModal(false);
      }
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

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link href="/admin/products" className="bg-black text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-800 transition">
                    ניהול 🛠️
                  </Link>
                )}
                <button onClick={handleLogout} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200">
                  התנתק
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setIsSignUpMode(false); setShowAuthModal(true); }} className="text-xs text-gray-700 font-semibold px-3 py-2 rounded-xl border bg-gray-50 hover:bg-gray-100">
                  התחברות 🔐
                </button>
                <button onClick={() => { setIsSignUpMode(true); setShowAuthModal(true); }} className="text-xs bg-black text-white font-semibold px-3 py-2 rounded-xl hover:bg-gray-800 transition">
                  הרשמה ✍️
                </button>
              </div>
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

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={handleAuthSubmit} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-black text-gray-900">
                {isSignUpMode ? 'יצירת חשבון חדש ✍️' : 'התחברות לחשבון 🔐'}
              </h3>
              <button type="button" onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-black font-bold">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your-email@gmail.com" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">סיסמה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
            </div>

            <div className="pt-2 space-y-2">
              <button type="submit" disabled={loading} className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition shadow-md">
                {loading ? 'מעבד...' : (isSignUpMode ? 'הירשם עכשיו 🚀' : 'התחברות 🔓')}
              </button>

              <div className="text-center pt-2">
                {isSignUpMode ? (
                  <button type="button" onClick={() => setIsSignUpMode(false)} className="text-xs text-gray-600 hover:underline">
                    כבר יש לך חשבון? התחבר כאן
                  </button>
                ) : (
                  <button type="button" onClick={() => setIsSignUpMode(true)} className="text-xs text-gray-600 hover:underline">
                    אין לך חשבון עדיין? הירשם כאן
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
