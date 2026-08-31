'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);

    let allMedia: any[] = [];
    const { data: files } = await supabase.storage.from('product-images').list();
    if (files) {
      for (const file of files) {
        if (file.name && file.name !== '.emptyFolderPlaceholder') {
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(file.name);
          if (pub?.publicUrl) allMedia.push({ id: file.id || file.name, url: pub.publicUrl });
        }
      }
    }
    setMediaList(allMedia);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

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
    <div className="max-w-4xl mx-auto p-6 space-y-6" dir="rtl">
      <h2 className="text-2xl font-black">ניהול קטגוריות 🗂️</h2>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">שם הקטגוריה</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded-xl px-4 py-2 text-sm outline-none" />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תמונת קטגוריה</label>
          <div className="flex gap-3 items-center">
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="קישור תמונה או בחר מהמאגר" className="flex-1 border rounded-xl px-4 py-2 text-sm outline-none" />
            <button type="button" onClick={() => setMediaModalOpen(true)} className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl text-xs font-bold transition">
              🖼️ בחר ממאגר המדיה
            </button>
          </div>
          {imageUrl && <img src={imageUrl} alt="" className="w-16 h-16 object-cover mt-2 rounded-xl border" />}
        </div>

        <button type="submit" className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold">
          {editingId ? 'שמור שינויים' : 'הוסף קטגוריה'}
        </button>
      </form>

      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-base">בחר תמונה ממאגר המדיה</h3>
              <button onClick={() => setMediaModalOpen(false)} className="text-gray-400 hover:text-black font-bold">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {mediaList.map((m) => (
                <div key={m.id} onClick={() => { setImageUrl(m.url); setMediaModalOpen(false); }} className="border rounded-2xl p-2 bg-gray-50 h-28 flex items-center justify-center cursor-pointer hover:border-black transition">
                  <img src={m.url} alt="" className="max-h-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden divide-y">
        {categories.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {c.image_url && <img src={c.image_url} alt="" className="w-10 h-10 object-cover rounded-lg" />}
              <span className="font-bold text-sm">{c.name}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingId(c.id); setName(c.name); setImageUrl(c.image_url || ''); }} className="bg-gray-100 px-3 py-1.5 rounded-xl text-xs font-bold">עריכה</button>
              <button onClick={() => handleDelete(c.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold">מחיקה</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
