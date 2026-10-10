import { supabase } from '@/lib/supabase';

export const playAddToCartSpeech = async () => {
  try {
    // 1. בדיקה האם הלקוח בחר להשתיק את הצלילים בעגלה
    if (typeof window !== 'undefined') {
      const isUserMuted = localStorage.getItem('user_sound_muted') === 'true';
      if (isUserMuted) return; // אם מושתק - יוצאים ולא משמיעים כלום
    }

    // 2. שליפת ההגדרות המעודכנות מ-Supabase
    const { data, error } = await supabase
      .from('settings')
      .select('speech_enabled, speech_text')
      .single();

    if (error || !data) return;

    // 3. אם הדיבור מופעל ויש טקסט מוגדר
    if (data.speech_enabled && data.speech_text) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // עצירת הקראה קודמת אם הייתה
        const utterance = new SpeechSynthesisUtterance(data.speech_text);
        utterance.lang = 'he-IL';
        utterance.rate = 0.95; // מהירות דיבור נעימה וטבעית
        window.speechSynthesis.speak(utterance);
      }
    }
  } catch (err) {
    console.error('Error playing speech helper:', err);
  }
};
