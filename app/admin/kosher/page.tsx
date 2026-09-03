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
    const { data } = await supabase.from('kosher').select('*').order('created_at', { ascending: false });
    if (data) setKosherList(data);
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
      const { error } = await supabase.from('kosher').update({ name, image_url: imageUrl }).eq('id', editingId);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('הכשרות עודכנה בהצלחה! 🎉');
        resetForm();
        fetchKosher();
      }
    } else {
      const { error } = await supabase.from('kosher').insert([{ name, image_url: imageUrl }]);
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
    const { error } = await supabase.from('kosher').delete().eq('id', id);
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
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול כשרות</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת כשרות ✏️' : 'הוספת כשרות חדשה ➕'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם הכשרות</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: בד״ץ העדה החרדית..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סמל / תמונת כשרות</label>
            
            <div className="flex gap-2 mb-2">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="w-full border rounded-xl p-2.5 text-xs bg-gray-50 cursor-pointer" />
              <button
                type="button"
                onClick={() => {
                  if (!showGallery) fetchExistingImages();
                  setShowGallery(!showGallery);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs"
              >
                {showGallery ? 'סגור גלריה ✕' : 'בחר מתמונות קיימות 🖼️'}
              </button>
            </div>

            {/* גלריית תמונות גדולה וברורה במיוחד */}
            {showGallery && (
              <div className="bg-gray-50 border-2 border-orange-200 p-4 rounded-2xl mb-3 space-y-3 shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">בחר סמל כשרות ברור וגדול מתוך האחסון:</span>
                  <button type="button" onClick={() => setShowGallery(false)} className="text-xs text-gray-500 font-bold hover:text-red-600">סגור [X]</button>
                </div>
                {loadingGallery ? (
                  <p className="text-xs text-gray-500 py-6 text-center font-bold">טוען תמונות בגודל מלא...</p>
                ) : existingImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-2 bg-white border rounded-xl shadow-xs">
                    {existingImages.map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setImageUrl(url);
                          setShowGallery(false);
                        }}
                        className={`cursor-pointer border-2 rounded-xl overflow-hidden bg-white hover:border-orange-600 transition flex flex-col items-center justify-between p-2 group shadow-xs ${imageUrl === url ? 'border-orange-600 ring-4 ring-orange-200 bg-orange-50/30' : 'border-gray-200'}`}
                      >
                        <div className="w-full h-24 flex items-center justify-center bg-gray-50 rounded-lg p-1 overflow-hidden">
                          <img src={url} alt="" className="w-full h-full object-contain group-hover:scale-105 transition duration-200" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 mt-2 text-center truncate w-full">בחר תמונה זו ✓</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6">לא נמצאו תמונות באחסון.</p>
                )}
              </div>
            )}

            {uploading && <p className="text-xs text-blue-600 mt-1 font-bold">מעלה קובץ לאחסון...</p>}
            
            {imageUrl && (
              <div className="mt-2 flex items-center gap-4 bg-orange-50/60 p-3 rounded-2xl border border-orange-200">
                <img src={imageUrl} alt="" className="w-16 h-16 object-contain bg-white rounded-xl border p-1 shadow-sm" />
                <div className="overflow-hidden">
                  <span className="text-xs text-orange-800 font-black block">התמונה נבחרה בהצלחה ותצוגה מקדימה פעילה ✓</span>
                  <span className="text-[11px] text-gray-500 truncate block max-w-xs mt-0.5">{imageUrl}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading || uploading} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md cursor-pointer">
            {editingId ? 'עדכן כשרות 💾' : 'הוסף כשרות 🚀'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold cursor-pointer">ביטול ❌</button>
          )}
        </div>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">כשרויות קיימות ({kosherList.length})</h2>
        <div className="space-y-2">
          {kosherList.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-contain border bg-white p-1 shadow-xs" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center text-xs">⭐</div>
                )}
                <span className="font-semibold text-gray-800 text-lg">{item.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(item)} className="bg-blue-50 text-blue-600 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-100 transition">ערוך ✏️</button>
                <button onClick={() => handleDelete(item.id)} className="bg-red-50 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-red-100 transition">מחק 🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
