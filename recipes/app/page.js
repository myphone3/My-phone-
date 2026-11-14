'use client';
import { useEffect, useState } from 'react';
import PhoneApp from '@/components/phone/PhoneApp';

// טלוויזיה שנכנסת לכתובת הראשית עוברת אוטומטית למסך הטלוויזיה
const TV_UA = /SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|AFT[A-Z]|CrKey|GoogleTV|Android TV|AndroidTV|Roku|VIDAA|Opera TV|; TV[;)]/i;

export default function Page() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (TV_UA.test(navigator.userAgent)) location.replace('/tv' + location.search);
    else setOk(true);
  }, []);
  return ok ? <PhoneApp /> : null;
}
