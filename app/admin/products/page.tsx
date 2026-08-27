'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [kosher, setKosher] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
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

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingMain(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `prod_main_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (pubData) {
        setImageUrl(pubData.publicUrl);
      }
    } catch (err: any) {
      alert('שגיאה בהעלאת התמונה: ' + err.message);
    } finally {
      setUploadingMain(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setUploadingGallery(true);
      const newUrls: string[] = [...imageUrls];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `prod_gal_${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        if (pubData) {
          newUrls.push(pubData.publicUrl);
        }
      }
      setImageUrls(newUrls);
    } catch (err: any) {
      alert('שגיאה בהעלאת תמונות הגלריה: ' + err.message);
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (indexToRemove: number) => {
    setImageUrls(imageUrls.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      name,
      price: parseFloat(price) || 0,
      category,
      brand,
      kosher,
      image_url: imageUrl || imageUrls[0] || '',
      image_urls: imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []),
      short_description: shortDesc,
      description,
      specs,
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingId);
      if (error) alert('שגיאה בעדכון: ' + error.message);
      else {
        alert('המוצר עודכן בהצלחה! 🎉');
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
    setImageUrls(p.image_urls || (p.image_url ? [p.image_url] : []));
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
    setImageUrls([]);
    setShortDesc('');
    setDescription('');
    setSpecs('');
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900">ניהול מוצרים</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת מוצר קיים ✏️' : 'הוספת מוצר חדש ➕'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: טלפון כשר" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
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
            <label className="block text-xs font-bold text-gray-700 mb-1">תמונה ראשית (העלאה מהמכשיר)</label>
            <input type="file" accept="image/*" onChange={handleMainImageUpload} className="w-full border rounded-xl p-2 text-sm bg-gray-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white cursor-pointer" />
            {uploadingMain && <p className="text-xs text-blue-600 mt-1">מעלה תמונה ראשית...</p>}
            {imageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={imageUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                <span className="text-xs text-green-600 font-bold">הועלה בהצלחה ✓</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תמונות נוספות לגלריה (ניתן לבחור כמה יחד)</label>
          <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="w-full border rounded-xl p-2 text-sm bg-gray-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white cursor-pointer" />
          {uploadingGallery && <p className="text-xs text-blue-600 mt-1">מעלה תמונות לגלריה...</p>}
          
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative w-16 h-16 rounded-lg border overflow-hidden bg-gray-100 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeGalleryImage(index)} className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 flex items-center justify-center text-xs font-bold">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
          <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="תיאור קצר שיוצג בראש העמוד..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור מורחב..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">מפרט טכני</label>
            <textarea rows={4} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="נתונים טכניים..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black font-mono text-sm" />
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
