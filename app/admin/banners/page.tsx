'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEndTime, setAnnouncementEndTime] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [bannerRes, prodRes, settingsRes] = await Promise.all([
      supabase.from('banners').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').or('is_published.is.null,is_published.eq.true'),
      supabase.from('settings').select('*').single()
    ]);

    if (bannerRes.data) setBanners(bannerRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (settingsRes.data) {
      setAnnouncementText(settingsRes.data.announcement_text || '');
      setAnnouncementEndTime(settingsRes.data.announcement_end_time ? new Date(settingsRes.data.announcement_end_time).toISOString().slice(0, 16) : '');
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
    if (!confirm('האם אתה בטוח שברצונך למחוק באנר זה?')) return;
    await supabase.from('banners').delete().eq('id', id);
    fetchData();
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
    if (error) {
      alert('שגיאה בשמירת ההגדרות: ' + error.message);
    } else {
      alert('הגדרות פס המבצעים עודכנו בהצלחה!');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      {/* כותרת הפאנל */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">פאנל ניהול האתר</h1>
          <p className="text-xs text-gray-500 font-medium">ניהול מתקדם של באנרים, מבצעים ומוצרים.</p>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          חזרה לחנות ➔
        </Link>
      </div>

      {/* טאבים לניווט בתוך פאנל הניהול */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
        >
          📦 ניהול מוצרים
        </Link>
        <Link
          href="/admin/banners"
          className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-orange-600 text-white shadow-sm"
        >
          🖼️ ניהול באנרים והגדרות עמוד הבית
        </Link>
      </div>

      {/* ניהול פס מבצעים עליון וטיימר */}
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

      {/* הוספת באנר חדש */}
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
              <label className="block text-xs font-bold text-gray-700 mb-1">העלאת תמונת באנר מהמכשיר</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full bg-gray-50 border rounded-xl p-2 text-xs font-medium file:ml-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
              />
              {uploading && <p className="text-[11px] text-orange-600 mt-1">מעלה תמונה...</p>}
              {imageUrl && <p className="text-[11px] text-green-600 mt-1 truncate">✓ התמונה נטענה בהצלחה</p>}
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
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
            />
            <label htmlFor="isActive" className="text-xs font-bold text-gray-700 cursor-pointer">הצג באנר זה באתר כפעיל</label>
          </div>

          <button
            type="submit"
            className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-sm"
          >
            + הוסף באנר חדש
          </button>
        </form>
      </div>

      {/* רשימת באנרים קיימים */}
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
  );
}
