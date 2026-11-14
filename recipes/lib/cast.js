'use client';
// סנכרון חי בין הטלפון לטלוויזיה (ערוץ Realtime של Supabase לכל מטבח).
// כל שינוי שולח את כל המצב; המכשירים מאמצים את הגרסה החדשה ביותר.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { deviceId, read, write } from './local';

const EVENTS = ['library', 'musicInfo', 'musicCmd', 'notice'];

export const BLANK = { v: 0, screen: 'home', recipeId: null, step: 0, servings: null, checked: {}, page: 0, timers: [], music: null };

function shift(state, skew) {
  if (!skew) return state;
  const timers = (state.timers || []).map((t) => (t.endsAt ? { ...t, endsAt: t.endsAt + skew } : t));
  return { ...state, timers };
}

export function useCast(kitchenId, role, onEvent) {
  const [state, setState] = useState(BLANK);
  const [peers, setPeers] = useState([]);
  const [online, setOnline] = useState(false);
  const ref = useRef(BLANK);
  const ch = useRef(null);
  const evRef = useRef(onEvent);
  evRef.current = onEvent;

  const apply = useCallback((s) => {
    ref.current = s;
    setState(s);
    if (kitchenId) write('rc_cast_' + kitchenId, s);
  }, [kitchenId]);

  const send = useCallback((event, payload = {}) => {
    ch.current?.send({ type: 'broadcast', event, payload: { ...payload, now: Date.now(), from: deviceId() } });
  }, []);

  useEffect(() => {
    if (!kitchenId) return;
    const saved = read('rc_cast_' + kitchenId, null);
    if (saved) { ref.current = { ...BLANK, ...saved }; setState(ref.current); }
    const c = supabase.channel('rc-k-' + kitchenId, { config: { broadcast: { self: false }, presence: { key: deviceId() } } });
    ch.current = c;
    c.on('broadcast', { event: 'state' }, ({ payload }) => {
      const raw = Date.now() - (payload.now || Date.now());
      const skew = Math.abs(raw) > 1500 ? raw : 0;
      const s = shift({ ...BLANK, ...payload.state }, skew);
      s.v = (payload.state?.v || 0) + skew;
      if (s.v > ref.current.v) apply(s);
    });
    c.on('broadcast', { event: 'hello' }, () => {
      if (ref.current.v) send('state', { state: ref.current });
    });
    for (const ev of EVENTS) c.on('broadcast', { event: ev }, ({ payload }) => evRef.current?.(ev, payload));
    c.on('presence', { event: 'sync' }, () => {
      const list = Object.values(c.presenceState()).flat();
      setPeers(list.filter((p) => p.device !== deviceId()));
    });
    c.subscribe((status) => {
      setOnline(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        c.track({ role, device: deviceId(), at: Date.now() });
        send('hello');
      }
    });
    const wake = () => { if (document.visibilityState === 'visible') send('hello'); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      supabase.removeChannel(c);
      ch.current = null;
    };
  }, [kitchenId, role, apply, send]);

  // update({...}) או update(prev => ({...}))
  const update = useCallback((patch) => {
    const cur = ref.current;
    const p = typeof patch === 'function' ? patch(cur) : patch;
    const next = { ...cur, ...p, v: Math.max(Date.now(), cur.v + 1) };
    apply(next);
    send('state', { state: next });
  }, [apply, send]);

  const tvOnline = peers.some((p) => p.role === 'tv');
  return { state, update, send, peers, tvOnline, online };
}

// ---- חיבור טלוויזיה חדשה בעזרת קוד ----
export function newPairCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function listenForPair(code, onKitchen) {
  const c = supabase.channel('rc-pair-' + code, { config: { broadcast: { self: false } } });
  c.on('broadcast', { event: 'kitchen' }, ({ payload }) => {
    if (payload?.kitchenId) {
      c.send({ type: 'broadcast', event: 'ok', payload: {} });
      setTimeout(() => onKitchen(payload.kitchenId), 300);
    }
  });
  c.subscribe();
  return () => supabase.removeChannel(c);
}

export function pairTv(code, kitchenId) {
  return new Promise((resolve) => {
    const c = supabase.channel('rc-pair-' + code, { config: { broadcast: { self: false } } });
    let done = false;
    const finish = (ok) => { if (done) return; done = true; clearInterval(iv); clearTimeout(to); supabase.removeChannel(c); resolve(ok); };
    let iv;
    const to = setTimeout(() => finish(false), 10000);
    c.on('broadcast', { event: 'ok' }, () => finish(true));
    c.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const ping = () => c.send({ type: 'broadcast', event: 'kitchen', payload: { kitchenId } });
        ping();
        iv = setInterval(ping, 1500);
      }
    });
  });
}
