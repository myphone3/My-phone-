'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [storageFiles, setStorageFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [bannerRes, prodRes, storageRes] = await Promise.all([
      supabase.from('banners').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').or('is_published.is.null,is_published.eq.true'),
      supabase.storage.from('products').list('banners', { limit: 50 })
    ]);

    if (bannerRes.data) setBanners(bannerRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (storageRes.data) {
      const files = storageRes.data.map((f: any) => {
        const { data } = supabase.storage.from('products').getPublicUrl(`banners/${f.name}`);
        return data.publicUrl;
      });
      setStorageFiles(files);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
    if (uploadError) {
      alert('שגיאה בהעלאת התמונה: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setUploading(false);
    fetchData();
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      alert('נא להזין כותרת לבאנר');
      return;
    }

    const { error } = await supabase.from('banners').insert([
      {
        title,
        subtitle,
        image_url: imageUrl,
        link_product_id: linkProductId || null,
        is_active: isActive
      }
    ]);

    if (error) {
      alert('שגיאה בשמירת הבאנר: ' + error.message);
    } else {
      setTitle('');
      setSubtitle('');
      setImageUrl('');
      setLinkProductId('');
      setIsActive(true);
      fetchData();
      alert('הבאנר נוסף בהצלחה!');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('האם למחוק באנר זה?')) return;
    await supabase.from('banners').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">ניהול באנרים</h1>
          <p className="text-xs text-gray-500 font-medium">ניהול באנרים מתחלפים בעמוד הבית עם קישורים למוצרים.</p>
        </div>
        <Link href="/admin/products" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          ← חזרה לפאנל ניהול מוצרים
        </Link>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
        <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">הוספת באנר חדש</h2>
        <form onSubmit={handleAddBanner} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">כותרת ראשית</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: מבצע ענק על מכשירים כשרים"
                className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">כותרת משנה</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="לדוגמה: הנחות מיוחדות לשבוע הקרוב בלבד"
                className="w-full bg-gray-50 border rounded-xl p-3 text-xs font-medium outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">העלאת קובץ חדש מהמכשיר או בחירה מהמדיה באתר</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full bg-gray-50 border rounded-xl p-2 text-xs font-medium file:ml-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer mb-2"
              />
              {uploading && <p className="text-[11px] text-orange-600">מעלה תמונה...</p>}
              
              {storageFiles.length > 0 && (
                <div className="mt-2">
                  <span className="text-[11px] font-bold text-gray-600 block mb-1">או בחר תמונה קיימת מהמדיה:</span>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {storageFiles.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(url)}
                        className={`w-12 h-12 rounded-lg border overflow-hidden shrink-0 transition cursor-pointer ${imageUrl === url ? 'border-orange-600 ring-2 ring-orange-600/30' : 'border-gray-200'}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-sm">
            + הוסף באנר חדש
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">באנרים פעילים בחנות</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="border rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-gray-50/50">
              <div className="space-y-1">
                <h3 className="font-black text-sm text-gray-900">{b.title}</h3>
                <p className="text-xs text-gray-600">{b.subtitle}</p>
              </div>
              <button onClick={() => handleDeleteBanner(b.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer w-fit">
                מחיקה 🗑️
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
