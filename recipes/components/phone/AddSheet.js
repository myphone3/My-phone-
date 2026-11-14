'use client';
import { useRef, useState } from 'react';
import { filesToPages, uploadPages, extractRecipes, cropCover } from '@/lib/importer';
import { saveRecipe } from '@/lib/api';
import { emptyRecipe } from '@/lib/recipe';
import { Sheet } from './ui';

export default function AddSheet({ kitchenId, onClose, replace, changed, say }) {
  const [stage, setStage] = useState('choose');
  const [pages, setPages] = useState([]);
  const [pdfText, setPdfText] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const gallery = useRef();
  const camera = useRef();

  const addFiles = async (list) => {
    const files = [...(list || [])];
    if (!files.length) return;
    setStage('busy');
    try {
      const out = await filesToPages(files, setStatus, 10 - pages.length);
      if (!out.pages.length && !out.text) throw new Error('לא מצאנו תמונה או PDF בקבצים שנבחרו');
      setPages((p) => [...p, ...out.pages]);
      setPdfText((t) => (t + '\n' + out.text).trim());
      setStage('pages');
    } catch (e) {
      say(e.message || 'לא הצלחנו לפתוח את הקובץ');
      setStage(pages.length ? 'pages' : 'choose');
    }
  };

  const run = async (useText) => {
    setStage('busy');
    let urls = [];
    try {
      if (!useText && pages.length) urls = await uploadPages(kitchenId, pages, setStatus);
      setStatus('קוראים את המתכון ומסדרים לפי שלבים... (עד חצי דקה)');
      const recipes = await extractRecipes({ images: urls, text: useText ? text : pdfText });
      if (!recipes.length) {
        replace({ name: 'edit', draft: { ...emptyRecipe(), source_images: urls, image_url: urls[0] || '', note: 'לא זיהינו מתכון בצורה אוטומטית. אפשר להקליד אותו כאן — עמודי המקור נשמרו למטה.' } });
        return;
      }
      const withCover = async (r) => {
        let cover = '';
        if (r.photo && pages[r.photo.image]) cover = (await cropCover(kitchenId, pages[r.photo.image].blob, r.photo.box)) || '';
        const { photo, ...rest } = r;
        return { ...rest, source_images: urls, image_url: cover };
      };
      if (recipes.length === 1) {
        setStatus('כמעט מוכן...');
        replace({ name: 'edit', draft: await withCover(recipes[0]) });
        return;
      }
      for (let i = 0; i < recipes.length; i++) {
        setStatus(`שומרים מתכון ${i + 1} מתוך ${recipes.length}...`);
        await saveRecipe(kitchenId, await withCover(recipes[i]));
      }
      await changed();
      say(`נשמרו ${recipes.length} מתכונים ✓`);
      onClose();
    } catch (e) {
      if (urls.length || useText) {
        replace({ name: 'edit', draft: { ...emptyRecipe(), source_images: urls, image_url: urls[0] || '', note: 'הקריאה האוטומטית לא הצליחה כרגע. אפשר להקליד את המתכון, או לנסות שוב מאוחר יותר. עמודי המקור נשמרו.', ...(useText ? { steps: [{ title: '', items: text.split('\n').filter(Boolean) }] } : {}) } });
      } else {
        say(e.message || 'משהו השתבש, נסו שוב');
        setStage(pages.length ? 'pages' : 'choose');
      }
    }
  };

  return (
    <Sheet onClose={stage === 'busy' ? () => {} : onClose}>
      <input ref={gallery} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      {stage === 'choose' && (
        <>
          <h3>הוספת מתכון</h3>
          <button className="option" onClick={() => gallery.current?.click()}>
            <span className="oi">📄</span><span><b>קובץ PDF או תמונות מהטלפון</b><small>מהגלריה, מהקבצים או מוואטסאפ</small></span>
          </button>
          <button className="option" onClick={() => camera.current?.click()}>
            <span className="oi">📷</span><span><b>צילום מתכון</b><small>מספר בישול, מחברת או דף</small></span>
          </button>
          <button className="option" onClick={() => setStage('text')}>
            <span className="oi">📋</span><span><b>הדבקת טקסט</b><small>מהודעה, מאתר או ממסמך</small></span>
          </button>
          <button className="option" onClick={() => replace({ name: 'edit', draft: emptyRecipe() })}>
            <span className="oi">✍️</span><span><b>הקלדה ידנית</b><small>לכתוב מתכון מאפס</small></span>
          </button>
        </>
      )}

      {stage === 'pages' && (
        <>
          <h3>{pages.length > 1 ? `${pages.length} עמודים` : 'העמוד מוכן'}</h3>
          <div className="thumbs">
            {pages.map((p, i) => (
              <div key={p.preview} className="thumb-wrap"><img src={p.preview} alt={`עמוד ${i + 1}`} /><button className="x" onClick={() => setPages(pages.filter((_, j) => j !== i))}>✕</button></div>
            ))}
            {pages.length < 10 && <button className="add" onClick={() => camera.current?.click()}>📷</button>}
            {pages.length < 10 && <button className="add" onClick={() => gallery.current?.click()}>🖼️</button>}
          </div>
          <p className="muted small">המתכון ממשיך בעמוד נוסף? הוסיפו עוד צילום או קובץ.</p>
          <button className="btn primary big block" disabled={!pages.length && !pdfText} onClick={() => run(false)}>✨ סדרו לי את המתכון</button>
        </>
      )}

      {stage === 'text' && (
        <>
          <h3>הדבקת מתכון</h3>
          <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="הדביקו כאן את כל המתכון — מצרכים ואופן הכנה" autoFocus />
          <button className="btn primary big block" style={{ marginTop: 12 }} disabled={text.trim().length < 15} onClick={() => run(true)}>✨ סדרו לי את המתכון</button>
        </>
      )}

      {stage === 'busy' && (
        <div className="busy">
          <div className="spinner" />
          <b>{status || 'רגע...'}</b>
          <p className="muted small">מחלקים למצרכים, לחלקים ולשלבים לפי סדר ההכנה</p>
        </div>
      )}
    </Sheet>
  );
}
