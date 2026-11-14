'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { listenForPair, newPairCode } from '@/lib/cast';
import { groups, scaleText, flatSteps, detectMinutes, fmtMinutes, fmtClock, ingredientsForStep } from '@/lib/recipe';
import { remaining } from '@/lib/timers';
import { emojiFor, metaLine } from '@/components/phone/ui';

export function useQr(text, size = 600) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!text) return;
    QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => {});
  }, [text, size]);
  return src;
}

export function Clock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    f();
    const iv = setInterval(f, 10000);
    return () => clearInterval(iv);
  }, []);
  return <span className="clock">{t}</span>;
}

// ---- חיבור ראשון: קוד + ברקוד ----
export function TvPair({ onKitchen }) {
  const [code, setCode] = useState('');
  useEffect(() => {
    let stop = () => {};
    const start = () => {
      stop();
      const c = newPairCode();
      setCode(c);
      stop = listenForPair(c, onKitchen);
    };
    start();
    const iv = setInterval(start, 10 * 60 * 1000);
    return () => { clearInterval(iv); stop(); };
  }, [onKitchen]);
  const qr = useQr(code && typeof location !== 'undefined' ? `${location.origin}/?pair=${code}` : '');
  return (
    <div className="tvs">
      <div className="tv-top"><span className="brand">🍳 מתכונים בגדול</span><span style={{ flex: 1 }} /><Clock /></div>
      <div className="tv-pair">
        <div>
          <h1>מחברים את הטלפון</h1>
          <p>כך המתכונים מהטלפון יופיעו כאן בגדול — בלי שיקוף מסך.</p>
          <ol className="tv-steps">
            <li>סרקו את הברקוד עם המצלמה של הטלפון</li>
            <li>או: באפליקציה בטלפון לחצו ״חיבור לטלוויזיה״ והקלידו את הקוד</li>
          </ol>
          <div className="tv-code">{code.slice(0, 3)} {code.slice(3)}</div>
          <p style={{ fontSize: '1rem' }}>מחברים פעם אחת בלבד. בפעם הבאה הטלוויזיה תתחבר לבד.</p>
        </div>
        <div className="tv-qr">{qr && <img src={qr} alt="ברקוד לחיבור" />}</div>
      </div>
    </div>
  );
}

// ---- מסך הבית ----
export function TvHome({ data, cast }) {
  const recipes = [...(data?.recipes || [])].sort((a, b) => (b.favorite - a.favorite) || String(b.last_cooked_at || b.created_at).localeCompare(String(a.last_cooked_at || a.created_at)));
  const h = new Date().getHours();
  const hello = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  const phoneLink = typeof location !== 'undefined' && data?.kitchen ? `${location.origin}/?k=${data.kitchen.id}` : '';
  const qr = useQr(phoneLink, 300);
  const phones = cast.peers.filter((p) => p.role === 'phone').length;
  const today = ((data?.kitchen?.plan || {})[todayKey()] || []).map((id) => recipes.find((r) => r.id === id)).filter(Boolean);
  return (
    <div className="tv-home" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1>{hello}! מה מבשלים היום?</h1>
          <p className="sub">{phones ? 'בחרו מתכון בטלפון — הוא ייפתח כאן מיד. אפשר גם לבחור עם השלט.' : 'בחרו מתכון עם השלט, או פתחו את האפליקציה בטלפון.'}</p>
        </div>
        {!phones && qr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card)', borderRadius: '1.2rem', padding: '.8rem 1.2rem' }}>
            <img src={qr} alt="" style={{ width: '6.5rem', background: '#fff', borderRadius: '.6rem', padding: '.3rem' }} />
            <span style={{ fontSize: '1rem', color: 'var(--muted)', maxWidth: '11rem' }}>סרקו כדי לפתוח את המתכונים בטלפון</span>
          </div>
        )}
      </div>
      {today.length > 0 && (
        <div className="tv-today">
          <span className="lbl">📅 בתפריט היום</span>
          {today.map((r, i) => (
            <button key={r.id} data-nav="" data-autofocus={i === 0 ? '' : undefined} className="tv-today-item" onClick={() => cast.update({ screen: 'recipe', recipeId: r.id, step: 0, servings: null, checked: {}, page: 0 })}>
              {r.image_url ? <img src={r.image_url} alt="" /> : <span>{emojiFor(r)}</span>}<b>{r.title}</b>
            </button>
          ))}
        </div>
      )}
      {!recipes.length && <p className="sub" style={{ fontSize: '1.6rem', marginTop: '4rem', textAlign: 'center' }}>📖 עוד אין מתכונים. הוסיפו מתכון מהטלפון — מ-PDF, מתמונה או מצילום.</p>}
      <div className="tv-rail">
        {recipes.map((r, i) => (
          <button key={r.id} className="tv-card" data-nav="" data-autofocus={i === 0 && !today.length ? '' : undefined}
            onClick={() => cast.update({ screen: 'recipe', recipeId: r.id, step: 0, servings: null, checked: {}, page: 0 })}>
            <div className="ph">{r.image_url ? <img src={r.image_url} alt="" /> : emojiFor(r)}</div>
            <div className="t">{r.favorite ? '❤️ ' : ''}{r.title}</div>
            <div className="m">{metaLine(r) || r.category || ' '}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function useFactor(recipe, state) {
  const base = Number(recipe.servings) || null;
  const servings = state.servings ?? base;
  return { base, servings, factor: base && servings ? servings / base : 1 };
}

// ---- המתכון המלא ----
export function TvRecipe({ recipe, cast }) {
  const s = cast.state;
  const { servings, factor } = useFactor(recipe, s);
  const ing = groups(recipe.ingredients);
  const steps = groups(recipe.steps);
  const checked = s.checked || {};
  let n = 0;
  return (
    <div className="tv-recipe">
      <div className="side">
        <div className="img">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : emojiFor(recipe)}</div>
        <h1>{recipe.title}</h1>
        {recipe.description && <div className="desc">{recipe.description}</div>}
        <div className="tv-pills">
          {recipe.prep_minutes ? <span className="tv-pill">🔪 {fmtMinutes(recipe.prep_minutes)}</span> : null}
          {recipe.cook_minutes ? <span className="tv-pill">🔥 {fmtMinutes(recipe.cook_minutes)}</span> : null}
          {servings ? <span className="tv-pill">🍽️ {servings} מנות</span> : null}
        </div>
        <div className="tv-btns">
          <button className="tv-btn primary" data-nav="" data-autofocus="" onClick={() => cast.update({ screen: 'cook' })}>👩‍🍳 מתחילים לבשל</button>
          <button className="tv-btn" data-nav="" onClick={() => cast.update({ screen: 'ingredients' })}>🧺 מצרכים</button>
          {recipe.source_images?.length > 0 && <button className="tv-btn" data-nav="" onClick={() => cast.update({ screen: 'original', page: 0 })}>📄 המקור</button>}
          <button className="tv-btn" data-nav="" onClick={() => cast.update({ screen: 'home', recipeId: null })}>🏠</button>
        </div>
      </div>
      <div className="tv-cols">
        <div className="tv-panel">
          <h2>🧺 מצרכים {factor !== 1 && <small style={{ color: 'var(--accent)', fontSize: '1rem' }}>· ל-{servings} מנות</small>}</h2>
          <div className="scroll" data-nav="" data-scroll="">
            {ing.map((g, gi) => (
              <div key={gi}>
                {g.title && <div className="tv-gt">{g.title}</div>}
                {g.items.map((item, i) => {
                  const key = `${gi}-${i}`;
                  return <div key={key} className={'tv-ing' + (checked[key] ? ' done' : '')}><span className="ck">{checked[key] ? '✓' : ''}</span><span>{scaleText(item, factor)}</span></div>;
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="tv-panel">
          <h2>📝 אופן ההכנה</h2>
          <div className="scroll" data-nav="" data-scroll="">
            {steps.map((g, gi) => (
              <div key={gi} className="tv-sec">
                {g.title && <div className="tv-gt">{g.title}</div>}
                {g.items.map((t, i) => { const idx = n++; return <div key={i} className="st"><b>{idx + 1}</b><span>{t}</span></div>; })}
              </div>
            ))}
            {(recipe.tips || []).length > 0 && (
              <div className="tv-sec"><div className="tv-gt">💡 טיפים</div>{recipe.tips.map((t, i) => <div key={i} className="st"><b>•</b><span>{t}</span></div>)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- שלב אחרי שלב ----
export function TvCook({ recipe, cast }) {
  const s = cast.state;
  const all = flatSteps(recipe);
  const step = Math.min(s.step || 0, Math.max(0, all.length - 1));
  const cur = all[step];
  const next = all[step + 1];
  const minutes = cur ? detectMinutes(cur.text) : null;
  const { factor } = useFactor(recipe, s);
  const used = cur ? ingredientsForStep(recipe, cur.text) : [];
  const usedKeys = new Set(used.map((u) => u.key));
  const ing = groups(recipe.ingredients);
  const checked = s.checked || {};
  const len = cur?.text.length || 0;
  const side = useRef();

  useEffect(() => {
    const el = side.current?.querySelector('.hl');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [step]);

  if (!cur) return <div className="tv-main"><h1>אין שלבים במתכון</h1></div>;
  return (
    <div className="tv-cook">
      <div className="stage">
        <div className="where">
          <span>{recipe.title}</span>
          {cur.section && <span className="sec">{cur.section}</span>}
          <span style={{ marginInlineStart: 'auto' }}>שלב {step + 1} מתוך {all.length}</span>
        </div>
        <div className="prog">{all.map((_, i) => <i key={i} className={i < step ? 'past' : i === step ? 'cur' : ''} />)}</div>
        <div className="big">
          <p key={step} className={len > 240 ? 'xlong' : len > 140 ? 'long' : ''} style={{ animation: 'up .3s ease-out' }}>{cur.text}</p>
        </div>
        {minutes && <div className="stage-timer">⏱️ לחצו OK בשלט להפעלת טיימר ל-{fmtMinutes(minutes)}</div>}
        {next ? (
          <div className="next"><span>השלב הבא</span><b>{next.section && next.section !== cur.section ? `${next.section}: ` : ''}{next.text}</b></div>
        ) : (
          <div className="next" style={{ color: 'var(--herb)' }}><span>🎉</span><b>זה השלב האחרון — בתיאבון!</b></div>
        )}
        <div className="tv-hint"><span><kbd>◀</kbd> הבא</span><span><kbd>▶</kbd> הקודם</span><span><kbd>OK</kbd> טיימר</span><span><kbd>▼</kbd> מצרכים</span><span><kbd>חזור</kbd> למתכון</span></div>
      </div>
      <div className="tv-panel">
        <h2>🧺 מצרכים</h2>
        <div className="scroll" ref={side}>
          {ing.map((g, gi) => (
            <div key={gi}>
              {g.title && <div className="tv-gt">{g.title}</div>}
              {g.items.map((item, i) => {
                const key = `${gi}-${i}`;
                return <div key={key} className={'tv-ing' + (checked[key] ? ' done' : '') + (usedKeys.has(key) ? ' hl' : '')} style={{ fontSize: '1.1rem' }}><span className="ck">{checked[key] ? '✓' : ''}</span><span>{scaleText(item, factor)}</span></div>;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TvOriginal({ recipe, cast }) {
  const imgs = recipe.source_images || [];
  const page = Math.min(cast.state.page || 0, Math.max(0, imgs.length - 1));
  if (!imgs.length) return null;
  return (
    <div className="tv-original">
      <img src={imgs[page]} alt="" />
      {imgs.length > 1 && <div className="pg">עמוד {page + 1} מתוך {imgs.length}</div>}
    </div>
  );
}

export function TvTimers({ timers, now }) {
  const list = (timers || []).filter((t) => !(t.endsAt && remaining(t, now) <= 0));
  if (!list.length) return null;
  return (
    <div className="tv-timers">
      {list.map((t) => (
        <div key={t.id} className={'tv-timer' + (t.endsAt ? '' : ' paused')}>
          <span style={{ fontSize: '1.4rem' }}>{t.endsAt ? '⏱️' : '⏸️'}</span>
          <span className="tt">{fmtClock(remaining(t, now))}</span>
          <span className="lb">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---- מצרכים בגדול (להכנת הכל מראש) ----
export function TvIngredients({ recipe, cast }) {
  const s = cast.state;
  const { servings, factor } = useFactor(recipe, s);
  const ing = groups(recipe.ingredients);
  const checked = s.checked || {};
  const total = ing.reduce((a, g) => a + g.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="where" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.3rem', marginBottom: '1rem' }}>
        <b style={{ fontSize: '2rem' }}>🧺 {recipe.title}</b>
        {servings ? <span className="tv-pill">{servings} מנות{factor !== 1 ? ' (מחושב)' : ''}</span> : null}
        <span style={{ marginInlineStart: 'auto', color: 'var(--muted)' }}>{done} מתוך {total} מוכנים</span>
      </div>
      <div className="tv-ing-cols">
        {ing.map((g, gi) => (
          <div key={gi} className="tv-ing-group">
            {g.title && <div className="tv-gt" style={{ fontSize: '1.3rem' }}>{g.title}</div>}
            {g.items.map((item, i) => {
              const key = `${gi}-${i}`;
              return (
                <button key={key} data-nav="" data-autofocus={gi === 0 && i === 0 ? '' : undefined} className={'tv-ing big' + (checked[key] ? ' done' : '')}
                  onClick={() => cast.update((st) => ({ checked: { ...(st.checked || {}), [key]: !(st.checked || {})[key] } }))}>
                  <span className="ck">{checked[key] ? '✓' : ''}</span><span>{scaleText(item, factor)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="tv-hint"><span><kbd>OK</kbd> סימון</span><span><kbd>חזור</kbd> למתכון</span></div>
    </div>
  );
}

// ---- תשובת השף על המסך ----
export function TvChef({ chef, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 45000); return () => clearTimeout(t); }, [chef, onClose]);
  return (
    <div className="tv-chef">
      <div className="q">👩‍🍳 {chef.q}</div>
      <div className="a">{chef.a}</div>
      <small>חזור / OK לסגירה</small>
    </div>
  );
}

// ---- שומר מסך: תמונות המתכונים ושעון ----
export function TvIdle({ data }) {
  const pics = (data?.recipes || []).filter((r) => r.image_url);
  const [i, setI] = useState(0);
  useEffect(() => { const iv = setInterval(() => setI((x) => x + 1), 9000); return () => clearInterval(iv); }, []);
  const r = pics.length ? pics[i % pics.length] : null;
  const [t, setT] = useState('');
  useEffect(() => { const f = () => setT(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })); f(); const iv = setInterval(f, 10000); return () => clearInterval(iv); }, []);
  const d = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="tv-idle">
      {r && <img key={r.id} src={r.image_url} alt="" />}
      <div className="shade" />
      <div className="txt">
        <div className="clock-big">{t}</div>
        <div className="date">{d}</div>
        {r && <div className="rt">{r.title}</div>}
        <div className="hint">לחצו על כפתור כלשהו בשלט</div>
      </div>
    </div>
  );
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
