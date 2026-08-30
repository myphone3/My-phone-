'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא שם ומחיר לפחות.');
      return;
    }

    const { error } = await supabase.from('products').insert([
      {
        name,
        price: parseFloat(price),
        description,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      alert('שגיאה בהוספת המוצר: ' + error.message);
    } else {
      setName('');
      setPrice('');
      setDescription('');
      setImageUrl('');
      fetchProducts();
      alert('המוצר נוסף בהצלחה! 🎉');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('שגיאה במחיקת המוצר: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-12" dir="rtl">
      {/* תפריט ניהול עליון */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">🛠️ פאנל ניהול חנות</h1>
            <nav className="hidden md:flex items-center gap-2">
              <Link href="/admin/products" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">
                מוצרים 📱
              </Link>
              <Link href="/admin/customers" className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold transition">
                לקוחות והודעות 👥
              </Link>
              <Link href="/admin/coupons" className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold transition">
                קופונים 🎟️
              </Link>
            </nav>
          </div>
          <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold transition">
            חזרה לחנות 🏠
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* טופס הוספת מוצר חדש */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-gray-900">הוספת מוצר חדש לחנות</h2>
          <form onSubmit={addProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
              <input
                type="text"
                placeholder="למשל: iPhone 15 Pro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪)</label>
              <input
                type="number"
                placeholder="3999"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קישור לתמונה (URL)</label>
              <input
                type="text"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור המוצר</label>
              <textarea
                placeholder="תיאור קצר על המפרט והתכונות..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black h-20 resize-none"
              />
            </div>
            <div>
              <button
                type="submit"
                className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-sm w-full sm:w-auto"
              >
                + הוסף מוצר למערכת
              </button>
            </div>
          </form>
        </div>

        {/* טבלת מוצרים קיימים */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-gray-900">מוצרים קיימים בחנות ({products.length})</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-medium">טוען מוצרים...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">אין מוצרים בניהול כרגע.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b text-xs text-gray-500 font-bold">
                    <th className="pb-3 pr-4">תמונה</th>
                    <th className="pb-3">שם המוצר</th>
                    <th className="pb-3">מחיר</th>
                    <th className="pb-3">תיאור</th>
                    <th className="pb-3 text-left pl-4">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-4 pr-4">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-xl border" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400 font-bold">
                            אין
                          </div>
                        )}
                      </td>
                      <td className="py-4 font-bold text-gray-900">{p.name}</td>
                      <td className="py-4 font-black text-gray-900">₪{p.price}</td>
                      <td className="py-4 text-gray-500 text-xs max-w-xs truncate">{p.description || 'ללא תיאור'}</td>
                      <td className="py-4 text-left pl-4">
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          מחק 🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
