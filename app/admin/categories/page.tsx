'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('categories').insert([{ name }]);
    setLoading(false);

    if (error) {
      alert('שגיאה: ' + error.message);
    } else {
      setName('');
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
      <h1 className="text-2xl font-bold text-gray-900">ניהול קטגוריות</h1>

      <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4">
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="שם קטגוריה חדשה (למשל: סמארטפונים)..." 
          className="flex-1 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
        >
          {loading ? 'מוסיף...' : 'הוסף קטגוריה ➕'}
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
                <span className="font-semibold text-gray-800">{c.name}</span>
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
