// שש אופציות לאייקון — SVG בגודל 512
module.exports = {
  // 1. זכוכית: קבלה שקופה על גרדיאנט סגול-טורקיז, עם מגן זוהר
  glass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>
  <linearGradient id="g1b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
  <radialGradient id="g1c"><stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#10b981"/></radialGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="14"/></filter></defs>
  <rect width="512" height="512" fill="url(#g1)"/>
  <circle cx="400" cy="110" r="120" fill="#f0abfc" opacity=".35" filter="url(#glow)"/>
  <path d="M138 92h236a18 18 0 0 1 18 18v300l-34-24-34 24-34-24-34 24-34-24-34 24-34-24-34 24V110a18 18 0 0 1 18-18z" fill="url(#g1b)" stroke="#fff" stroke-opacity=".7" stroke-width="4"/>
  <rect x="172" y="140" width="120" height="16" rx="8" fill="#fff" opacity=".85"/><rect x="172" y="176" width="168" height="12" rx="6" fill="#fff" opacity=".5"/><rect x="172" y="202" width="140" height="12" rx="6" fill="#fff" opacity=".5"/>
  <circle cx="330" cy="330" r="74" fill="#10b981" opacity=".55" filter="url(#glow)"/>
  <path d="M330 262l58 22v40c0 38-25 62-58 76-33-14-58-38-58-76v-40z" fill="url(#g1c)" stroke="#fff" stroke-width="5"/>
  <path d="M306 330l17 17 33-35" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 2. ניאון: רקע כהה, קבלה בקווי ניאון וטבעת ספירה לאחור
  neon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><filter id="n"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs>
  <rect width="512" height="512" fill="#0b0b1a"/>
  <circle cx="256" cy="256" r="178" fill="none" stroke="#1f1f3a" stroke-width="22"/>
  <circle cx="256" cy="256" r="178" fill="none" stroke="url(#ng)" stroke-width="22" stroke-linecap="round" stroke-dasharray="820 1200" transform="rotate(-90 256 256)" filter="url(#n)"/>
  <path d="M200 160h112a10 10 0 0 1 10 10v172l-20-14-20 14-20-14-20 14-20-14-20 14-20-14-20 14V170a10 10 0 0 1 10-10z" fill="none" stroke="#e0f2fe" stroke-width="10" stroke-linejoin="round" filter="url(#n)"/>
  <path d="M222 200h68M222 230h52M222 260h60" stroke="#22d3ee" stroke-width="10" stroke-linecap="round" filter="url(#n)"/>
  <circle cx="256" cy="78" r="13" fill="#e879f9" filter="url(#n)"/></svg>`,

  // 3. קבלה שהופכת למגן: הצורה עצמה היא גם קבלה וגם מגן
  morph: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="m1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset=".55" stop-color="#ff3d77"/><stop offset="1" stop-color="#a62bff"/></linearGradient>
  <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffe4ee"/></linearGradient>
  <filter id="sh"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#5b0030" flood-opacity=".35"/></filter></defs>
  <rect width="512" height="512" fill="url(#m1)"/>
  <path d="M146 96h220v170c0 92-50 140-110 164-60-24-110-72-110-164z" fill="url(#m2)" filter="url(#sh)"/>
  <path d="M146 96l18 16 18-16 18 16 18-16 18 16 18-16 18 16 18-16 18 16 18-16 18 16 18-16" fill="none" stroke="#ff3d77" stroke-width="7" stroke-linejoin="round"/>
  <rect x="190" y="150" width="132" height="15" rx="7.5" fill="#ffb3c9"/><rect x="190" y="182" width="96" height="15" rx="7.5" fill="#ffb3c9"/>
  <path d="M206 268l34 34 68-72" fill="none" stroke="#ff3d77" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 4. טבעת אחריות: כמו טבעות הפעילות בשעון — כמה אחריות נשארה
  ring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="r1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient>
  <linearGradient id="r2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>
  <rect width="512" height="512" fill="#052e2b"/>
  <circle cx="256" cy="256" r="184" fill="none" stroke="#0b4a43" stroke-width="40"/>
  <circle cx="256" cy="256" r="184" fill="none" stroke="url(#r1)" stroke-width="40" stroke-linecap="round" stroke-dasharray="880 1200" transform="rotate(-90 256 256)"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="#3b2a0d" stroke-width="30"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="url(#r2)" stroke-width="30" stroke-linecap="round" stroke-dasharray="300 900" transform="rotate(-90 256 256)"/>
  <path d="M220 190h72a8 8 0 0 1 8 8v116l-13-9-13 9-13-9-13 9-13-9-13 9-13-9-13 9V198a8 8 0 0 1 8-8z" fill="#ecfdf5"/>
  <path d="M234 222h44M234 246h30M234 270h38" stroke="#059669" stroke-width="9" stroke-linecap="round"/></svg>`,

  // 5. סריקה חכמה: מסגרת מצלמה עם קרן סריקה — "מצלמים והיא קוראת לבד"
  scan: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="s1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>
  <linearGradient id="s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#67e8f9" stop-opacity="0"/><stop offset="1" stop-color="#67e8f9" stop-opacity=".55"/></linearGradient>
  <filter id="sg"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="512" height="512" fill="url(#s1)"/>
  <path d="M96 170V118a22 22 0 0 1 22-22h52M342 96h52a22 22 0 0 1 22 22v52M416 342v52a22 22 0 0 1-22 22h-52M170 416h-52a22 22 0 0 1-22-22v-52" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
  <path d="M186 140h140a10 10 0 0 1 10 10v222l-25-17-25 17-25-17-25 17-25-17-25 17-25-17V150a10 10 0 0 1 10-10z" fill="#fff"/>
  <path d="M212 182h88M212 214h62M212 246h76M212 278h50" stroke="#93c5fd" stroke-width="12" stroke-linecap="round"/>
  <rect x="150" y="196" width="212" height="74" fill="url(#s2)"/>
  <rect x="140" y="266" width="232" height="9" rx="4.5" fill="#67e8f9" filter="url(#sg)"/>
  <path d="M378 70l9 22 22 9-22 9-9 22-9-22-22-9 22-9z" fill="#fde047"/></svg>`,

  // 6. ארנק: ערימת קבלות כמו כרטיסים בארנק דיגיטלי, עם תג אחריות
  wallet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="w0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18181b"/><stop offset="1" stop-color="#000"/></linearGradient>
  <linearGradient id="w1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#ef4444"/></linearGradient>
  <linearGradient id="w2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
  <linearGradient id="w3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
  <filter id="ws"><feDropShadow dx="0" dy="-6" stdDeviation="8" flood-opacity=".45"/></filter></defs>
  <rect width="512" height="512" fill="url(#w0)"/>
  <rect x="96" y="104" width="320" height="200" rx="28" fill="url(#w1)"/>
  <rect x="96" y="164" width="320" height="200" rx="28" fill="url(#w2)" filter="url(#ws)"/>
  <rect x="96" y="226" width="320" height="190" rx="28" fill="url(#w3)" filter="url(#ws)"/>
  <rect x="126" y="258" width="110" height="16" rx="8" fill="#fff" opacity=".9"/><rect x="126" y="290" width="70" height="14" rx="7" fill="#fff" opacity=".6"/>
  <circle cx="356" cy="356" r="44" fill="#fff"/>
  <path d="M336 356l14 14 26-28" fill="none" stroke="#2563eb" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
