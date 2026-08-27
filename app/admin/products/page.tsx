'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // שדות הטופס
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [kosher, setKosher] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlsStr, setImageUrlsStr] = useState(''); // תמונות מופרדות בפסיקים
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const kosherOptions = [
    'בד"ץ העדה החרדית',
    'הרב לנדא',
    'קהילות',
    'מחזיקי דת',
    'בד"ץ בית יוסף',
    'כשר רגיל / אישור רבנות',
    'ללא כשרות'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*').order('id', { ascending: false });
    const { data: catData } = await supabase.from('categories').select('*');
    const { data: brandData } = await supabase.from('brands').select('*');

    if (prodData) setProducts(prodData);
    if (catData) setCategories(catData);
    if (brandData) setBrands(brandData);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // המרת מחרוזת תמונות מופרדות בפסיקים למערך
    const urlsArray = imageUrlsStr
      ? imageUrlsStr.split(',').map((u) => u.trim()).filter(Boolean)
      : (imageUrl ? [imageUrl] : []);

    const productData = {
      name,
      price: parseFloat(price) || 0,
      category,
      brand,
      kosher,
      image_url: imageUrl || urlsArray[0] || '',
      image_urls: urlsArray,
      short_description: shortDesc,
      description,
      specs,
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingId);
      if (error) alert('שגיאה בעדכון: ' + error.message);
      else {
        alert עודכן בהצלחה! 🎉);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase.from('products').insert([productData]);
      if (error) alert('שגיאה בהוספה: ' + error.message);
      else {
        alert('המוצר נוסף בהצלחה! 📦');
        resetForm();
        fetchData();
      }
    }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPrice(p.price || '');
    setCategory(p.category || '');
    setBrand(p.brand || '');
    setKosher(p.kosher || '');
    setImageUrl(p.image_url || '');
    setImageUrlsStr(p.image_urls ? p.image_urls.join(', ') : '');
    setShortDesc(p.short_description || '');
    setDescription(p.description || '');
    setSpecs(p.specs || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchData();
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setCategory('');
    setBrand('');
    setKosher('');
    setImageUrl('');
    setImageUrlsStr('');
    setShortDesc('');
    setDescription('');
    setSpecs('');
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-gray-900">ניהול מוצרים</h1>
        <Link href="/admin/media" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-sm font-bold transition">
          🖼️ מעבר לספריית המדיה להעתקת קישורים
        </Link>
      </div>

      {/* טופס הוספה / עריכה */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת מוצר קיים ✏️' : 'הוספת מוצר חדש ➕'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: טלפון כשר שיומי" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="">בחר קטגוריה...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">מותג</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="">בחר מותג...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">כשרות</label>
            <select value={kosher} onChange={(e) => setKosher(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="">בחר כשרות...</option>
              {kosherOptions.map((k, i) => (
                <option key={i} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">קישור תמונה ראשית</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">קישורים נוספים לתמונות (מופרדים בפסיקים `,`)</label>
          <input type="text" value={imageUrlsStr} onChange={(e) => setImageUrlsStr(e.target.value)} placeholder="url1, url2, url3..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
          <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="משפטים קצרים שיוצגו בראש העמוד..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור מורחב על המוצר..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">מפרט טכני</label>
            <textarea rows={4} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="מעבד, זיכרון, סוללה..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black font-mono text-sm" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md">
            {editingId ? 'עדכן מוצר 💾' : 'הוסף מוצר לחנות 🚀'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition">
              ביטול עריכה ❌
            </button>
          )}
        </div>
      </form>

      {/* רשימת מוצרים קיימים */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800">מוצרים קיימים במערכת ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין מוצרים.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50 rounded-xl border gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                    <img src={p.image_url || p.image_urls?.[0]} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded font-medium">₪{p.price}</span>
                      {p.category && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">📁 {p.category}</span>}
                      {p.brand && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">🏷️ {p.brand}</span>}
                      {p.kosher && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">⭐ {p.kosher}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <button onClick={() => handleEdit(p)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold transition">
                    ערוך ✏️
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition">
                    מחק 🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
