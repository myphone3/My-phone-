'use client';
import { installSwipeClose } from '@/lib/swipeClose';
import { useEffect, useState } from 'react';

// כפתור "התקן למסך הבית": באנדרואיד מתקין ישירות, באייפון/בתוך וואטסאפ מסביר מה לעשות
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(null);

  useEffect(() => {
    installSwipeClose();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) setInstalled(true);
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;

  async function click() {
    if (prompt) {
      prompt.prompt();
      const r = await prompt.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') setInstalled(true);
      setPrompt(null);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const inApp = /WhatsApp|FBAN|FBAV|Instagram|Line\/|Telegram|wv\)|; wv/.test(ua);
    if (inApp) setHelp('inapp');
    else if (ios && !/Safari/.test(ua.replace(/CriOS|FxiOS|EdgiOS/, 'X'))) setHelp('ios-other');
    else if (ios) setHelp('ios');
    else setHelp('android');
  }

  const link = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); alert('הקישור הועתק — הדבק אותו בדפדפן'); } catch {} };

  return (
    <>
      <button className="btn block" style={{ marginBottom: 16, borderColor: 'var(--brand)', color: 'var(--brand)' }} onClick={click}>
        📲 התקן כאפליקציה במסך הבית
      </button>
      {help && (
        <div className="sheet-bg" onClick={() => setHelp(null)}>
          <div className="sheet" data-swipe-close onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <h3>📲 הוספה למסך הבית</h3>
            {help === 'inapp' && (
              <>
                <p>הקישור נפתח בתוך וואטסאפ (או אפליקציה אחרת) — משם אי אפשר להוסיף למסך הבית.</p>
                <ol style={{ paddingInlineStart: 20, lineHeight: 1.9 }}>
                  <li>לחץ על <b>⋮</b> או <b>⋯</b> למעלה ובחר <b>"פתח בדפדפן"</b> / <b>"פתח ב-Chrome"</b> / <b>"פתח בספארי"</b></li>
                  <li>שם לחץ שוב על הכפתור הירוק "התקן כאפליקציה"</li>
                </ol>
                <button className="btn block" onClick={copy}>🔗 או העתק את הקישור והדבק בדפדפן</button>
              </>
            )}
            {help === 'ios' && (
              <ol style={{ paddingInlineStart: 20, lineHeight: 2 }}>
                <li>לחץ על כפתור השיתוף <b>⬆️</b> (ריבוע עם חץ, למטה באמצע המסך)</li>
                <li>גלול למטה ובחר <b>"הוסף למסך הבית"</b> (Add to Home Screen)</li>
                <li>לחץ <b>"הוסף"</b> למעלה</li>
              </ol>
            )}
            {help === 'ios-other' && (
              <>
                <p>באייפון אפשר להוסיף למסך הבית מספארי (ובגרסאות חדשות גם מכרום דרך כפתור השיתוף).</p>
                <ol style={{ paddingInlineStart: 20, lineHeight: 1.9 }}>
                  <li>לחץ על כפתור השיתוף <b>⬆️</b> ובחר <b>"הוסף למסך הבית"</b></li>
                  <li>אם אין — העתק את הקישור ופתח אותו בספארי</li>
                </ol>
                <button className="btn block" onClick={copy}>🔗 העתק קישור</button>
              </>
            )}
            {help === 'android' && (
              <ol style={{ paddingInlineStart: 20, lineHeight: 2 }}>
                <li>בכרום: לחץ על <b>⋮</b> (שלוש נקודות למעלה בצד)</li>
                <li>בחר <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b></li>
                <li>אם לא מופיע — רענן את הדף ונסה שוב אחרי כמה שניות</li>
              </ol>
            )}
            <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setHelp(null)}>הבנתי</button>
          </div>
        </div>
      )}
    </>
  );
}
