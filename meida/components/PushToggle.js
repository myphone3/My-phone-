'use client';
import { useEffect, useState } from 'react';
import { enablePush, disablePush, pushSupported, currentSub, isIOSNotInstalled } from '@/lib/push';
import { errText } from '@/lib/api';

// הפעלה/כיבוי של התראות בטלפון הזה (הודעות חדשות ותזכורות)
export default function PushToggle({ ctx, compact }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pushSupported()) { setOn(false); return; }
    currentSub().then((s) => setOn(!!s && Notification.permission === 'granted' && ctx.shop.notify !== false)).catch(() => setOn(false));
  }, [ctx.shop.notify]);
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
  return (
    <button className={'toggle card' + (compact ? ' info-box' : '')} style={{ width: '100%', marginTop: compact ? 0 : 12 }} disabled={busy} onClick={flip}>
      <span className={'check' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
      <span className="grow" style={{ textAlign: 'start' }}>
        <b>🔔 התראות בטלפון הזה</b>
        <div className="muted small">{on ? 'מקבל התראה על הודעה חדשה ועל תזכורות. לחיצה = כיבוי' : isIOSNotInstalled() ? 'באייפון: קודם מתקינים למסך הבית (שיתוף ← הוספה למסך הבית)' : 'לחיצה = לקבל התראה כשמישהו מפרסם הודעה או כשמגיעה תזכורת'}</div>
      </span>
    </button>
  );
}
