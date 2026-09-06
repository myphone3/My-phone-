'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBanners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [desktopImageUrl, setDesktopImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // הגדרות פס מבצעים עליון וטיימר
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEndTime, setAnnouncementEndTime] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  // גלריית תמונות גדולה וברורה
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showGalleryFor, setShowGalleryFor] = useState<'desktop' | 'mobile' | null>(null);
  const [loadingGallery, setLoadingGallery] = useState(false);

  useEffect(() => {
    fetchBanners();
    fetchSettings();
  }, []);

  const fetchBanners = async () => {
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    if (data) setBanners(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      setAnnouncementText(data.announcement_text || '');
      setAnnouncementEndTime(data.announcement_end_time || '');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const { error } = await supabase.from('settings').upsert({
      id: 1,
      announcement_text: announcementText,
      announcement_end_time: announcementEndTime,
    });

    if (error) alert('שגיאה בשמירת הפס העליון: ' + error.message);
    else alert('הפס העליון והטיימר עודכנו בהצלחה! 🚀');
    setSavingSettings(false);
  };

  const fetchExistingImages = async () => {
    try {
      setLoadingGallery(true);
      const { data, error } = await supabase.storage.from('product-images').list();
      if (error) throw error;
      if (data) {
        const urls = data
          .filter(file => file.name && file.name !== '.gitkeep')
          .map((file) => {
            const { data: pub } = supabase.storage.from('product-images').getPublicUrl(file.name);
            return pub.publicUrl;
          });
        setExistingImages(urls);
      }
    } catch (err: any) {
      console.error('Error fetching existing images:', err.message);
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'desktop' | 'mobile') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (type === 'desktop') setUploadingDesktop(true);
      else setUploadingMobile(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `banner_${type}_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (pubData) {
        if (type === 'desktop') setDesktopImageUrl(pubData.publicUrl);
        else setMobileImageUrl(pubData.publicUrl);
      }
    } catch (err: any) {
      alert('שגיאה בהעלאה: ' + err.message);
    } finally {
      if (type === 'desktop') setUploadingDesktop(false);
      else setUploadingMobile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    const bannerData = {
      title,
      subtitle,
      desktop_image_url: desktopImageUrl,
      mobile_image_url: mobileImageUrl,
      image_url: desktopImageUrl,
      link_product_id: linkProductId,
      is_active: isActive
    };

    if (editingId) {
      const { error } = await supabase.from('banners').update(bannerData).eq('id', editingId);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('הבאנר עודכן בהצלחה! 🎉');
        resetForm();
        fetchBanners();
      }
    } else {
      const { error } = await supabase.from('banners').insert([bannerData]);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('הבאנר נוסף בהצלחה! 🚀');
        resetForm();
        fetchBanners();
      }
    }
    setLoading(false);
  };

  const handleEdit = (b: any) => {
    setEditingId(b.id);
    setTitle(b.title || '');
    setSubtitle(b.subtitle || '');
    setDesktopImageUrl(b.desktop_image_url || b.image_url || '');
    setMobileImageUrl(b.mobile_image_url || '');
    setLinkProductId(b.link_product_id || '');
    setIsActive(b.is_active ?? true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק באנר זה?')) return;
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) alert('שגיאה: ' + error.message);
    else fetchBanners();
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setDesktopImageUrl('');
    setMobileImageUrl('');
    setLinkProductId('');
    setIsActive(true);
    setShowGalleryFor(null);
  };

  return (
    <div className="space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול באנרים ופס עליון</h1>

      {/* ניהול פס מבצעים עליון וטיימר */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">ניהול פס מבצעים עליון וטיימר ⏱️</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">טקסט הפס העליון</label>
            <input type="text" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="למשל: מבצע ל-24 שעות בלבד!! משלוח חינם בקניה מעל 399₪" className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שעת סיום מבצע (לשם טיימר)</label>
            <input type="datetime-local" value={announcementEndTime} onChange={(e) => setAnnouncementEndTime(e.target.value)} className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm bg-gray-50 cursor-pointer" />
          </div>
        </div>
        <button type="submit" disabled={savingSettings} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-md cursor-pointer text-xs">
          {savingSettings ? 'שומר...' : 'שמור הגדרות פס עליון 💾'}
        </button>
      </form>

      {/* טופס הוספה / עריכת באנר */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת באנר ✏️' : 'הוספת באנר חדש ➕'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">כותרת הבאנר</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: 🔥 מבצעי ענק על מכשירים כשרים..." className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">כותרת משנה</label>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="למשל: הנחות מיוחדות לשבוע הקרוב בלבד..." className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t">
          
          {/* באנר למחשב */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-900">תמונת באנר למחשב (Desktop)</label>
              <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-md">מידות מומלצות: 1920x600 px</span>
            </div>
            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'desktop')} className="w-full border rounded-xl p-2.5 text-xs bg-white cursor-pointer" />
              <button
                type="button"
                onClick={() => {
                  if (showGalleryFor !== 'desktop') fetchExistingImages();
                  setShowGalleryFor(showGalleryFor === 'desktop' ? null : 'desktop');
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs"
              >
                {showGalleryFor === 'desktop' ? 'סגור ✕' : 'בחר מהאחסון 🖼️'}
              </button>
            </div>
            {uploadingDesktop && <p className="text-xs text-blue-600 font-bold">מעלה תמונת מחשב...</p>}
            {desktopImageUrl && (
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border">
                <img src={desktopImageUrl} alt="" className="w-20 h-12 object-cover rounded-lg border" />
                <span className="text-xs text-green-600 font-bold truncate">נבחרה תמונת מחשב ✓</span>
              </div>
            )}
          </div>

          {/* באנר לפלאפון */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-900">תמונת באנר לפלאפון (Mobile)</label>
              <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-md">מידות מומלצות: 800x800 px</span>
            </div>
            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'mobile')} className="w-full border rounded-xl p-2.5 text-xs bg-white cursor-pointer" />
              <button
                type="button"
                onClick={() => {
                  if (showGalleryFor !== 'mobile') fetchExistingImages();
                  setShowGalleryFor(showGalleryFor === 'mobile' ? null : 'mobile');
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs"
              >
                {showGalleryFor === 'mobile' ? 'סגור ✕' : 'בחר מהאחסון 🖼️'}
              </button>
            </div>
            {uploadingMobile && <p className="text-xs text-blue-600 font-bold">מעלה תמונת פלאפון...</p>}
            {mobileImageUrl && (
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border">
                <img src={mobileImageUrl} alt="" className="w-20 h-12 object-cover rounded-lg border" />
                <span className="text-xs text-green-600 font-bold truncate">נבחרה תמונת פלאפון ✓</span>
              </div>
            )}
          </div>

        </div>

        {/* גלריית תמונות גדולה, רחבה וברורה במיוחד */}
        {showGalleryFor && (
          <div className="bg-orange-50 border-2 border-orange-200 p-5 rounded-2xl space-y-3 shadow-inner">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-gray-900">
                בחר תמונה ברורה וגדולה עבור {showGalleryFor === 'desktop' ? 'מחשב' : 'פלאפון'} מתוך האחסון:
              </span>
              <button type="button" onClick={() => setShowGalleryFor(null)} className="text-xs text-gray-500 font-bold hover:text-red-600">סגור [X]</button>
            </div>
            {loadingGallery ? (
              <p className="text-xs text-gray-500 py-8 text-center font-bold">טוען תמונות בגודל מלא...</p>
            ) : existingImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-80 overflow-y-auto p-3 bg-white border rounded-xl shadow-xs">
                {existingImages.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (showGalleryFor === 'desktop') setDesktopImageUrl(url);
                      else setMobileImageUrl(url);
                      setShowGalleryFor(null);
                    }}
                    className="cursor-pointer border-2 rounded-xl overflow-hidden bg-white hover:border-orange-600 transition aspect-video flex flex-col items-center justify-between p-2 group shadow-xs border-gray-200"
                  >
                    <div className="w-full h-24 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 mt-2 text-center w-full">בחר תמונה זו ✓</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">לא נמצאו תמונות באחסון.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">קישור למזהה מוצר (אופציונלי)</label>
            <input type="text" value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)} placeholder="השאר ריק או הכנס מזהה מוצר..." className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-orange-600 rounded" />
              באנר פעיל באתר
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading || uploadingDesktop || uploadingMobile} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md cursor-pointer">
            {editingId ? 'עדכן באנר 💾' : 'הוסף באנר 🚀'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold cursor-pointer">ביטול ❌</button>
          )}
        </div>
      </form>

      {/* רשימת באנרים קיימים */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">באנרים קיימים ({banners.length})</h2>
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-2xl border gap-3">
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 rounded-xl bg-gray-200 overflow-hidden shrink-0 border">
                  {(b.desktop_image_url || b.mobile_image_url || b.image_url) ? (
                    <img src={b.desktop_image_url || b.mobile_image_url || b.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex items-center justify-center h-full text-xs">🖼️</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{b.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{b.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {b.is_active ? 'פעיל' : 'מוסתר'}
                </span>
                <button onClick={() => handleEdit(b)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-100">ערוך ✏️</button>
                <button onClick={() => handleDelete(b.id)} className="bg-red-50 text-red-600 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-100">מחק 🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
