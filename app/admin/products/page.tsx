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
  const [uploading, setUploading] = useState(false);
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

  // העלאת תמונה ישירות למאחסן של Supabase
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setProduct({ ...product, image_url: data.publicUrl });
      setMessage('התמונה הועלתה בהצלחה! 🖼️');
    } catch (err: any) {
      alert('שגיאה בהעלאת תמונה: ' + err.message);
    } finally {
      setUploading(false);
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

      setMessage('המוצר נוסף בהצלחה לחנות! 🎉');
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

      {/* טופס הוספה עם העלאת קובץ תמונה */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-lg font-bold text-gray-800 mb-4">הוספת מוצר חדש עם תמונה</h2>

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

          {/* העלאת קובץ תמונה מהמכשיר */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תמונת מוצר (העלאה מהמכשיר)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full border rounded-xl p-2.5 bg-gray-50 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
            />
            {uploading && <p className="text-xs text-blue-600 mt-1">מעלה תמונה לענן...</p>}
            {product.image_url && (
              <div className="mt-2 flex items-center gap-2">
                <img src={product.image_url} alt="תצוגה מקדימה" className="w-16 h-16 object-cover rounded-lg border" />
                <span className="text-xs text-green-600 font-medium">התמונה נקלטה בהצלחה!</span>
              </div>
            )}
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
            disabled={loading || uploading}
            className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-md"
          >
            {loading ? 'שומר...' : 'הוסף מוצר לחנות 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
