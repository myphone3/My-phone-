'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminMedia() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from('product-images').list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (data) {
      setFiles(data);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    try {
      setUploading(true);
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `media_${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error } = await supabase.storage.from('product-images').upload(fileName, file);
        if (error) throw error;
      }
      fetchFiles();
    } catch (err: any) {
      alert('שגיאה בהעלאה: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUrl = (fileName: string) => {
    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    if (data?.publicUrl) {
      navigator.clipboard.writeText(data.publicUrl);
      alert('קישור התמונה הועתק ללוח בהצלחה! 📋');
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm('האם למחוק את התמונה לצמיתות?')) return;
    const { error } = await supabase.storage.from('product-images').remove([fileName]);
    if (error) {
      alert('שגיאה במחיקה: ' + error.message);
    } else {
      fetchFiles();
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-gray-900">ספריית מדיה 🖼️</h1>
          <p className="text-gray-500 text-sm mt-1">כל הקבצים והתמונות שהועלו למערכת בענן.</p>
        </div>
        
        <div>
          <label className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md cursor-pointer inline-block">
            {uploading ? 'מעלה קבצים...' : 'העלה תמונות חדשות 📁'}
            <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800">קבצים במערכת ({files.length})</h2>

        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">טוען תמונות...</p>
        ) : files.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">אין עדיין קבצים בספריית המדיה.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file) => {
              const { data } = supabase.storage.from('product-images').getPublicUrl(file.name);
              const publicUrl = data.publicUrl;

              return (
                <div key={file.id || file.name} className="bg-gray-50 rounded-2xl border p-3 flex flex-col justify-between space-y-3">
                  <div className="w-full h-36 bg-white rounded-xl border overflow-hidden flex items-center justify-center">
                    <img src={publicUrl} alt={file.name} className="w-full h-full object-contain p-1" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-xs text-gray-500 block truncate" title={file.name}>{file.name}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleCopyUrl(file.name)}
                        className="flex-1 bg-black text-white py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition"
                      >
                        העתק קישור 🔗
                      </button>
                      <button 
                        onClick={() => handleDelete(file.name)}
                        className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
