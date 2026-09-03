'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBrands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // מצבים לבחירת תמונה קיימת מהאחסון
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
    if (data) setBrands(data);
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
      const fileName = `brand_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
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
      const { error } = await supabase.from('brands').update({ name, image_url: imageUrl }).eq('id', editingId);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('המותג עודכן בהצלחה! 🎉');
        resetForm();
        fetchBrands();
      }
    } else {
      const { error } = await supabase.from('brands').insert([{ name, image_url: imageUrl }]);
      if (error) alert('שגיאה: ' + error.message);
      else {
        alert('המותג נוסף בהצלחה! 🚀');
        resetForm();
        fetchBrands();
      }
    }
    setLoading(false);
  };

  const handleEdit = (b: any) => {
    setEditingId(b.id);
    setName(b.name || '');
    setImageUrl(b.image_url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מותג זה?')) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) alert('שגיאה: ' + error.message);
    else fetchBrands();
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setImageUrl('');
    setShowGallery(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול מותגים</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
          {editingId ? 'עריכת מותג ✏️' : 'הוספת מותג חדש ➕'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם המותג</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: Xiaomi..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">לוגו מותג</label>
            
            <div className="flex gap-2 mb-2">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="w-full border rounded-xl p-2 text-xs bg-gray-50 cursor-pointer" />
              <button
                type="button"
                onClick={() => {
                  if (!showGallery) fetchExistingImages();
                  setShowGallery(!showGallery);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs"
              >
                {showGallery ? 'סגור גלריה ✕' : 'בחר מתמונות קיימות 🖼️'}
              </button>
            </div>

            {/* גלריית בחירת תמונות קיימות מהאחסון */}
            {showGallery && (
              <div className="bg-gray-50 border p-3 rounded-xl mb-3 space-y-2">
                <p className="text-xs font-bold text-gray-700">בחר תמונה קיימת מתוך האחסון של האתר:</p>
                {loadingGallery ? (
                  <p className="text-xs text-gray-500 py-3 text-center">טוען תמונות קיימות...</p>
                ) : existingImages.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto p-1 bg-white border rounded-lg">
                    {existingImages.map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setImageUrl(url);
                          setShowGallery(false);
                        }}
                        className={`cursor-pointer border-2 rounded-lg overflow-hidden bg-white hover:border-orange-500 transition aspect-square flex items-center justify-center p-1 ${imageUrl === url ? 'border-orange-600 ring-2 ring-orange-400' : 'border-gray-200'}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-contain rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-3">לא נמצאו תמונות באחסון.</p>
                )}
              </div>
            )}

            {uploading && <p className="text-xs text-blue-600 mt-1">מעלה קובץ לאחסון...</p>}
            
            {imageUrl && (
              <div className="mt-2 flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border">
                <img src={imageUrl} alt="" className="w-12 h-12 object-contain bg-white rounded-lg border p-0.5" />
                <div className="overflow-hidden">
                  <span className="text-xs text-green-600 font-semibold block">לוגו נבחר בהצלחה ✓</span>
                  <span className="text-[10px] text-gray-400 truncate block max-w-xs">{imageUrl}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading || uploading} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md cursor-pointer">
            {editingId ? 'עדכן מותג 💾' : 'הוסף מותג 🚀'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold cursor-pointer">ביטול ❌</button>
          )}
        </div>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">מותגים קיימים ({brands.length})</h2>
        <div className="space-y-2">
          {brands.map((b) => (
            <div key={b.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-3">
                {b.image_url ? (
                  <img src={b.image_url} alt="" className="w-12 h-12 rounded-lg object-contain border bg-white p-0.5" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-xs">🏷️</div>
                )}
                <span className="font-semibold text-gray-800 text-lg">{b.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(b)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">ערוך ✏️</button>
                <button onClick={() => handleDelete(b.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">מחק 🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
