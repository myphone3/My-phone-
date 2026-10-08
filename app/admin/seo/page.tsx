'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminSEO() {
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState('');
  const [googleSiteVerification, setGoogleSiteVerification] = useState('');
  const [facebookPixelId, setFacebookPixelId] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      setMetaTitle(data.meta_title || '');
      setMetaDescription(data.meta_description || '');
      setGoogleAnalyticsId(data.google_analytics_id || '');
      setGoogleSiteVerification(data.google_site_verification || '');
      setFacebookPixelId(data.facebook_pixel_id || '');
      setFaviconUrl(data.favicon_url || '');
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingFavicon(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `favicon_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (pubData) {
        setFaviconUrl(pubData.publicUrl);
      }
    } catch (err: any) {
      alert('שגיאה בהעלאת אייקון: ' + err.message);
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({
      id: 1,
      meta_title: metaTitle,
      meta_description: metaDescription,
      google_analytics_id: googleAnalyticsId,
      google_site_verification: googleSiteVerification,
      facebook_pixel_id: facebookPixelId,
      favicon_url: faviconUrl,
    });

    if (error) {
      alert('שגיאה בשמירה: ' + error.message);
    } else {
      alert('הגדרות SEO ומעקב נשמרו בהצלחה! 🚀');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900">SEO ומעקב 🔍</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border space-y-6">
        
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">הגדרות Meta לאתר</h2>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Meta Title (כותרת האתר בגוגל)</label>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="למשל: NEW PHONE - הפלאפונים הכשרים המובילים"
              className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm focus:border-orange-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Meta Description (תיאור האתר בגוגל)</label>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="תיאור קצר שיופיע בתוצאות החיפוש של גוגל..."
              rows={3}
              className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm focus:border-orange-600"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">כלי מעקב ואימות</h2>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Google Analytics ID</label>
            <input
              type="text"
              value={googleAnalyticsId}
              onChange={(e) => setGoogleAnalyticsId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm focus:border-orange-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Google Site Verification</label>
            <input
              type="text"
              value={googleSiteVerification}
              onChange={(e) => setGoogleSiteVerification(e.target.value)}
              placeholder="הדבק כאן את קוד האימות של Google Search Console"
              className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm focus:border-orange-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Facebook Pixel ID</label>
            <input
              type="text"
              value={facebookPixelId}
              onChange={(e) => setFacebookPixelId(e.target.value)}
              placeholder="מספר מזהה פיקסל לפייסבוק"
              className="w-full border rounded-xl p-3 outline-none text-xs sm:text-sm focus:border-orange-600 font-mono"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-2">אייקון הדפדפן (Favicon)</h2>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleFaviconUpload}
              className="border rounded-xl p-2.5 text-xs bg-gray-50 cursor-pointer flex-1"
            />
            {faviconUrl && (
              <div className="w-12 h-12 rounded-xl border bg-gray-50 flex items-center justify-center p-1 shrink-0">
                <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
          {uploadingFavicon && <p className="text-xs text-blue-600 font-bold">מעלה אייקון...</p>}
          <span className="text-[11px] text-gray-500 block">מומלץ פורמט PNG או ICO מרובע (48x48 ומעלה).</span>
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3.5 rounded-2xl transition shadow-lg cursor-pointer text-sm"
          >
            {saving ? 'שומר הגדרות...' : 'שמור שינויים 💾'}
          </button>
        </div>

      </form>
    </div>
  );
}
