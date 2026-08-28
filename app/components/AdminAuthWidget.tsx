'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminAuthWidget() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      setUser(data.user);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('שגיאת התחברות: ' + error.message);
    } else {
      checkUser();
      setIsOpen(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="py-6 text-center border-t mt-12 bg-gray-50" dir="rtl">
      {user ? (
        <div className="flex justify-center items-center gap-4">
          <span className="text-xs text-gray-600 font-bold">מחובר כמנהל ({user.email})</span>
          <Link href="/admin/products" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-gray-800 transition">
            מעבר לפאנל ניהול 🛠️
          </Link>
          <button onClick={handleLogout} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold">
            התנתק 🔓
          </button>
        </div>
      ) : (
        <div>
          {!isOpen ? (
            <button onClick={() => setIsOpen(true)} className="text-xs text-gray-400 hover:text-gray-700 transition font-medium">
              כניסת מנהלים 🔐
            </button>
          ) : (
            <form onSubmit={handleLogin} className="max-w-xs mx-auto bg-white p-4 rounded-2xl border shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-gray-800">התחברות פאנל ניהול</h4>
              <input 
                type="email" 
                placeholder="אימייל מנהל..." 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full border rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-black" 
                required 
              />
              <input 
                type="password" 
                placeholder="סיסמה..." 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full border rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-black" 
                required 
              />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-black text-white py-2 rounded-xl text-xs font-bold">
                  {loading ? 'מתחבר...' : 'התחבר'}
                </button>
                <button type="button" onClick={() => setIsOpen(false)} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs">
                  ביטול
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
