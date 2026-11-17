'use client';
import { useEffect, useState } from 'react';
import PhoneApp from '@/components/phone/PhoneApp';

// טלוויזיה שנכנסת לכתובת הראשית עוברת אוטומטית למסך הטלוויזיה
const TV_RE = 'SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|AFT[A-Z]|CrKey|GoogleTV|Android TV|AndroidTV|Roku|VIDAA|Opera TV|; TV[;)]';
const TV_UA = new RegExp(TV_RE, 'i');
// רץ מיד עם ה-HTML (לפני שכל קוד האפליקציה נטען) — הטלוויזיה לא מחכה לקוד של הטלפון
const EARLY = `try{if(new RegExp(${JSON.stringify(TV_RE)},'i').test(navigator.userAgent))location.replace('/tv'+location.search)}catch(e){}`;

export default function Page() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (TV_UA.test(navigator.userAgent)) location.replace('/tv' + location.search);
    else setOk(true);
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      {ok ? <PhoneApp /> : <Splash />}
    </>
  );
}

// מסך פתיחה שמופיע מיד מה-HTML השמור, במקום מסך לבן עד שהקוד עולה
function Splash() {
  return (
    <div className="wrap" style={{ paddingTop: 14 }}>
      <div className="top"><div className="row"><div className="h1 grow" style={{ opacity: 0.25 }}>מתכונים</div></div></div>
      <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card sk" />)}</div>
    </div>
  );
}
