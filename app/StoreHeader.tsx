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
  const [loading, setLoading] = useState(false);

  // רשימת המיילים המורשים להיות מנהלים בחנות (הכנס כאן את המייל שלך)
  const ADMIN_EMAILS = [
    'd0587223040@gmail.com',
    'd0556771356@gmail.com',
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    const handleCartUpdate = () => updateCartCount();
    window.addEventListener('cartUpdated', handleCartUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('storage', handleCartUpdate);
    };
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      alert('שגיאה בהתחברות עם Google: ' + error.message);
      setLoading(false);
    }
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
                <span className="text-xs text-gray-600 font-medium hidden md:inline">{user.email}</span>
                <button onClick={handleLogout} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200">
                  התנתק
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="text-xs bg-black text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition shadow-sm flex items-center gap-2">
                <span>🌐</span> התחברות עם Google
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

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 text-center">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-gray-900">התחברות לחנות 🔐</h3>
              <button type="button" onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-black font-bold text-lg">✕</button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              התחבר מהר ובבטחה באמצעות חשבון ה-Google שלך בלחיצה אחת.
            </p>

            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="w-full border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-800 py-3.5 rounded-2xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'מעביר להתחברות...' : 'התחבר עם Google'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
