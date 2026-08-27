'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBrands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('brands').select('*');
    if (data) setBrands(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('brands').insert([{ name }]);
    setLoading(false);

    if (error) {
      alert('שגיאה: ' + error.message);
    } else {
      setName('');
      fetchBrands();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מותג זה?')) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchBrands();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול מותגים</h1>

      <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4">
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="שם מותג חדש (למשל: Xiaomi, Apple)..." 
          className="flex-1 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
        >
          {loading ? 'מוסיף...' : 'הוסף מותג ➕'}
        </button>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">מותגים קיימים ({brands.length})</h2>
        {brands.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין מותגים.</p>
        ) : (
          <div className="space-y-2">
            {brands.map((b) => (
              <div key={b.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border">
                <span className="font-semibold text-gray-800">{b.name}</span>
                <button 
                  onClick={() => handleDelete(b.id)}
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
