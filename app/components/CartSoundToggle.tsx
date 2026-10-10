'use client';

import React, { useEffect, useState } from 'react';

export default function CartSoundToggle() {
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    const savedMute = localStorage.getItem('user_sound_muted');
    if (savedMute === 'true') {
      setIsMuted(true);
    }
  }, []);

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    localStorage.setItem('user_sound_muted', String(nextState));
  };

  return (
    <div className="flex items-center justify-between bg-orange-50/80 border border-orange-200/60 p-3 rounded-2xl">
      <div className="flex items-center gap-2">
        <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
        <div className="text-right">
          <span className="text-xs font-bold text-gray-900 block">צלילי הקראה קולית</span>
          <span className="text-[10px] text-gray-500">השמעת הודעה קולית בעת הוספת מוצרים</span>
        </div>
      </div>

      <button
        onClick={toggleMute}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
          isMuted 
            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
            : 'bg-orange-600 text-white hover:bg-orange-700'
        }`}
      >
        {isMuted ? 'מושתק (לחץ להפעלה)' : 'פעיל (לחץ להשתקה)'}
      </button>
    </div>
  );
}
