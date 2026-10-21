'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminKosher() {
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);

  useEffect(() => {
    fetchKosher();
  }, []);

  const fetchKosher = async () => {
    const { data } = await supabase.from('kosher_options').select('*').order('created_at', { ascending: false });
    if (data) setKosherList(data);
  };

  const fetchExistingImages = async () => {
    try {
      setLoadingGallery(true);
      const { data: rootData, error: rootError } = await supabase.storage.from('product-images').list('');
      if (rootError) throw rootError;

      let allUrls: string[] = [];
      if (rootData) {
        for (const item of rootData) {
          if (item.name && item.name !== '.gitkeep') {
            if (!item.id || item.metadata === null || item.name === 'products') {
              const { data: subData, error: subError } = await supabase.storage.from('product-images').list(item.name);
              if (!subError && subData) {
                for (const subItem of subData) {
                  if (subItem.name && subItem.name !== '.gitkeep') {
                    const filePath = `${item.name}/${subItem.name}`;
                    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
                    allUrls.push(pub.publicUrl);
                  }
                }
              }
            } else {
              const { data: pub } = supabase.storage.from('product-images').getPublicUrl(item.name);
              allUrls.push(pub.publicUrl);
            }
          }
        }
      }
      setExistingImages(allUrls);
    } catch (err: any) {
      console.error('Error fetching existing images:', err.message);
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `kosher_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (pubData) setImageUrl(pubData.publicUrl);
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    if (editingId) {
      const { error } = await supabase.from('kosher_options').update({ name, image_url: imageUrl }).eq('id', editingId);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('הכשרות עודכנה בהצלחה! 🎉');
        resetForm();
        fetchKosher();
      }
    } else {
      const { error } = await supabase.from('kosher_options').insert([{ name, image_url: imageUrl }]);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('הכשרות נוספה בהצלחה! 🚀');
        resetForm();
        fetchKosher();
      }
    }
    setLoading(false);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setName(item.name || '');
    setImageUrl(item.image_url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק כשרות זו?')) return;
    const { error } = await supabase.from('kosher_options').delete().eq('id', id);
    if (error) alert('שגיאה: ' + error.message);
    else fetchKosher();
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setImageUrl('');
    setShowGallery(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2 sm:p-4" dir="rtl">
      <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
        <span>🛡️</span>
        <span>ניהול כשרות</span>
      </h1>

      {/* טופס הוספה / עריכה בעיצוב תואם לניהול מותגים */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
          <span>{editingId ? '✏️' : '➕'}</span>
          <span>{editingId ? 'עריכת כשרות' : 'הוספת כשרות חדשה'}</span>
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם הכשרות</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="למשל: בד&quot;ץ העדה החרדית..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-500 transition" 
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">לוגו / תמונת כשרות</label>
            
            {/* כפתור העלאה מהמכשיר */}
            <label className="w-full bg-orange-50/50 hover:bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs">
              <span>📤 העלאה מהמכשיר</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* כפתור בחירה ממצאי המדיה */}
            <button
              type="button"
              onClick={() => {
                if (!showGallery) fetchExistingImages();
                setShowGallery(true);
              }}
              className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-2xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 transition shadow-2xs cursor-pointer"
            >
              <span>🖼️ ממצאי המדיה</span>
            </button>

            {/* שדה הדבקת קישור */}
            <input
              type="text"
              placeholder="או הדבק קישור לתמונה"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-500 transition text-left dir-ltr"
            />

            {uploading && <p className="text-xs text-blue-600 font-bold">מעלה קובץ לאחסון...</p>}
            
            {imageUrl && (
              <div className="mt-2 flex items-center gap-3 bg-orange-50/60 p-3 rounded-2xl border border-orange-200">
                <img src={imageUrl} alt="" className="w-12 h-12 object-contain bg-white rounded-xl border p-1 shadow-xs" />
                <div className="overflow-hidden">
                  <span className="text-[11px] text-orange-800 font-bold block">התמונה נבחרה בהצלחה ✓</span>
                  <span className="text-[10px] text-gray-500 truncate block max-w-xs">{imageUrl}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            type="submit" 
            disabled={loading || uploading} 
            className="w-full bg-black hover:bg-gray-800 text-white rounded-2xl py-3.5 text-xs font-black transition shadow-md cursor-pointer"
          >
            {editingId ? 'עדכן כשרות 💾' : 'הוסף כשרות 🚀'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={resetForm} 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3.5 rounded-2xl text-xs font-bold cursor-pointer transition"
            >
              ביטול ❌
            </button>
          )}
        </div>
      </form>

      {/* חלון מודל לבחירת תמונה ממצאי המדיה */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl border" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3 shrink-0">
              <h3 className="font-black text-sm text-gray-900">בחר סמל כשרות ממצאי המדיה</h3>
              <button 
                type="button"
                onClick={() => setShowGallery(false)} 
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto p-1 flex-1">
              {loadingGallery ? (
                <div className="col-span-full text-center py-8 text-xs text-gray-500 font-bold">טוען תמונות מהאחסון...</div>
              ) : existingImages.length === 0 ? (
                <div className="col-span-full text-center py-8 text-xs text-gray-400">לא נמצאו תמונות באחסון.</div>
              ) : (
                existingImages.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setImageUrl(url);
                      setShowGallery(false);
                    }}
                    className={`border rounded-2xl p-2 bg-gray-50 h-24 flex items-center justify-center cursor-pointer hover:border-orange-600 hover:scale-105 transition shadow-2xs ${imageUrl === url ? 'border-orange-600 ring-4 ring-orange-200 bg-orange-50/30' : 'border-gray-200'}`}
                  >
                    <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* רשימת הכשרויות הקיימות */}
      <div className="bg-white p-6 rounded-3xl border shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-gray-800 border-b pb-3">כשרויות קיימות ({kosherList.length})</h2>
        <div className="space-y-2.5">
          {kosherList.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">אין כשרויות במערכת כרגע.</div>
          ) : (
            kosherList.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border transition hover:bg-orange-50/20">
                <div className="flex items-center gap-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-contain border bg-white p-1 shadow-xs" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xs">🛡️</div>
                  )}
                  <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(item)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-100 transition shadow-2xs">ערוך ✏️</button>
                  <button onClick={() => handleDelete(item.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-red-100 transition shadow-2xs">מחק 🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
