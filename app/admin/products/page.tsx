'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [product, setProduct] = useState({
    name: '',
    price: '',
    category: 'כשר',
    stock: '',
    description: '',
    image_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data) setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.from('products').insert([
        {
          name: product.name,
          price: Number(product.price),
          category: product.category,
          stock: Number(product.stock),
          description: product.description,
          image_url: product.image_url
        }
      ]);

      if (error) throw error;

      setMessage('המוצר נוסף בהצלחה למערכת! 🎉');
      setProduct({
        name: '',
        price: '',
        category: 'כשר',
        stock: '',
        description: '',
        image_url: ''
      });
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      setMessage('שגיאה בשמירת המוצר: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול מוצרים</h1>

      {/* טופס הוספת מוצר */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-lg font-bold text-gray-800 mb-4">הוספת מוצר חדש לחנות</h2>

        {message && (
          <div className={`p-3 mb-4 rounded-xl text-sm font-medium ${message.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">שם המוצר</label>
            <input 
              type="text" 
              value={product.name}
              onChange={(e) => setProduct({...product, name: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="לדוגמה: מכשיר כשר טאצ'"
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">מחיר (₪)</label>
              <input 
                type="number" 
                value={product.price}
                onChange={(e) => setProduct({...product, price: e.target.value})}
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="450"
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">כמות במלאי</label>
              <input 
                type="number" 
                value={product.stock}
                onChange={(e) => setProduct({...product, stock: e.target.value})}
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">קישור לתמונה (URL)</label>
            <input 
              type="text" 
              value={product.image_url}
              onChange={(e) => setProduct({...product, image_url: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תיאור מלא של המוצר</label>
            <textarea 
              rows={3}
              value={product.description}
              onChange={(e) => setProduct({...product, description: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="מפרט טכני ופרטים נוספים..."
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-sm"
          >
            {loading ? 'שומר...' : 'הוסף מוצר 🚀'}
          </button>
        </form>
      </div>

      {/* רשימת המוצרים הקיימים */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-lg font-bold text-gray-800 mb-4">המוצרים במערכת ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין מוצרים.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-3">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg" />}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">₪{p.price} | מלאי: {p.stock ?? 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
