'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
    if (data) setCategories(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('categories').insert([{ name, image_url: imageUrl }]);
    setLoading(false);

    if (error) {
      alert('שגיאה: ' + error.message);
    } else {
      setName('');
      setImageUrl('');
      fetchCategories();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchCategories();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">ניהול קטגוריות</h1>
        <Link href="/admin/media" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-sm font-bold transition">
          🖼️ ספריית מדיה להעתקת קישורים
        </Link>
      </div>

      <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">הוספת קטגוריה חדשה ➕</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם הקטגוריה</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: סמארטפונים..." 
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">קישור תמונה / אייקון</label>
            <input 
              type="text" 
              value={imageUrl} 
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..." 
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md"
        >
          {loading ? 'מוסיף...' : 'הוסף קטגוריה 🚀'}
        </button>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">קטגוריות קיימות ({categories.length})</h2>
        {categories.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין קטגוריות.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-3">
                  {c.image_url ? (
                    <div className="w-12 h-12 rounded-lg bg-white border overflow-hidden flex-shrink-0">
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">📁</div>
                  )}
                  <span className="font-semibold text-gray-800 text-lg">{c.name}</span>
                </div>
                <button 
                  onClick={() => handleDelete(c.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  מחק 🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
