'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function StoreHeader() {
  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  
  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // רשימת כל כתובות המייל המורשים להיות מנהלים בחנות (הוסף כאן את המיילים הרצויים)
  const ADMIN_EMAILS = [
    'your-email@gmail.com',
    'manager2@gmail.com',
  ];

  useEffect(() => {
    updateCartCount();
    checkUser();

    const handleStorageChange = () => updateCartCount();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cartUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleStorageChange);
    };
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  };

  const updateCartCount = () => {
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(savedCart);
    const total = savedCart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    setCartCount(total);
  };

  const handleOpenCart = () => {
    updateCartCount();
    setIsCartOpen(true);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cartItems];
    newCart[index].quantity = (newCart[index].quantity || 1) + delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    updateCartCount();
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!customerName || !customerPhone) {
      alert('אנא מלא שם ומספר טלפון');
      return;
    }

    try {
      const { error } = await supabase.from('orders').insert([{
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress || 'איסוף עצמי',
        items: cartItems,
        total: calculateTotal(),
        status: 'בטיפול'
      }]);

      if (error) throw error;

      alert('ההזמנה בוצעה בהצלחה ונשלחה לניהול! 🎉');
      localStorage.removeItem('cart');
      setCartItems([]);
      setCartCount(0);
      setIsCartOpen(false);
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err: any) {
      alert('שגיאה בביצוע ההזמנה: ' + err.message);
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

            <button 
              onClick={handleOpenCart}
              className="relative bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition shadow-sm"
            >
              <span>🛒 עגלה</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-black">
                  {cartCount}
                </span>
              )}
            </button>
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

      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" dir="rtl">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-200">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-black text-gray-900">עגלת הקניות שלך 🛒</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-black font-bold text-lg bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cartItems.length === 0 ? (
                <p className="text-gray-400 text-center py-20">העגלה שלך ריקה כרגע.</p>
              ) : (
                cartItems.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-2xl border flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                      <div className="text-xs text-gray-500 space-x-2 space-x-reverse mt-0.5">
                        {item.selectedVersion && <span>גרסה: {item.selectedVersion}</span>}
                        {item.selectedStorage && <span>נפח: {item.selectedStorage}</span>}
                        {item.selectedColor && <span>צבע: {item.selectedColor}</span>}
                      </div>
                      <div className="text-sm font-black text-black mt-1">₪{item.price}</div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border">
                      <button onClick={() => updateQuantity(index, -1)} className="text-gray-500 font-bold px-2">-</button>
                      <span className="text-xs font-bold">{item.quantity || 1}</span>
                      <button onClick={() => updateQuantity(index, 1)} className="text-gray-500 font-bold px-2">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <form onSubmit={handleCheckout} className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <input type="text" placeholder="שם מלא *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs outline-none" required />
                  <input type="tel" placeholder="טלפון נייד *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs outline-none" required />
                  <input type="text" placeholder="כתובת / איסוף עצמי" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs outline-none" />
                </div>

                <div className="flex justify-between items-center text-lg font-black border-t pt-3">
                  <span>סה״כ לתשלום:</span>
                  <span>₪{calculateTotal()}</span>
                </div>

                <button type="submit" className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-md text-sm">
                  אישור הזמנה ושלח 🚀
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
