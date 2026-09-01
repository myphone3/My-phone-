'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

import Link from 'next/link';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'banners'>('products');

  // --- States for Products ---
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variantsInput, setVariantsInput] = useState(''); // שדה לניהול גרסאות (מופרדות בפסיקים)
  const [isPublished, setIsPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- States for Banners & Settings ---
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerImgUrl, setBannerImgUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const [bannerActive, setBannerActive] = useState(true);
  const [bannerUploading, setBannerUploading] = useState(false);

  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEndTime, setAnnouncementEndTime] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const [prodRes, catRes, brandRes, bannerRes, settingsRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('brands').select('*'),
      supabase.from('banners').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').single()
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bannerRes.data) setBanners(bannerRes.data);
    if (settingsRes.data) {
      setAnnouncementText(settingsRes.data.announcement_text || '');
      setAnnouncementEndTime(settingsRes.data.announcement_end_time ? new Date(settingsRes.data.announcement_end_time).toISOString().slice(0, 16) : '');
    }
    setLoading(false);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

    if (uploadError) {
      alert('שגיאה בהעלאת התמונה: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

    if (uploadError) {
      alert('שגיאה בהעלאת התמונה: ' + uploadError.message);
      setBannerUploading(false);
      return;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    setBannerImgUrl(data.publicUrl);
    setBannerUploading(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא לפחות שם מוצר ומחיר');
      return;
    }

    // המרת מחרוזת הגרסאות ממערך פסיקים למערך נתונים
    const variantsArray = variantsInput
      ? variantsInput.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

    const payload = {
      name,
      price: Number(price),
      sale_price: salePrice ? Number(salePrice) : null,
      category,
      brand,
      description,
      image_url: imageUrl,
      product_variants: variantsArray,
      is_published: isPublished
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId);
      if (error) alert('שגיאה בעדכון המוצר: ' + error.message);
      else {
        alert('המוצר עודכן בהצלחה!');
        resetProductForm();
        fetchAllData();
      }
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) alert('שגיאה בהוספת המוצר: ' + error.message);
      else {
        alert('המוצר נוסף בהצלחה!');
        resetProductForm();
        fetchAllData();
      }
    }
  };

  const resetProductForm = () => {
    setName('');
    setPrice('');
    setSalePrice('');
    setCategory('');
    setBrand('');
    setDescription('');
    setImageUrl('');
    setVariantsInput('');
    setIsPublished(true);
    setEditingId(null);
  };

  const handleEditProduct = (prod: any) => {
    setEditingId(prod.id);
    setName(prod.name || '');
    setPrice(prod.price || '');
    setSalePrice(prod.sale_price || '');
    setCategory(prod.category || '');
    setBrand(prod.brand || '');
    setDescription(prod.description || '');
    setImageUrl(prod.image_url || '');
    setVariantsInput(prod.product_variants ? prod.product_variants.join(', ') : '');
    setIsPublished(prod.is_published ?? true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchAllData();
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle) {
      alert('נא להזין כותרת לבאנר');
      return;
    }

    const { error } = await supabase.from('banners').insert([
      {
        title: bannerTitle,
        subtitle: bannerSubtitle,
        image_url: bannerImgUrl,
        link_product_id: linkProductId || null,
        is_active: bannerActive
      }
    ]);

    if (error) {
      alert('שגיאה בשמירת הבאנר: ' + error.message);
    } else {
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerImgUrl('');
      setLinkProductId('');
      setBannerActive(true);
      fetchAllData();
      alert('הבאנר נוסף בהצלחה!');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('האם למחוק באנר זה?')) return;
    await supabase.from('banners').delete().eq('id', id);
    fetchAllData();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    const { data: existing } = await supabase.from('settings').select('*').limit(1);

    let error;
    const payload = {
      announcement_text: announcementText,
      announcement_end_time: announcementEndTime ? new Date(announcementEndTime).toISOString() : null
    };

    if (existing && existing.length > 0) {
      const res = await supabase.from('settings').update(payload).eq('id', existing[0].id);
      error = res.error;
    } else {
      const res = await supabase.from('settings').insert([payload]);
      error = res.error;
    }

    setSavingSettings(false);
    if (error) alert('שגיאה בשמירת ההגדרות: ' + error.message);
    else alert('הגדרות פס המבצעים עודכנו בהצלחה!');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">פאנל ניהול האתר</h1>
          <p className="text-xs text-gray-500 font-medium">ניהול מלא של מוצרים, גרסאות, באנרים ומבצעי החנות.</p>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          חזרה לחנות ➔
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'products' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          📦 ניהול מוצרים
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'banners' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          🖼️ ניהול באנרים והגדרות עמוד הבית
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">טוען נתונים...</div>
      ) : activeTab === 'products' ? (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              {editingId ? 'עריכת מוצר קיים' : 'הוספת מוצר חדש לחנות'}
            </h2>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="לדוגמה: Xiaomi Redmi Note 11"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="999"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מחיר מבצע (אופציונלי)</label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="799"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="לדוגמה: מכשירים כשרים"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מותג</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="לדוגמה: Xiaomi"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              {/* שדה הוספת גרסאות / נפחי אחסון */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">גרסאות / נפחי אחסון (מופרדים בפסיקים)</label>
                <input
                  type="text"
                  value={variantsInput}
                  onChange={(e) => setVariantsInput(e.target.value)}
                  placeholder="לדוגמה: 64GB, 128GB, 256GB"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">השאר ריק אם אין גרסאות מיוחדות למכשיר זה.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תמונת המוצר</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageUpload}
                  className="w-full bg-gray-50 border rounded-xl p-2 text-xs font-medium file:ml-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
                />
                {uploading && <p className="text-[11px] text-orange-600 mt-1">מעלה תמונה...</p>}
                {imageUrl && <p className="text-[11px] text-green-600 mt-1 truncate">✓ תמונה נטענה בהצלחה</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תיאור המוצר</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="פרטים על המוצר..."
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                ></textarea>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pub"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300"
                />
                <label htmlFor="pub" className="text-xs font-bold text-gray-700 cursor-pointer">הצג מוצר זה בחנות</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {editingId ? 'עדכן מוצר' : '+ הוסף מוצר'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    ביטול עריכה
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">כל המוצרים בחנות ({products.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div key={prod.id} className="border rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-gray-50/40">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                      {prod.image_url ? <img src={prod.image_url} alt="" className="w-full h-full object-contain" /> : <span>📦</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-xs text-gray-900 truncate">{prod.name}</h4>
                      <p className="text-xs text-orange-600 font-bold">₪{prod.sale_price || prod.price}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t text-xs">
                    <button onClick={() => handleEditProduct(prod)} className="text-blue-600 font-bold hover:underline cursor-pointer">עריכה ✏️</button>
                    <button onClick={() => handleDeleteProduct(prod.id)} className="text-red-500 font-bold hover:underline cursor-pointer">מחיקה 🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">ניהול פס מבצעים עליון וטיימר (שורה אחת)</h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">טקסט הפס העליון</label>
                  <input
                    type="text"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="לדוגמה: 🚚 משלוח מהיר עד הבית | מבצעי ענק!"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">תאריך ושעה לסיום המבצע (להפעלת הטיימר)</label>
                  <input
                    type="datetime-local"
                    value={announcementEndTime}
                    onChange={(e) => setAnnouncementEndTime(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-orange-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-orange-700 transition cursor-pointer shadow-sm"
              >
                {savingSettings ? 'שומר...' : 'שמור הגדרות פס מבצעים'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">הוספת באנר חדש</h2>
              <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4 mt-3 text-xs text-orange-900 space-y-1">
                <p className="font-bold">💡 מידות מומלצות להעלאה:</p>
                <ul className="list-disc list-inside space-y-0.5 text-orange-800">
                  <li><strong>מחשב (Desktop):</strong> רוחב 1920px על גובה 600px.</li>
                  <li><strong>נייד (Mobile):</strong> רוחב 800px על גובה 1000px.</li>
                </ul>
              </div>
            </div>

            <form onSubmit={handleAddBanner} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">כותרת ראשית</label>
                  <input
                    type="text"
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    placeholder="לדוגמה: מבצע ענק על מכשירים כשרים"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">כותרת משנה</label>
                  <input
                    type="text"
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    placeholder="לדוגמה: הנחות מיוחדות לשבוע הקרוב בלבד"
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">העלאת תמונת באנר מהמכשיר</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerImageUpload}
                    className="w-full bg-gray-50 border rounded-xl p-2 text-xs font-medium file:ml-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
                  />
                  {bannerUploading && <p className="text-[11px] text-orange-600 mt-1">מעלה תמונה...</p>}
                  {bannerImgUrl && <p className="text-[11px] text-green-600 mt-1 truncate">✓ התמונה נטענה בהצלחה</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">קישור למוצר ספציפי בלחיצה על הבאנר</label>
                  <select
                    value={linkProductId}
                    onChange={(e) => setLinkProductId(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
                  >
                    <option value="">-- ללא קישור למוצר --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bActive"
                  checked={bannerActive}
                  onChange={(e) => setBannerActive(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300"
                />
                <label htmlFor="bActive" className="text-xs font-bold text-gray-700 cursor-pointer">הצג באנר זה באתר כפעיל</label>
              </div>

              <button
                type="submit"
                className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-sm"
              >
                + הוסף באנר חדש
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">באנרים פעילים בחנות</h2>
            {banners.length === 0 ? (
              <p className="text-xs text-gray-500 py-8 text-center">אין באנרים במערכת כרגע.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {banners.map((b) => (
                  <div key={b.id} className="border rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-gray-50/50">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-sm text-gray-900">{b.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {b.is_active ? 'פעיל' : 'מוסתר'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{b.subtitle}</p>
                      {b.link_product_id && <p className="text-[10px] text-orange-600 font-bold">🔗 מקושר למוצר</p>}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-[10px] text-gray-400">נוצר: {new Date(b.created_at).toLocaleDateString('he-IL')}</span>
                      <button
                        onClick={() => handleDeleteBanner(b.id)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        מחיקה 🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
