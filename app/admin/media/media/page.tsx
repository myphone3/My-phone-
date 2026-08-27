'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminMediaLibrary() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('product-images')
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      if (data) {
        // יצירת קישורים ציבוריים לכל קובץ
        const filesWithUrls = data.map((file) => {
          const { data: pubData } = supabase.storage
            .from('product-images')
            .getPublicUrl(file.name);
          return {
            ...file,
            publicUrl: pubData?.publicUrl || ''
          };
        });
        setFiles(filesWithUrls);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('קישור התמונה הועתק ללוח! 📋');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">ספריית מדיה ותמונות ({files.length})</h1>

      {loading ? (
        <p className="text-gray-500">טוען קבצים מהענן...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-400">אין עדיין קבצים בספרייה.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file, index) => (
            <div key={index} className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col gap-2 group">
              <div className="w-full h-32 bg-gray-50 rounded-xl overflow-hidden relative">
                <img src={file.publicUrl} alt={file.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-500 truncate" title={file.name}>{file.name}</p>
              <button
                onClick={() => copyToClipboard(file.publicUrl)}
                className="w-full bg-gray-100 hover:bg-black hover:text-white text-gray-800 text-xs py-1.5 rounded-lg transition font-medium"
              >
                העתק קישור 🔗
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
