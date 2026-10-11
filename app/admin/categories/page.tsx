'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // פונקציה לסריקת תמונות ממאגר המדיה (כולל תתי-תיקיות)
  const fetchData = async () => {
    const { data: catData } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
    if (catData) setCategories(catData);

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

  // פונקציה להעלאת תמונה ישירות מהמכשיר הנייד/מחשב ל-Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `category_${Date.now()}.${fileExt}`;
      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
        fetchData(); // רענון המאגר
      }
    } catch (error: any) {
      alert('שגיאה בהעלאת התמונה: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await supabase.from('categories').update({ name, image_url: imageUrl }).eq('id', editingId);
    } else {
      await supabase.from('categories').insert([{ name, image_url: imageUrl }]);
    }
    setName('');
    setImageUrl('');
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק קטגוריה זו?')) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      <h2 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
        ניהול קטגוריות 📁
      </h2>

      {/* טופס הוספה / עריכה - מסודר ומתוחם בתוך המסגרת */}
      <form onSubmit={handleSave} className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">שם הקטגוריה</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="לדוגמה: מכשירים כשרים"
            required 
            className="w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-600 transition" 
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700">תמונת קטגוריה</label>

          {/* כפתורי פעולה להעלאה / בחירה מהמאגר - מסודרים היטב גם בטלפון */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-2.5 px-3 rounded-2xl text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1.5">
              <span>{uploading ? 'מעלה...' : '📤 העלה מהמכשיר'}</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                disabled={uploading} 
                className="hidden" 
              />
            </label>

            <button 
              type="button" 
              onClick={() => setMediaModalOpen(true)} 
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🖼️ ממאגר המדיה</span>
            </button>
          </div>

          {/* שדה הזנת קישור/תצוגה מקדימה */}
          <input 
            type="text" 
            value={imageUrl} 
            onChange={(e) => setImageUrl(e.target.value)} 
            placeholder="או הדבק קישור לתמונה" 
            className="w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-600 transition" 
          />

          {/* תצוגה מקדימה לתמונה */}
          {imageUrl && (
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border w-fit mt-2">
              <img src={imageUrl} alt="תצוגה מקדימה" className="w-12 h-12 object-cover rounded-xl border bg-white" />
              <button 
                type="button" 
                onClick={() => setImageUrl('')} 
                className="text-red-500 text-xs font-bold hover:underline px-2"
              >
                הסר
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            type="submit" 
            disabled={uploading}
            className="flex-1 bg-black hover:bg-gray-800 text-white py-3 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {editingId ? 'שמור שינויים' : 'הוסף קטגוריה'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={() => { setEditingId(null); setName(''); setImageUrl(''); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              ביטול
            </button>
          )}
        </div>
      </form>

      {/* מודל בחירת תמונה ממאגר המדיה */}
      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl border" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3 shrink-0">
              <h3 className="font-black text-sm text-gray-900">בחר תמונה ממאגר המדיה</h3>
              <button 
                onClick={() => setMediaModalOpen(false)} 
                className="text-gray-400 hover:text-black font-bold p-1 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto p-1 flex-1">
              {mediaList.length === 0 ? (
                <div className="col-span-full text-center py-8 text-xs text-gray-400">אין תמונות במאגר</div>
              ) : (
                mediaList.map((m) => (
                  <div 
                    key={m.id} 
                    onClick={() => { setImageUrl(m.url); setMediaModalOpen(false); }} 
                    className="border rounded-2xl p-2 bg-gray-50 h-24 flex items-center justify-center cursor-pointer hover:border-orange-600 hover:scale-105 transition shadow-2xs"
                  >
                    <img src={m.url} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* רשימת הקטגוריות הקיימות */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">אין קטגוריות קיימות</div>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base">📦</span>
                  )}
                </div>
                <span className="font-bold text-xs sm:text-sm text-gray-900">{c.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingId(c.id); setName(c.name); setImageUrl(c.image_url || ''); }} 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  עריכה
                </button>
                <button 
                  onClick={() => handleDelete(c.id)} 
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
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
