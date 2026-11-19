'use client';
import { useEffect, useState } from 'react';
import { enablePush, disablePush, pushSupported, currentSub, isIOSNotInstalled } from '@/lib/push';
import { api, errText } from '@/lib/api';

const MODES = [
  { k: 'asks', t: 'רק שאלות ותשובות', s: 'בירור מחיר, "יש לנו?", שאלה לצוות, מישהו ענה לי, והודעה דחופה' },
  { k: 'all', t: 'הכול', s: 'גם הודעות, מלאי, פתקים, תגובות ותזכורות' },
];

// הפעלה/כיבוי של התראות בטלפון הזה, ובחירה על מה לקבל התראה (לכל עובד בנפרד)
export default function PushToggle({ ctx, compact }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('kb_nmode_' + ctx.shopId) || 'asks'; } catch { return 'asks'; } });
  useEffect(() => {
    if (!pushSupported()) { setOn(false); return; }
    currentSub().then((s) => setOn(!!s && Notification.permission === 'granted' && ctx.shop.notify !== false)).catch(() => setOn(false));
  }, [ctx.shop.notify]);
  useEffect(() => {
    if (compact) return;
    api.notifyMode(ctx.shopId).then((m) => { if (m) { setMode(m); try { localStorage.setItem('kb_nmode_' + ctx.shopId, m); } catch {} } }).catch(() => {});
  }, [ctx.shopId, compact]);
  if (on === null) return null;
  if (compact && on) return null;
  async function flip() {
    setBusy(true);
    try {
      if (on) { await disablePush(ctx.shopId); setOn(false); ctx.toast('ההתראות כובו בטלפון הזה'); }
      else { await enablePush(ctx.shopId); setOn(true); ctx.toast('ההתראות הופעלו 🔔'); }
      ctx.refresh();
    } catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  async function pick(k) {
    if (k === mode) return;
    const prev = mode;
    setMode(k);
    try {
      await api.setNotifyMode(ctx.shopId, k);
      try { localStorage.setItem('kb_nmode_' + ctx.shopId, k); } catch {}
      ctx.toast(k === 'asks' ? 'מעכשיו: התראות רק על שאלות ותשובות' : 'מעכשיו: התראות על הכול');
    } catch (e) { setMode(prev); ctx.toast(errText(e)); }
  }
  const sub = on ? (mode === 'asks' ? 'מקבל התראה רק על שאלות, תשובות והודעות דחופות. לחיצה = כיבוי' : 'מקבל התראה על הכול. לחיצה = כיבוי')
    : isIOSNotInstalled() ? 'באייפון: קודם מתקינים למסך הבית (שיתוף ← הוספה למסך הבית)' : 'לחיצה = לקבל התראה כשמישהו שואל שאלה או עונה לך';
  return (
    <div className={'card' + (compact ? ' info-box' : '')} style={{ marginTop: compact ? 0 : 12 }}>
      <button className="toggle" style={{ width: '100%' }} disabled={busy} onClick={flip}>
        <span className={'check' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
        <span className="grow" style={{ textAlign: 'start' }}>
          <b>🔔 התראות בטלפון הזה</b>
          <div className="muted small">{sub}</div>
        </span>
      </button>
      {on && !compact && (
        <div style={{ display: 'grid', gap: 8, padding: '0 12px 12px' }}>
          <div className="muted small"><b>על מה לקבל התראה?</b> (חל על כל הטלפונים שלך בחנות הזו)</div>
          {MODES.map((m) => (
            <button key={m.k} className={'nmode' + (mode === m.k ? ' on' : '')} aria-pressed={mode === m.k} onClick={() => pick(m.k)}>
              <span className="radio" />
              <span className="grow" style={{ textAlign: 'start' }}><b>{m.t}</b><div className="muted small">{m.s}</div></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
