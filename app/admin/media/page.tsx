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
      // שליפת קבצים מהתיקייה הראשית
      const { data: rootData, error: rootError } = await supabase.storage.from('product-images').list('');
      if (rootError) throw rootError;

      let allFiles: any[] = [];

      if (rootData) {
        for (const item of rootData) {
          if (item.name && item.name !== '.gitkeep') {
            // בדיקה האם מדובר בתיקייה או בקובץ
            if (!item.id || item.metadata === null || item.name === 'products') {
              // זו תיקייה - ניכנס ונשלוף את הקבצים שבתוכה
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
              // קובץ רגיל בתיקייה הראשית
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
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">ספריית מדיה 🖼️</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">כל הקבצים והתמונות שהועלו למערכת (כולל תיקיות המוצרים).</p>
        </div>

        <label className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-2xl transition cursor-pointer shadow-md text-xs sm:text-sm flex items-center gap-2">
          <span>{uploading ? 'מעלה קבצים...' : 'העלה תמונות חדשות 📁'}</span>
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        </label>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 border-b pb-2">
          קבצים במערכת ({mediaFiles.length})
        </h2>

        {loading ? (
          <div className="text-center py-20 font-bold text-sm text-gray-500">טוען קבצים מהמדיה...</div>
        ) : mediaFiles.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-medium">אין קבצים זמינים במדיה כרגע.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {mediaFiles.map((file, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl border p-3 flex flex-col justify-between gap-3 shadow-xs group">
                <div className="w-full h-36 bg-white rounded-xl overflow-hidden border flex items-center justify-center p-2 relative">
                  <img src={file.url} alt="" className="w-full h-full object-contain group-hover:scale-105 transition" />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-gray-700 font-medium truncate" title={file.name}>
                    {file.name}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(file.url, idx)}
                      className="flex-1 bg-black hover:bg-gray-800 text-white py-2 rounded-xl text-[11px] font-bold transition cursor-pointer text-center"
                    >
                      {copiedIndex === idx ? 'הועתק! ✓' : 'העתק קישור 🔗'}
                    </button>
                    <button
                      onClick={() => handleDelete(file.path)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer"
                      title="מחק קובץ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
