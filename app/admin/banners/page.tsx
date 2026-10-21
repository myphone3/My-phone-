'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// מידות והנחיות לתמונות באנר (אפשר לשנות כאן בלבד)
const DESKTOP_SPEC = {
  size: '1920×640',
  details: 'יחס 3:1 | JPG/WebP | עד 500KB',
};
const MOBILE_SPEC = {
  size: '1536×1075',
  details: 'מוצג בגובה נמוך יותר בכ-30% במובייל',
};

export default function AdminBanners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [desktopImageUrl, setDesktopImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeTargetField, setActiveTargetField] = useState<'desktop' | 'mobile' | 'general'>('desktop');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    if (data) setBanners(data);

    let allMedia: any[] = [];
    const { data: rootData, error: rootError } = await supabase.storage.from('product-images').list('');
    
    if (!rootError && rootData) {
      for (const item of rootData) {
        if (item.name && item.name !== '.emptyFolderPlaceholder' && item.name !== '.gitkeep') {
          if (!item.id || item.metadata === null || item.name === 'products') {
            const { data: subData, error: subError } = await supabase.storage.from('product-images').list(item.name);
            if (!subError && subData) {
              for (const subItem of subData) {
                if (subItem.name && subItem.name !== '.emptyFolderPlaceholder' && subItem.name !== '.gitkeep') {
                  const filePath = `${item.name}/${subItem.name}`;
                  const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
                  if (pub?.publicUrl) {
                    allMedia.push({ id: subItem.id || filePath, url: pub.publicUrl });
                  }
                }
              }
            }
          } else {
            const { data: pub } = supabase.storage.from('product-images').getPublicUrl(item.name);
            if (pub?.publicUrl) {
              allMedia.push({ id: item.id || item.name, url: pub.publicUrl });
            }
          }
        }
      }
    }
    setMediaList(allMedia);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'desktop' | 'mobile' | 'general') => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingField(targetField);
      const fileExt = file.name.split('.').pop();
      const fileName = `banner_${targetField}_${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      if (data?.publicUrl) {
        if (targetField === 'desktop') setDesktopImageUrl(data.publicUrl);
        else if (targetField === 'mobile') setMobileImageUrl(data.publicUrl);
        else setImageUrl(data.publicUrl);
        fetchData();
      }
    } catch (error: any) {
      alert('שגיאה בהעלאת התמונה: ' + error.message);
    } finally {
      setUploadingField(null);
    }
  };

  const openGalleryForField = (field: 'desktop' | 'mobile' | 'general') => {
    setActiveTargetField(field);
    setMediaModalOpen(true);
  };

  const handleSelectFromGallery = (url: string) => {
    if (activeTargetField === 'desktop') setDesktopImageUrl(url);
    else if (activeTargetField === 'mobile') setMobileImageUrl(url);
    else setImageUrl(url);
    setMediaModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const bannerData = {
      title,
      subtitle,
      image_url: imageUrl,
      desktop_image_url: desktopImageUrl,
      mobile_image_url: mobileImageUrl,
      link_product_id: linkProductId,
      is_active: isActive
    };

    if (editingId) {
      await supabase.from('banners').update(bannerData).eq('id', editingId);
    } else {
      await supabase.from('banners').insert([bannerData]);
    }
    resetForm();
    fetchData();
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setSubtitle(item.subtitle || '');
    setImageUrl(item.image_url || '');
    setDesktopImageUrl(item.desktop_image_url || '');
    setMobileImageUrl(item.mobile_image_url || '');
    setLinkProductId(item.link_product_id || '');
    setIsActive(item.is_active ?? true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק באנר זה?')) return;
    await supabase.from('banners').delete().eq('id', id);
    fetchData();
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setImageUrl('');
    setDesktopImageUrl('');
    setMobileImageUrl('');
    setLinkProductId('');
    setIsActive(true);
    setMediaModalOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
        ניהול באנרים 🖼️
      </h1>

      <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת באנר ✏️' : 'הוספת באנר חדש ➕'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">כותרת ראשית</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="למשל: מבצעי ענק..." 
              className="w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-600 transition" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">כותרת משנה</label>
            <input 
              type="text" 
              value={subtitle} 
              onChange={(e) => setSubtitle(e.target.value)} 
              placeholder="למשל: הנחות מיוחדות..." 
              className="w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-600 transition" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          {/* תמונת דסקטופ */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">תמונת באנר למחשב (Desktop)</label>
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1.5 space-y-0.5">
              <p className="text-[11px] font-bold text-orange-700">
                📐 מידות: <span dir="ltr">{DESKTOP_SPEC.size}</span> פיקסלים
              </p>
              <p className="text-[10px] text-gray-600">{DESKTOP_SPEC.details}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-2.5 px-2 rounded-2xl text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1">
                <span>{uploadingField === 'desktop' ? 'מעלה...' : '📤 העלה'}</span>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'desktop')} disabled={uploadingField !== null} className="hidden" />
              </label>
              <button 
                type="button" 
                onClick={() => openGalleryForField('desktop')} 
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 py-2.5 px-2 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🖼️ מאגר</span>
              </button>
            </div>
            {desktopImageUrl && (
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border">
                <img src={desktopImageUrl} alt="" className="w-12 h-8 object-cover rounded-xl border bg-white" />
                <span className="text-[10px] text-gray-500 truncate flex-1">{desktopImageUrl}</span>
                <button type="button" onClick={() => setDesktopImageUrl('')} className="text-red-500 text-xs font-bold">הסר</button>
              </div>
            )}
          </div>

          {/* תמונת מובייל */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">תמונת באנר לטלפון (Mobile)</label>
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1.5 space-y-0.5">
              <p className="text-[11px] font-bold text-orange-700">
                📐 מידות: <span dir="ltr">{MOBILE_SPEC.size}</span> פיקסלים
              </p>
              <p className="text-[10px] text-gray-600">{MOBILE_SPEC.details}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-2.5 px-2 rounded-2xl text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1">
                <span>{uploadingField === 'mobile' ? 'מעלה...' : '📤 העלה'}</span>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'mobile')} disabled={uploadingField !== null} className="hidden" />
              </label>
              <button 
                type="button" 
                onClick={() => openGalleryForField('mobile')} 
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 py-2.5 px-2 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🖼️ מאגר</span>
              </button>
            </div>
            {mobileImageUrl && (
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border">
                <img src={mobileImageUrl} alt="" className="w-12 h-8 object-cover rounded-xl border bg-white" />
                <span className="text-[10px] text-gray-500 truncate flex-1">{mobileImageUrl}</span>
                <button type="button" onClick={() => setMobileImageUrl('')} className="text-red-500 text-xs font-bold">הסר</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">קישור למוצר / קטגוריה</label>
            <input 
              type="text" 
              value={linkProductId} 
              onChange={(e) => setLinkProductId(e.target.value)} 
              placeholder="לדוגמה ID מוצר או שם קטגוריה" 
              className="w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-600 transition" 
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <input 
              type="checkbox" 
              id="isActive" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)} 
              className="w-5 h-5 accent-orange-600 rounded cursor-pointer" 
            />
            <label htmlFor="isActive" className="text-xs font-bold text-gray-800 cursor-pointer">באנר פעיל ומסתובב באתר</label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            type="submit" 
            disabled={uploadingField !== null}
            className="flex-1 bg-black hover:bg-gray-800 text-white py-3 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {editingId ? 'שמור שינויים' : 'הוסף באנר'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={resetForm}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              ביטול
            </button>
          )}
        </div>
      </form>

      {/* חלון מודל רחב וענק לבחירת תמונה ממאגר המדיה (תצוגה רחבה של 12+ תמונות בו-זמנית) */}
      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col shadow-2xl border" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3 shrink-0">
              <h3 className="font-black text-base text-gray-900">
                בחר תמונת באנר ({activeTargetField === 'desktop' ? 'מחשב' : activeTargetField === 'mobile' ? 'מובייל' : 'כללי'}) ממאגר המדיה
              </h3>
              <button 
                type="button"
                onClick={() => setMediaModalOpen(false)} 
                className="text-gray-400 hover:text-black font-bold p-1 cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto p-2 flex-1">
              {mediaList.length === 0 ? (
                <div className="col-span-full text-center py-12 text-sm text-gray-400">אין תמונות במאגר</div>
              ) : (
                mediaList.map((m) => (
                  <div 
                    key={m.id} 
                    onClick={() => handleSelectFromGallery(m.url)} 
                    className="border rounded-2xl p-2 bg-gray-50 h-28 flex items-center justify-center cursor-pointer hover:border-orange-600 hover:scale-105 transition shadow-2xs"
                  >
                    <img src={m.url} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* רשימת באנרים קיימים */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y">
        {banners.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">אין באנרים קיימים</div>
        ) : (
          banners.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-12 h-10 bg-gray-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                  {item.desktop_image_url || item.image_url ? (
                    <img src={item.desktop_image_url || item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base">🖼️</span>
                  )}
                </div>
                <div className="truncate">
                  <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">{item.title || 'ללא כותרת'}</span>
                  <span className="text-[11px] text-gray-400 block truncate">{item.subtitle || ''}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleEdit(item)} 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  עריכה
                </button>
                <button 
                  onClick={() => handleDelete(item.id)} 
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-red-100 transition"
                >
                  מחיקה
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
