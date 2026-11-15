export const metadata = { title: 'אפליקציה לטלוויזיה | מתכונים בגדול' };

export default function TvAppPage() {
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <div style={{ fontSize: 64, textAlign: 'center' }}>📺</div>
      <h1 className="title-lg" style={{ textAlign: 'center' }}>אפליקציית ״מתכונים בגדול״ לטלוויזיה</h1>
      <p className="muted" style={{ textAlign: 'center' }}>לטלוויזיות Android TV / Google TV (סוני, TCL, פיליפס, שיאומי, הייסנס עם גוגל), סטרימרים של Google TV ו-Fire TV.</p>
      <div className="tip">✓ המסך לא נכבה בזמן שהאפליקציה פתוחה &nbsp;·&nbsp; ✓ נפתחת מהשלט בלחיצה &nbsp;·&nbsp; ✓ המתכונים נשמרים בטלוויזיה וגם בלי אינטרנט &nbsp;·&nbsp; ✓ מוזיקה בלי לחיצה נוספת</div>

      <h2 className="h2">התקנה (פעם אחת, 3 דקות)</h2>
      <div className="box" style={{ padding: '6px 16px' }}>
        {[
          'בטלוויזיה נכנסים לחנות האפליקציות (Google Play / Amazon Appstore) ומתקינים את האפליקציה החינמית Downloader.',
          'בהגדרות הטלוויזיה מאשרים ל-Downloader להתקין אפליקציות: הגדרות ← אפליקציות ← אבטחה והגבלות ← מקורות לא ידועים ← Downloader (ב-Fire TV: הגדרות ← My Fire TV ← Developer options).',
          'פותחים את Downloader ומקלידים בשורת הכתובת:',
          'מאשרים התקנה ופותחים — ״מתכונים בגדול״ יופיע בשורת האפליקציות של הטלוויזיה.',
          'בטלפון לוחצים ״חיבור לטלוויזיה״ ומקלידים את הקוד שעל המסך. זהו!',
        ].map((t, i) => (
          <div key={i} className="step">
            <span className="n">{i + 1}</span>
            <span>{t}{i === 2 && <><br /><b dir="ltr" style={{ fontSize: 18, background: 'var(--accent-soft)', padding: '2px 10px', borderRadius: 8, display: 'inline-block', marginTop: 6 }}>matkonim-myphone3.vercel.app/matkonim-tv.apk</b></>}</span>
          </div>
        ))}
      </div>
      <a className="btn primary big block" style={{ marginTop: 16 }} href="/matkonim-tv.apk" download>⬇️ הורדת האפליקציה (APK)</a>
      <p className="muted small" style={{ marginTop: 16 }}>טלוויזיה של סמסונג או LG (בלי גוגל)? שם אי אפשר להתקין אפליקציות מבחוץ — פותחים את הדפדפן של הטלוויזיה ונכנסים לכתובת <b dir="ltr">matkonim-myphone3.vercel.app</b>. מומלץ לשמור במועדפים.</p>
      <a className="btn block" href="/" style={{ marginTop: 10 }}>חזרה למתכונים</a>
    </div>
  );
}
