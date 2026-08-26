'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
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
    } catch (err: any) {
      console.error(err);
      setMessage('שגיאה בשמירת המוצר: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
          מערכת ניהול - הוספת מוצר חדש
        </h1>

        {message && (
          <div className={`p-4 mb-4 rounded-lg text-sm font-medium ${message.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
              className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none"
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
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none"
                placeholder="450"
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">קטגוריה</label>
              <select 
                value={product.category}
                onChange={(e) => setProduct({...product, category: e.target.value})}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none bg-white"
              >
                <option value="כשר">תומך כשר</option>
                <option value="סמארטפונים">סמארטפונים</option>
                <option value="אביזרים">אביזרים</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">כמות במלאי</label>
              <input 
                type="number" 
                value={product.stock}
                onChange={(e) => setProduct({...product, stock: e.target.value})}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">קישור לתמונה (URL)</label>
              <input 
                type="text" 
                value={product.image_url}
                onChange={(e) => setProduct({...product, image_url: e.target.value})}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תיאור מלא של המוצר (מלל ומפרט)</label>
            <textarea 
              rows={4}
              value={product.description}
              onChange={(e) => setProduct({...product, description: e.target.value})}
              className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-black outline-none"
              placeholder="הכנס כאן את כל המפרט הטכני והמידע על המוצר..."
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-md"
          >
            {loading ? 'שומר במערכת...' : 'הוסף מוצר לחנות 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
