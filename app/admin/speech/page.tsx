'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SpeechAdminPage() {
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);
  const [speechText, setSpeechText] = useState<string>('תִּתְחַדֵּשׁ! עוֹד מְעַט וְזֶה אֶצְלְךָ');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('settings').select('*').single();
      if (data) {
        if (data.speech_enabled !== undefined) setSpeechEnabled(data.speech_enabled);
        if (data.speech_text) setSpeechText(data.speech_text);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 1, speech_enabled: speechEnabled, speech_text: speechText });

      if (error) throw error;
      alert('ההגדרות שנשמרו בהצלחה! 🎉');
    } catch (err) {
      console.error('Error saving speech settings:', err);
      alert('שגיאה בשמירת ההגדרות.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'he-IL';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('הדפדפן שלך אינו תומך בהקראה קולית.');
    }
  };

  if (loading) return <div className="p-8 text-center font-bold">טוען הגדרות ניהול...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6" dir="rtl">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-gray-900">🔊 ניהול הקראה קולית בהוספה לעגלה</h1>
        <p className="text-gray-500 text-sm">הגדר מה האתר יגיד ללקוח בעת הוספת מוצר לעגלה</p>
      </div>

      <div className="bg-white border rounded-2xl p-6 space-y-6 shadow-xs">
        {/* מתג הפעלה / כיבוי */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <span className="font-bold text-gray-900 block">הפעל הקראה קולית באתר</span>
            <span className="text-xs text-gray-400">כשכבוי, לא יישמע קול בעת הוספה לעגלה</span>
          </div>
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className={`w-12 h-6 rounded-full transition p-1 cursor-pointer ${
              speechEnabled ? 'bg-orange-600' : 'bg-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition transform ${
              speechEnabled ? 'translate-x-[-24px]' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* טקסט להקראה כולל ניקוד */}
        <div className="space-y-2">
          <label className="font-bold text-gray-900 text-sm block">
            טקסט ההודעה הקולית (תומך בניקוד מלא לשליטה במגדר והגייה מדויקת):
          </label>
          <textarea
            rows={3}
            value={speechText}
            onChange={(e) => setSpeechText(e.target.value)}
            placeholder="הכנס טקסט מנוקד..."
            className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none font-medium"
          />
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl space-y-1">
            <span className="font-bold block">💡 טיפ לניקוד ולמגדר:</span>
            <p>• <b>פנייה לרבים / ניטרלית:</b> "תִּתְחַדְּשׁוּ! הַמּוּצָר בַּעֲגָלָה"</p>
            <p>• <b>לשון זכר:</b> "תִּתְחַדֵּשׁ! עוֹד מְעַט וְזֶה אֶצְלְךָ"</p>
            <p>• <b>לשון נקבה:</b> "תִּתְחַדְּשִׁי! עוֹד מְעַט וְזֶה אֶצְלֵךְ"</p>
          </div>
        </div>

        {/* כפתורי בדיקה ושמירה */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleTestSpeech}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>🔊 השמע בדיקה</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור הגדרות 💾'}
          </button>
        </div>
      </div>
    </div>
  );
}
