'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminMedia() {
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const { data: rootData, error: rootError } = await supabase.storage.from('product-images').list('');
      if (rootError) throw rootError;

      let allFiles: any[] = [];

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
                    allFiles.push({
                      name: subItem.name,
                      path: filePath,
                      url: pub.publicUrl,
                      created_at: subItem.created_at || item.created_at
                    });
                  }
                }
              }
            } else {
              const { data: pub } = await supabase.storage.from('product-images').getPublicUrl(item.name);
              allFiles.push({
                name: item.name,
                path: item.name,
                url: pub.publicUrl,
                created_at: item.created_at
              });
            }
          }
        }
      }

      setMediaFiles(allFiles);
    } catch (err: any) {
      console.error('Error fetching media:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error } = await supabase.storage.from('product-images').upload(fileName, file);
        if (error) throw error;
      }

      alert('התמונות הועלו בהצלחה לספריית המדיה! 🚀');
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה בהעלאה: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm('האם למחוק קובץ זה מהמדיה?')) return;
    try {
      const { error } = await supabase.storage.from('product-images').remove([filePath]);
      if (error) throw error;
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה במחיקה: ' + err.message);
    }
  };

  const copyToClipboard = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6" dir="rtl">
      {/* כותרת ראשית ואזור העלאה */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">ספריית מדיה 🖼️</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">ניהול כל הקבצים והתמונות במערכת בצורה מהירה ומרווחת.</p>
        </div>

        <label className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-2xl transition cursor-pointer shadow-md text-xs sm:text-sm flex items-center gap-2">
          <span>{uploading ? 'מעלה קבצים...' : 'העלה תמונות חדשות 📁'}</span>
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {/* רשת גלריית התמונות הצפופה והמסודרת */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-base font-bold text-gray-800">
            קבצים במערכת ({mediaFiles.length})
          </h2>
          <button 
            onClick={fetchMediaFiles} 
            className="text-xs text-orange-600 font-bold hover:underline cursor-pointer"
          >
            רענן מאגר 🔄
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 font-bold text-sm text-gray-500">טוען קבצים מהמדיה...</div>
        ) : mediaFiles.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-medium">אין קבצים זמינים במדיה כרגע.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {mediaFiles.map((file, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-2xl border border-gray-100 p-2 flex flex-col justify-between gap-2 shadow-2xs hover:shadow-md hover:border-orange-500 transition-all group"
              >
                {/* תצוגה מקדימה בריבוע מושלם בלחיצה להעתקה */}
                <div 
                  onClick={() => copyToClipboard(file.url, idx)}
                  className="w-full aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center p-1.5 relative cursor-pointer"
                  title="לחץ להעתקת קישור"
                >
                  <img src={file.url} alt="" className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-300" />
                  {copiedIndex === idx && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-black rounded-lg backdrop-blur-3xs">
                      הועתק! ✓
                    </div>
                  )}
                </div>

                {/* כפתורי פעולה נקיים */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => copyToClipboard(file.url, idx)}
                    className="bg-gray-100 hover:bg-black hover:text-white text-gray-800 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer text-center truncate px-1 flex items-center justify-center"
                  >
                    {copiedIndex === idx ? 'הועתק ✓' : 'העתק 🔗'}
                  </button>
                  <button
                    onClick={() => handleDelete(file.path)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer flex items-center justify-center"
                    title="מחק קובץ"
                  >
                    מחק 🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
