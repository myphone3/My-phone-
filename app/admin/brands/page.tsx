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

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
    if (data) setBrands(data);
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
            <input type="file" accept="image/*" onChange={handleFileUpload} className="w-full border rounded-xl p-2.5 text-sm bg-gray-50 cursor-pointer" />
            {uploading && <p className="text-xs text-blue-600 mt-1">מעלה...</p>}
            {imageUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img src={imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border" />
                <span className="text-xs text-green-600 font-semibold">לוגו נבחר ✓</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading || uploading} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md">
            {editingId ? 'עדכן מותג 💾' : 'הוסף מותג 🚀'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold">ביטול ❌</button>
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
                  <img src={b.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border bg-white" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-xs">🏷️</div>
                )}
                <span className="font-semibold text-gray-800 text-lg">{b.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(b)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">ערוך ✏️</button>
                <button onClick={() => handleDelete(b.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold">מחק 🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
