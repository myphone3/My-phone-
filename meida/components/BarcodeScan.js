'use client';
import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';

// סריקת ברקוד של מוצר (גם QR). אנדרואיד: הקורא המובנה של הדפדפן. אייפון: ספריית zxing.
// במחשב: סורק USB פשוט כותב את המספר לתיבת החיפוש — אין צורך במסך הזה.
export default function BarcodeScan({ ctx, onPick }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('start'); // start | live | fail
  const [code, setCode] = useState('');
  const done = useRef(false);

  const pick = (raw) => {
    const v = String(raw || '').trim();
    if (!v || done.current) return;
    done.current = true;
    navigator.vibrate?.(60);
    ctx.close();
    setTimeout(() => onPick?.(v), 250);
  };

  useEffect(() => {
    let stream, timer, controls, stop = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState('fail'); return; }
      try {
        if ('BarcodeDetector' in window) {
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (stop) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setState('live');
          const tick = async () => {
            if (stop) return;
            try { const c = await det.detect(videoRef.current); if (c[0]?.rawValue) return pick(c[0].rawValue); } catch {}
            timer = setTimeout(tick, 250);
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (res) => { if (res) pick(res.getText()); });
          if (stop) controls.stop(); else setState('live');
        }
      } catch { setState('fail'); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); try { controls?.stop(); } catch {} };
  }, []); // eslint-disable-line

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>📷 סריקת ברקוד</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {state !== 'fail' && (
        <div className="cam">
          <video ref={videoRef} playsInline muted />
          <div className="cam-line" />
          {state === 'start' && <div className="cam-msg">פותח מצלמה…</div>}
        </div>
      )}
      {state === 'fail' && <div className="notice bad-box">לא הצלחתי לפתוח את המצלמה. צריך לאשר גישה למצלמה, או להקליד את המספר.</div>}
      <div className="muted small" style={{ marginTop: 8 }}>מכוונים את המצלמה לברקוד. במחשב: סורק ברקוד שמחובר ב-USB כותב ישר לתיבת החיפוש.</div>
      <label className="lbl">או מקלידים את המספר</label>
      <form className="row" onSubmit={(e) => { e.preventDefault(); pick(code); }}>
        <input className="input grow ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="7290000000000" />
        <button className="btn primary" type="submit">חיפוש</button>
      </form>
    </Sheet>
  );
}
