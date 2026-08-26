'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase.from('brands').select('*');
      if (error) throw error;
      if (data) setBrands(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.from('brands').insert([{ name, logo_url: logoUrl }]);
      if (error) throw error;

      setMessage('המותג נוסף בהצלחה! 🎉');
      setName('');
      setLogoUrl('');
      fetchBrands();
    } catch (err: any) {
      setMessage('שגיאה בשמירת המותג: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מותג זה?')) return;
    try {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      fetchBrands();
    } catch (err: any) {
      alert('שגיאה במחיקה: ' + err.message);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ניהול מותגים בחנות</h1>

      {message && (
        <div className="p-3 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      {/* טופס הוספת מותג */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800">הוספת מותג חדש</h2>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">שם המותג</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
            placeholder="לדוגמה: Apple, Samsung, Anker..."
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">קישור ללוגו (URL)</label>
          <input 
            type="text" 
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
            placeholder="https://..."
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition"
        >
          {loading ? 'מוסיף...' : 'הוסף מותג 🚀'}
        </button>
      </form>

      {/* רשימת המותגים הקיימים */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
        <h2 className="text-lg font-bold text-gray-800">המותגים הקיימים ({brands.length})</h2>
        {brands.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין מותגים במערכת.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {brands.map((b) => (
              <div key={b.id} className="p-4 bg-gray-50/50 rounded-xl border flex flex-col items-center justify-between gap-2">
                {b.logo_url && <img src={b.logo_url} alt={b.name} className="w-12 h-12 object-contain" />}
                <span className="font-bold text-sm text-gray-800">{b.name}</span>
                <button 
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg w-full transition"
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
