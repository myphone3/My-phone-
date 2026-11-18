'use client';
import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import { ai, errText } from '@/lib/api';
import { toAIImage } from '@/lib/image';
import { luhnOk, copyText } from '@/lib/kb';

// סריקת IMEI: ברקוד במצלמה (אנדרואיד/כרום), או צילום — וה-AI קורא את המספרים מהמדבקה/מסך *#06#
export default function ImeiScan({ ctx, onPick }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [found, setFound] = useState([]);
  const [live, setLive] = useState(null); // null = בודק, false = אין סריקה חיה
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [model, setModel] = useState('');

  const add = (list) => setFound((f) => [...new Set([...f, ...list])]);

  useEffect(() => {
    let stream, stop = false, timer;
    (async () => {
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { setLive(false); return; }
      try {
        const det = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code', 'data_matrix'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
        if (stop) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setLive(true);
        const tick = async () => {
          if (stop) return;
          try {
            const codes = await det.detect(videoRef.current);
            const nums = codes.map((c) => String(c.rawValue).replace(/\D/g, '')).filter((n) => n.length === 15 || n.length === 14);
            if (nums.length) { add(nums.map((n) => (n.length === 15 ? n : n))); navigator.vibrate?.(60); }
          } catch {}
          timer = setTimeout(tick, 350);
        };
        tick();
      } catch { setLive(false); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function photo(file) {
    setBusy(true); setErr('');
    try {
      const img = await toAIImage(file, 1600);
      const r = await ai({ mode: 'imei', shop: ctx.shopId, images: [{ mime: img.mime, data: img.data }] });
      if (!r.imeis.length) setErr('לא הצלחתי לקרוא IMEI מהתמונה. נסה לצלם קרוב יותר ובלי השתקפות.');
      add(r.imeis); if (r.model) setModel(r.model);
    } catch (e) { setErr(errText(e)); }
    setBusy(false);
  }

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>📷 סריקת IMEI</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {live !== false && (
        <div className="scan-box">
          <video ref={videoRef} playsInline muted />
          <div className="scan-line" />
          {live === null && <div className="scan-hint">פותח מצלמה…</div>}
          {live && <div className="scan-hint">כוון לברקוד של ה-IMEI (על הקופסה / מדבקה)</div>}
        </div>
      )}
      <button className={'btn block ' + (live === false ? 'primary' : '')} style={{ marginTop: 10 }} disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <><span className="spin sm" /> קורא את התמונה…</> : '📸 צילום מדבקה / מסך *#06# — והמערכת תקרא'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) photo(f); e.target.value = ''; }} />
      {err && <div className="err">{err}</div>}
      {model && <div className="muted" style={{ marginTop: 8 }}>דגם: <b>{model}</b></div>}
      {found.map((n) => {
        const ok = n.length === 15 && luhnOk(n);
        return (
          <div key={n} className="field" style={{ marginTop: 8 }}>
            <div className="grow">
              <div className="k">{ok ? '✓ IMEI תקין' : n.length === 15 ? '⚠️ ספרת ביקורת לא מתאימה' : 'מספר'}</div>
              <div className="v mono" style={{ textAlign: 'start' }}>{n}</div>
            </div>
            <button className="btn sm" onClick={() => copyText(n).then(() => ctx.toast('הועתק'))}>העתק</button>
            <button className="btn sm primary" onClick={() => { onPick?.(n, model); ctx.close(); }}>בחירה</button>
          </div>
        );
      })}
    </Sheet>
  );
}
