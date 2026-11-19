// ציורים לשאר המוצרים בסופר: חלב, לחם, בשר, שתייה, ניקיון...
// רוב המוצרים הארוזים בנויים מתבנית (קרטון, בקבוק, קופסה, שקית) + ציור קטן של מה שבפנים.
import { P, D, ball, leaf, LEAF, LEAFD } from './produce';

const W = '#FFFFFF', OFF = '#F5F3EE', GREY = '#D9DCE1', GREYD = '#AEB4BD', DARK = '#37474F';
const mini = (svg, cx, cy, size) => { const s = size / 64; return `<g transform="translate(${cx - 32 * s} ${cy - 32 * s}) scale(${s})">${svg}</g>`; };
const hl = (x, y, w, h, o = 0.45) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" opacity="${o}"/>`;
const drop = (c) => `<path d="M32 10C32 10 18 28 18 38A14 14 0 0 0 46 38C46 28 32 10 32 10Z" fill="${c}"/>`;
const C = (b, d, l) => ({ b, d, l: l || '#fff' });

// ─── תבניות אריזה ───
function carton(top, band, inner = '') {
  return `<path d="M15 22H39V59H15Z" fill="${OFF}"/><path d="M39 22L50 16V53L39 59Z" fill="${GREY}"/>` +
    `<path d="M15 22L27 10L39 22Z" fill="${top}"/><path d="M27 10L38 4L50 16L39 22Z" fill="${top}" opacity=".75"/><path d="M27 10L38 4V1L27 7Z" fill="${OFF}"/>` +
    `<path d="M15 31H39V51H15Z" fill="${band}"/><path d="M39 31L50 25V45L39 51Z" fill="${band}" opacity=".7"/>` + inner + hl(17, 24, 2.5, 32, 0.6);
}
function bottle(liquid, cap, label, inner = '', o = {}) {
  const neck = o.neck || 'wide';
  const body = neck === 'thin'
    ? 'M23 28C23 22 28 20 28 15V7H36V15C36 20 41 22 41 28V57Q41 60 38 60H26Q23 60 23 57Z'
    : 'M20 24C20 19 25 17 26 13V9H38V13C39 17 44 19 44 24V56Q44 60 40 60H24Q20 60 20 56Z';
  const [x1, x2] = neck === 'thin' ? [23, 41] : [20, 44];
  return `<path d="${body}" fill="${liquid}"/>` +
    `<path d="${body}" fill="#000" opacity=".12" transform="translate(${(x1 + x2) / 2 * 0.35} 0) scale(.65 1)" />` +
    `<rect x="${neck === 'thin' ? 27 : 25}" y="${neck === 'thin' ? 3 : 4}" width="${neck === 'thin' ? 10 : 14}" height="${neck === 'thin' ? 6 : 6}" rx="1.5" fill="${cap}"/>` +
    (label ? `<rect x="${x1}" y="33" width="${x2 - x1}" height="16" fill="${label}"/>` : '') + inner + hl(x1 + 2.5, 27, 2.5, 26, 0.5);
}
function can(body, label, inner = '', o = {}) {
  if (o.flat) // קופסת טונה / רסק — נמוכה ורחבה
    return `<rect x="10" y="26" width="44" height="26" rx="3" fill="${body}"/><ellipse cx="32" cy="52" rx="22" ry="5" fill="${body}"/>` +
      `<rect x="10" y="31" width="44" height="17" fill="${label}"/>` + inner +
      `<ellipse cx="32" cy="26" rx="22" ry="5.5" fill="${GREY}"/><ellipse cx="32" cy="26" rx="18" ry="4" fill="${GREYD}" opacity=".6"/>`;
  return `<rect x="16" y="12" width="32" height="46" rx="3" fill="${body}"/><ellipse cx="32" cy="58" rx="16" ry="4" fill="${body}"/>` +
    `<rect x="16" y="22" width="32" height="26" fill="${label}"/>` + inner +
    `<ellipse cx="32" cy="12" rx="16" ry="4.5" fill="${GREY}"/><ellipse cx="32" cy="12" rx="12.5" ry="3" fill="${GREYD}" opacity=".6"/>` + hl(19, 16, 2.5, 38, 0.4);
}
function jar(lid, content, inner = '', label = OFF) {
  return `<rect x="15" y="19" width="34" height="40" rx="8" fill="${content}"/>` +
    `<rect x="17" y="11" width="30" height="10" rx="2.5" fill="${lid}"/><path d="M17 16H47" stroke="#000" stroke-width="1" opacity=".15"/>` +
    (label ? `<rect x="15" y="29" width="34" height="20" fill="${label}"/>` : '') + inner + hl(18.5, 23, 3, 30, 0.45);
}
function tub(lid, band, inner = '', o = {}) {
  const tall = o.tall;
  const body = tall ? 'M16 20H48L45 57Q44.6 59 42 59H22Q19.4 59 19 57Z' : 'M10 26H54L50 55Q49.5 58 46 58H18Q14.5 58 14 55Z';
  return `<path d="${body}" fill="${OFF}"/>` +
    (band ? (tall ? `<path d="M17.2 30H46.8L45.6 48H18.4Z" fill="${band}"/>` : `<path d="M11.2 34H52.8L51.6 46H12.4Z" fill="${band}"/>`) : '') + inner +
    (tall ? `<rect x="14" y="15" width="36" height="6" rx="2" fill="${lid}"/>` : `<rect x="8" y="20" width="48" height="7" rx="2.5" fill="${lid}"/>`) +
    `<path d="${body}" fill="#000" opacity=".07" transform="translate(${tall ? 20 : 22} 0) scale(.65 1)"/>`;
}
function bag(col, inner = '', o = {}) {
  const dark = o.dark || '#000';
  let zig = ''; for (let x = 14; x < 50; x += 4) zig += `L${x + 2} ${o.top || 11}L${x + 4} ${(o.top || 11) + 3}`;
  return `<path d="M13 14Q32 11 51 14L53 55Q32 60 11 55Z" fill="${col}"/>` +
    `<path d="M13 14${zig}L51 14Z" fill="${col}"/><path d="M13 16Q32 13 51 16" stroke="${dark}" stroke-width="1" opacity=".2" fill="none"/>` +
    `<path d="M44 16L51 14L53 55L45 57Z" fill="${dark}" opacity=".12"/>` + inner + hl(15.5, 20, 2.5, 30, 0.35);
}
function box(front, side, inner = '') {
  return `<path d="M13 16H41V60H13Z" fill="${front}"/><path d="M41 16L51 10V54L41 60Z" fill="${side}"/><path d="M13 16L23 10H51L41 16Z" fill="${side}" opacity=".75"/>` + inner;
}
function squeeze(col, cap, inner = '') {
  return `<path d="M21 22Q21 17 26 17H38Q43 17 43 22V54Q43 59 38 59H26Q21 59 21 54Z" fill="${col}"/>` +
    `<path d="M27 17V11H37V17Z" fill="${cap}"/><path d="M30 11L31 4H33L34 11Z" fill="${cap}"/>` + inner +
    `<rect x="37" y="20" width="5" height="36" rx="2.5" fill="#000" opacity=".1"/>` + hl(23.5, 22, 2.5, 30, 0.5);
}
function jug(col, cap, inner = '') {
  return `<path d="M14 24Q14 18 20 18H34L40 12H46Q50 12 50 17V56Q50 60 46 60H18Q14 60 14 56Z" fill="${col}"/>` +
    `<path d="M40 18H45V32H40Q37 32 37 29V21Q37 18 40 18Z" fill="#fff" opacity=".85"/>` +
    `<rect x="17" y="12" width="12" height="7" rx="1.5" fill="${cap}"/>` + inner + hl(17, 26, 2.5, 28, 0.45);
}
function spray(col, head) {
  return `<path d="M20 28Q20 24 24 24H40Q44 24 44 28V56Q44 60 40 60H24Q20 60 20 56Z" fill="${col}"/>` +
    `<path d="M26 24V17H38V24Z" fill="${head}"/><path d="M22 10H44L46 16H26Q22 16 22 12Z" fill="${head}"/><path d="M30 17Q28 22 24 22" stroke="${head}" stroke-width="2.5" fill="none"/>` +
    `<rect x="23" y="34" width="18" height="16" rx="2" fill="#fff" opacity=".85"/>` + hl(22.5, 28, 2.5, 26, 0.45);
}
function pump(col, head, label = '#fff') {
  return `<rect x="19" y="22" width="26" height="38" rx="6" fill="${col}"/><rect x="27" y="14" width="10" height="8" fill="${head}"/>` +
    `<path d="M24 10H40V14H24Z" fill="${head}"/><path d="M24 10H16V13H24Z" fill="${head}"/>` +
    `<rect x="22" y="32" width="20" height="18" rx="3" fill="${label}" opacity=".9"/>` + `<rect x="39" y="25" width="4" height="32" rx="2" fill="#000" opacity=".12"/>` + hl(21.5, 26, 2.5, 28, 0.45);
}
function roll(n = 1, col = W) {
  const one = (x, y) => `<path d="M${x - 11} ${y - 13}V${y + 13}A11 4 0 0 0 ${x + 11} ${y + 13}V${y - 13}Z" fill="${col}" stroke="#B8C2CA" stroke-width="1"/>` +
    `<path d="M${x + 5} ${y - 12}V${y + 16}A11 4 0 0 0 ${x + 11} ${y + 13}V${y - 13}Z" fill="#90A4AE" opacity=".25"/><ellipse cx="${x}" cy="${y - 13}" rx="11" ry="4" fill="#F4F6F7" stroke="#B8C2CA" stroke-width="1"/><ellipse cx="${x}" cy="${y - 13}" rx="3.6" ry="1.6" fill="#B0906A"/>`;
  return n === 1 ? one(32, 34) : one(19, 26) + one(45, 26) + one(32, 42);
}
function cup(col, top, steam) {
  return (steam ? `<path d="M26 14Q23 10 26 6M32 14Q29 10 32 6M38 14Q35 10 38 6" stroke="#B0BEC5" stroke-width="2" fill="none" stroke-linecap="round"/>` : '') +
    `<path d="M44 30H47Q53 30 53 37T47 44H44" stroke="${col}" stroke-width="4" fill="none"/>` +
    `<path d="M13 22H47L44 53Q43 58 38 58H22Q17 58 16 53Z" fill="${col}"/><ellipse cx="30" cy="22" rx="17" ry="4" fill="${top}"/>` + hl(17, 26, 2.5, 24, 0.4);
}

// ─── ציורים קטנים לתוויות ───
const MILKDROP = mini(drop('#fff'), 27, 41, 18);
const fruitMini = (k, cx, cy, s, ...a) => mini(D[k](...a), cx, cy, s);

export const PD = {
  // חלב וביצים
  milk: () => carton('#1E88E5', '#1E88E5', MILKDROP),
  chocomilk: () => carton('#6D4C41', '#6D4C41', mini(drop('#D7B899'), 27, 41, 18)),
  soymilk: () => carton('#7CB342', '#7CB342', MILKDROP),
  cream: () => carton('#E53935', '#FFFFFF', mini(drop('#90CAF9'), 27, 41, 16)),
  eggs: () => {
    let o = `<path d="M6 36H58L54 52Q53 55 50 55H14Q11 55 10 52Z" fill="#B9C7CF"/>`;
    for (const x of [16, 27, 38, 49]) o += `<ellipse cx="${x - 0.5}" cy="30" rx="5.6" ry="8" fill="#F3DDBB"/><ellipse cx="${x + 1.5}" cy="32" rx="3" ry="5.5" fill="#D9BC92" opacity=".5"/>` + hl(x - 3.5, 25, 1.8, 6, 0.8);
    return o + `<path d="M6 36H58" stroke="#90A4AE" stroke-width="2"/><path d="M16 44V52M27 44V52M37 44V52M48 44V52" stroke="#90A4AE" stroke-width="1.4"/>`;
  },
  egg: () => `<path d="M32 9C21 9 14 26 14 38C14 50 22 57 32 57S50 50 50 38C50 26 43 9 32 9Z" fill="#F7E7CE"/><path d="M44 18C48 25 50 32 50 38C50 50 42 57 32 57C42 51 47 38 44 18Z" fill="#D9C2A0" opacity=".5"/>` + hl(21, 22, 4, 13, 0.75),
  yellowCheese: () => `<path d="M6 44L52 18L58 26V50L6 52Z" fill="#F9C846"/><path d="M6 44L52 18L58 26L12 46Z" fill="#FFDD7A"/><path d="M58 26V50L52 51V24Z" fill="#E0A825"/>` +
    [[20, 48, 3], [34, 46, 2.4], [44, 38, 3.2], [28, 44, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E0A825"/>`).join('') + `<ellipse cx="40" cy="32" rx="3" ry="1.6" fill="#E0A825"/>`,
  whiteCheese: () => tub('#1E88E5', '#BBDEFB', mini(drop('#1E88E5'), 32, 40, 12)),
  cottage: () => tub('#43A047', '#C8E6C9', `<circle cx="27" cy="40" r="2" fill="#fff"/><circle cx="33" cy="38" r="2.4" fill="#fff"/><circle cx="38" cy="41" r="2" fill="#fff"/>`),
  yogurt: () => tub('#EC407A', '#F8BBD0', fruitMini('strawberry', 32, 39, 14), { tall: true }),
  leben: () => tub('#1E88E5', '#BBDEFB', mini(drop('#fff'), 32, 39, 12), { tall: true }),
  pudding: () => `<path d="M16 22H48L45 57Q44.6 59 42 59H22Q19.4 59 19 57Z" fill="#6D4C41"/><path d="M16 22H48L47 30H17Z" fill="#FFF8E7"/>` +
    `<path d="M18 30Q22 34 26 30T34 30T42 30T47 30" fill="#FFF8E7"/><rect x="14" y="17" width="36" height="6" rx="2" fill="#3E2723"/>` + hl(20, 34, 2.5, 18, 0.25),
  butter: () => `<path d="M8 36L36 24L56 32L28 46Z" fill="#FFE9A8"/><path d="M8 36V48L28 58V46Z" fill="#F5C842"/><path d="M28 46V58L56 44V32Z" fill="#E3B22E"/>` +
    `<path d="M8 36L36 24L56 32L28 46Z" fill="none" stroke="#E3B22E" stroke-width=".8"/><path d="M14 40V48L22 52V44Z" fill="#fff" opacity=".5"/>`,
  feta: () => `<path d="M10 30L32 20L54 28L32 40Z" fill="#FFFFFF"/><path d="M10 30V46L32 56V40Z" fill="#ECEFF1"/><path d="M32 40V56L54 44V28Z" fill="#CFD8DC"/>` +
    `<circle cx="20" cy="40" r="1.2" fill="#B0BEC5"/><circle cx="26" cy="46" r="1" fill="#B0BEC5"/><circle cx="42" cy="44" r="1.2" fill="#90A4AE"/>`,
  mozzarella: () => `<ellipse cx="32" cy="36" rx="20.5" ry="18.5" fill="#D9D3BE"/>` + ball(32, 36, 20, 18, { b: '#FBFAF5', d: '#C9C3AE', l: '#fff' }) + leaf(36, 18, -20, 13, 4.4),

  // לחם ומאפים
  bread: () => `<path d="M8 30Q8 16 22 16H44Q58 16 58 30Q58 36 53 37V54Q53 57 50 57H16Q13 57 13 54V37Q8 36 8 30Z" fill="#C98A47"/>` +
    `<path d="M10 30Q10 19 22 19H44Q56 19 56 30" stroke="#E3A962" stroke-width="3" fill="none"/>` +
    `<path d="M22 22L26 30M32 21L36 29M42 22L46 30" stroke="#8D5A26" stroke-width="2.4" stroke-linecap="round"/><path d="M44 37H53V54Q53 57 50 57H44Z" fill="#8D5A26" opacity=".35"/>`,
  roll: () => ball(32, 38, 22, 15, { b: '#D69A55', d: '#8D5A26', l: '#F2C48C' }) + `<path d="M22 30Q32 26 42 30" stroke="#8D5A26" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  pita: () => `<ellipse cx="32" cy="42" rx="25" ry="10" fill="#E2B57A"/><ellipse cx="32" cy="36" rx="25" ry="10" fill="#EBC58F"/><ellipse cx="32" cy="30" rx="25" ry="10" fill="#F2D3A2"/>` +
    `<circle cx="22" cy="28" r="2" fill="#D49E5C"/><circle cx="36" cy="26" r="2.6" fill="#D49E5C"/><circle cx="42" cy="32" r="1.6" fill="#D49E5C"/>`,
  challah: () => {
    let o = '';
    for (const [x, y, r] of [[13, 40, 7], [22, 34, 9], [32, 31, 10], [42, 34, 9], [51, 40, 7]]) o += `<ellipse cx="${x}" cy="${y + 4}" rx="${r}" ry="${r * 1.05}" fill="#B86A2A"/><ellipse cx="${x - 1.5}" cy="${y + 1.5}" rx="${r * 0.8}" ry="${r * 0.75}" fill="#D98E45"/>`;
    for (const [x, y, r] of [[18, 46, 7], [32, 44, 9], [46, 46, 7]]) o += `<ellipse cx="${x}" cy="${y}" rx="${r * 1.1}" ry="${r}" fill="#A55E22"/><ellipse cx="${x - 1}" cy="${y - 2}" rx="${r * 0.85}" ry="${r * 0.7}" fill="#C97C35"/>`;
    return o + [[22, 30], [30, 27], [36, 29], [44, 31], [28, 41], [36, 40]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1" ry=".6" fill="#FFF3D6"/>`).join('');
  },
  baguette: () => `<g transform="rotate(-35 32 32)"><rect x="2" y="24" width="60" height="16" rx="8" fill="#D39042"/><path d="M14 27L20 37M26 27L32 37M38 27L44 37M50 27L55 35" stroke="#F2C27E" stroke-width="2.6" stroke-linecap="round"/><rect x="2" y="34" width="60" height="6" rx="3" fill="#8D5A26" opacity=".3"/></g>`,
  croissant: () => {
    const segs = [[10, 42, 7, 9, -50, '#D98E3A'], [18, 31, 8, 11, -30, '#E59C45'], [32, 26, 10, 13, 0, '#F0AE55'], [46, 31, 8, 11, 30, '#E59C45'], [54, 42, 7, 9, 50, '#D98E3A']];
    return segs.map(([x, y, rx, ry, r, c]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('') +
      `<path d="M24 22Q32 34 40 22M13 30Q20 38 25 32M51 30Q44 38 39 32" stroke="#A9661E" stroke-width="1.6" fill="none" opacity=".7"/>` + hl(27, 18, 2.4, 8, 0.5);
  },
  cake: () => `<path d="M8 40L36 22L56 32V50L28 58L8 50Z" fill="#F6E1C3"/><path d="M8 40L28 46V58L8 50Z" fill="#EBC9A0"/><path d="M28 46L56 32V50L28 58Z" fill="#DDB68A"/>` +
    `<path d="M8 40L36 22L56 32L28 46Z" fill="#7B4A2E"/><path d="M8 47L28 53L56 41" stroke="#7B4A2E" stroke-width="2.4" fill="none"/>` + ball(36, 28, 4, 4, P.red, false) + `<path d="M36 24Q37 20 40 19" stroke="${LEAFD}" stroke-width="1.4" fill="none"/>`,
  cookies: () => [[22, 40, 15], [40, 28, 14]].map(([x, y, r]) => ball(x, y, r, r, { b: '#D9A35E', d: '#9C6A2E', l: '#F2D29E' }, false) +
    [[-5, -4], [4, -6], [6, 3], [-3, 5], [0, 0]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="1.9" fill="#4E2C1A"/>`).join('')).join(''),
  bourekas: () => `<path d="M8 50L32 14L56 50Z" fill="#E3A24F"/><path d="M14 46L32 20L50 46Z" fill="#F0BC6C"/><path d="M8 50L56 50L52 54H12Z" fill="#B97A2E"/>` +
    [[26, 38], [32, 32], [38, 38], [32, 42]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry=".8" fill="#5B4636"/>`).join(''),
  breadcrumbs: () => bag('#F2D3A2', `<circle cx="32" cy="36" r="10" fill="#fff"/>` + mini(PD.bread(), 32, 36, 16), { dark: '#8D5A26' }),

  // בשר, עוף ודגים
  chicken: () => `<rect x="12" y="38" width="7" height="20" rx="3.5" fill="#F5EBDC" transform="rotate(45 15.5 48)"/><circle cx="8" cy="52" r="4.2" fill="#F5EBDC"/><circle cx="12" cy="57" r="4.2" fill="#F5EBDC"/>` +
    `<path d="M22 42C16 36 16 24 26 16C36 8 52 10 56 22C60 34 50 46 38 46C32 46 28 46 22 42Z" fill="#E08E3C"/>` +
    `<path d="M52 16C58 26 56 40 42 45C36 47 30 46 25 44C38 42 50 32 52 16Z" fill="#A85B1C" opacity=".4"/>` + hl(28, 20, 3, 12, 0.45).replace('<rect', '<rect transform="rotate(40 29 26)"'),
  schnitzel: () => `<path d="M10 32Q8 20 22 18Q32 12 44 18Q58 20 56 34Q56 48 40 50Q30 56 20 50Q8 46 10 32Z" fill="#D9963F"/>` +
    [[20, 28], [30, 22], [42, 26], [48, 36], [36, 40], [24, 40], [32, 32], [18, 36], [44, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#A9661E"/>`).join('') + ball(48, 46, 6, 5, P.yellow, false),
  steak: () => `<path d="M10 30Q8 16 24 14Q36 12 46 18Q58 24 54 38Q50 50 34 50Q22 52 14 44Q10 38 10 30Z" fill="#C62828"/>` +
    `<path d="M10 30Q8 16 24 14Q36 12 46 18Q58 24 54 38Q50 50 34 50Q22 52 14 44Q10 38 10 30Z" fill="none" stroke="#F6E0D2" stroke-width="3"/>` +
    `<path d="M20 26Q28 30 26 38M36 22Q40 30 46 32" stroke="#F3B6A8" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="40" cy="38" rx="4" ry="3" fill="#F6E0D2"/>`,
  groundMeat: () => `<path d="M6 36H58L54 52Q53 55 50 55H14Q11 55 10 52Z" fill="#ECEFF1"/>` +
    [[16, 34], [24, 30], [32, 32], [40, 29], [48, 34], [20, 38], [30, 38], [40, 37], [28, 26], [36, 25]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${5 + (i % 3)}" fill="${i % 2 ? '#C94545' : '#B83434'}"/>`).join('') +
    `<path d="M6 36H58" stroke="#B0BEC5" stroke-width="2"/>` + [[22, 30], [34, 28], [44, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#F4C7C0"/>`).join(''),
  kebab: () => `<path d="M8 56L56 8" stroke="#90A4AE" stroke-width="2.6" stroke-linecap="round"/>` +
    [[20, 44, '#8D4A25'], [28, 36, '#43A047'], [36, 28, '#8D4A25'], [44, 20, '#E53935']].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="5.4" fill="${c}" transform="rotate(-45 ${x} ${y})"/>`).join(''),
  burger: () => `<path d="M10 30Q10 12 32 12T54 30Z" fill="#D9963F"/>` + [[22, 20], [30, 17], [38, 20], [44, 24], [26, 25]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry=".8" fill="#FFF3D6"/>`).join('') +
    `<path d="M8 32Q14 28 20 33T32 33T44 33T56 32V35H8Z" fill="#7CB342"/><rect x="9" y="34" width="46" height="5" fill="#F9C846"/><rect x="8" y="38" width="48" height="9" rx="4.5" fill="#6D3A1E"/>` +
    `<path d="M10 48H54Q54 56 46 56H18Q10 56 10 48Z" fill="#D9963F"/>`,
  hotdog: () => `<g transform="rotate(-15 32 34)"><rect x="6" y="30" width="52" height="16" rx="8" fill="#E3A24F"/><rect x="4" y="27" width="56" height="10" rx="5" fill="#C0472B"/>` +
    `<path d="M12 31Q16 28 20 31T28 31T36 31T44 31T52 31" stroke="#F9C846" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="6" y="38" width="52" height="8" rx="4" fill="#D9963F"/></g>`,
  fish: (c = { b: '#90A4AE', d: '#546E7A', l: '#ECEFF1' }) => `<path d="M6 32Q18 14 36 16Q48 18 52 28L60 18V46L52 36Q48 46 36 48Q18 50 6 32Z" fill="${c.b}"/>` +
    `<path d="M6 32Q18 50 36 48Q48 46 52 36L44 34Q30 42 6 32Z" fill="${c.l}" opacity=".7"/><circle cx="16" cy="28" r="2.6" fill="#fff"/><circle cx="16" cy="28" r="1.4" fill="#263238"/>` +
    `<path d="M24 24Q28 32 24 40" stroke="${c.d}" stroke-width="1.6" fill="none"/><path d="M34 16Q38 10 44 12L42 18Z" fill="${c.d}"/>`,
  salmon: () => `<path d="M8 22Q32 14 56 22L54 46Q32 52 10 46Z" fill="#FF8A65"/><path d="M8 22Q32 14 56 22L55 28Q32 22 9 28Z" fill="#FFAB91"/>` +
    [16, 24, 32, 40, 48].map((x) => `<path d="M${x} 21Q${x + 4} 34 ${x} 48" stroke="#FFE0D6" stroke-width="1.8" fill="none"/>`).join(''),

  // מעדנייה
  salami: () => `<g transform="rotate(-20 32 32)"><rect x="4" y="22" width="40" height="20" rx="10" fill="#8E2A2A"/><path d="M4 32H40" stroke="#5C1414" stroke-width="1" opacity=".4"/><rect x="6" y="24" width="30" height="3" rx="1.5" fill="#fff" opacity=".2"/></g>` +
    ball(44, 40, 14, 14, { b: '#C0504D', d: '#8E2A2A', l: '#E58B87' }, false) + [[40, 36], [48, 38], [44, 46], [38, 44], [50, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#F4D3CC"/>`).join(''),
  hummus: (c = '#E9CF9B', top = '#C79A4E') => `<path d="M8 32H56L52 52Q51 56 46 56H18Q13 56 12 52Z" fill="#fff" stroke="#C5CDD3" stroke-width="1.2"/><ellipse cx="32" cy="32" rx="24" ry="7" fill="${c}"/><path d="M18 32Q32 26 46 32" stroke="${top}" stroke-width="2" fill="none"/>` +
    `<circle cx="28" cy="31" r="1.6" fill="#7CB342"/><circle cx="36" cy="33" r="1.4" fill="#C62828"/><path d="M8 32H56L55.4 36H8.6Z" fill="#000" opacity=".06"/>`,
  olives: () => jar('#2E7D32', '#5D7A2A', [[26, 38], [36, 36], [31, 44], [24, 48], [39, 47], [31, 30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="3.4" fill="#6E8B2E"/><circle cx="${x + 1}" cy="${y}" r="1" fill="#C62828"/>`).join(''), ''),
  pickles: () => jar('#C62828', '#B9C77A', [[26, 30, -10], [36, 32, 8], [30, 44, -6], [40, 46, 12]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="9" fill="#558B2F" transform="rotate(${r} ${x} ${y})"/>`).join('') + leaf(24, 52, -40, 10, 3, '#33691E'), ''),

  // קפואים
  iceCream: () => `<path d="M20 32L32 60L44 32Z" fill="#E0A85A"/><path d="M22 36L40 38M24 42L38 44M26 48L36 50M42 36L26 50" stroke="#B9782E" stroke-width="1.2"/>` +
    `<circle cx="25" cy="27" r="9" fill="#F8BBD0"/><circle cx="39" cy="27" r="9" fill="#FFF3D6"/><circle cx="32" cy="17" r="9" fill="#8D5A3B"/>` + hl(27, 12, 2.5, 7, 0.5),
  popsicle: () => `<rect x="29" y="40" width="6" height="20" rx="3" fill="#E0B57A"/><path d="M20 18Q20 6 32 6T44 18V42Q44 45 41 45H23Q20 45 20 42Z" fill="#EF5350"/><path d="M20 18Q20 6 32 6T44 18V24H20Z" fill="#FFB74D"/>` + hl(23, 12, 3, 26, 0.45),
  pizza: () => `<path d="M32 58L6 14Q32 2 58 14Z" fill="#F9C846"/><path d="M6 14Q32 2 58 14L56 18Q32 7 8 18Z" fill="#D9963F"/>` +
    [[26, 22], [40, 22], [32, 34], [24, 32], [38, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#C62828"/>`).join('') + `<circle cx="33" cy="24" r="1.6" fill="#33691E"/><circle cx="30" cy="44" r="1.4" fill="#33691E"/>`,
  puffPastry: () => box('#FFB74D', '#E08E2B', `<rect x="16" y="26" width="22" height="22" rx="2" fill="#fff"/>` + mini(PD.croissant(), 27, 37, 20)),
  fries: () => `<g>${[[20, -8], [26, -3], [32, 0], [38, 4], [44, 9], [29, -6], [35, 6]].map(([x, r]) => `<rect x="${x - 2.5}" y="8" width="5" height="30" rx="1" fill="#FFCA28" transform="rotate(${r} ${x} 40)"/>`).join('')}</g>` +
    `<path d="M14 30H50L46 58H18Z" fill="#E53935"/><path d="M14 30Q32 40 50 30" fill="#C62828"/>` + hl(18, 36, 2.5, 18, 0.35),
  ice: () => [[20, 38, -10], [42, 40, 12], [31, 22, 4]].map(([x, y, r]) => `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="#B3E5FC" transform="rotate(${r} ${x} ${y})"/><rect x="${x - 7}" y="${y - 7}" width="6" height="3" rx="1.5" fill="#fff" transform="rotate(${r} ${x} ${y})"/>`).join(''),
  frozenVeg: () => bag('#4FC3F7', `<circle cx="32" cy="38" r="12" fill="#fff"/>` + mini(D.peas(), 30, 36, 14) + mini(D.carrot(), 36, 41, 12), { dark: '#01579B' }),
  greenBeans: () => [[-14], [-4], [6], [16]].map(([r]) => `<path d="M32 58Q28 34 34 8" stroke="#558B2F" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(${r} 32 58)"/>`).join(''),
  malawach: () => `<ellipse cx="32" cy="40" rx="26" ry="12" fill="#D9963F"/><ellipse cx="32" cy="36" rx="26" ry="12" fill="#F0BC6C"/><path d="M14 36Q24 28 34 34T50 32" stroke="#D9963F" stroke-width="2" fill="none"/><path d="M20 40Q30 34 42 40" stroke="#D9963F" stroke-width="1.6" fill="none"/>`,

  // יבשים ובישול
  rice: () => bag('#FAFAFA', `<ellipse cx="32" cy="40" rx="12" ry="9" fill="#E3F2FD"/>` + [[26, 38], [31, 36], [36, 38], [28, 42], [34, 42], [31, 45], [38, 43]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.1" fill="#fff" stroke="#B0BEC5" stroke-width=".5" transform="rotate(${i * 25} ${x} ${y})"/>`).join(''), { dark: '#455A64' }),
  pasta: () => bag('#1565C0', `<rect x="19" y="27" width="26" height="22" rx="4" fill="#fff"/>` + [[24, 35], [32, 33], [40, 35], [28, 42], [36, 42]].map(([x, y]) => `<path d="M${x - 4} ${y}Q${x - 2} ${y - 3} ${x} ${y}T${x + 4} ${y}" stroke="#F2B84B" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('')),
  spaghetti: () => `<g transform="rotate(-30 32 32)">${[24, 27, 30, 33, 36, 39].map((x) => `<rect x="${x}" y="4" width="2" height="56" rx="1" fill="#F2C562"/>`).join('')}<rect x="22" y="26" width="20" height="12" rx="2" fill="#1565C0"/></g>`,
  noodles: () => `<path d="M8 32H56Q56 56 32 56T8 32Z" fill="#E53935"/><path d="M8 32H56" stroke="#B71C1C" stroke-width="2"/>` +
    `<path d="M14 32Q18 22 22 32T30 32T38 32T46 32T52 32" stroke="#F9D56E" stroke-width="3" fill="none"/><path d="M40 8L28 30M48 10L32 30" stroke="#8D6E63" stroke-width="2.4" stroke-linecap="round"/>`,
  flour: () => bag('#FFFFFF', `<circle cx="32" cy="38" r="11" fill="#FFF3D6"/>` + leaf(32, 46, -90, 18, 3, '#D9A441') + leaf(32, 40, -60, 8, 2.6, '#D9A441') + leaf(32, 40, -120, 8, 2.6, '#D9A441') + leaf(32, 34, -60, 7, 2.4, '#D9A441') + leaf(32, 34, -120, 7, 2.4, '#D9A441'), { dark: '#8D6E63' }),
  sugar: () => [[20, 42], [42, 42], [31, 24]].map(([x, y]) => `<path d="M${x - 10} ${y - 4}L${x} ${y - 10}L${x + 10} ${y - 4}L${x} ${y + 2}Z" fill="#fff"/><path d="M${x - 10} ${y - 4}V${y + 8}L${x} ${y + 14}V${y + 2}Z" fill="#E3E6EA"/><path d="M${x} ${y + 2}V${y + 14}L${x + 10} ${y + 8}V${y - 4}Z" fill="#C9CED6"/>`).join(''),
  salt: () => `<path d="M20 26Q20 18 32 18T44 26V56Q44 60 40 60H24Q20 60 20 56Z" fill="#E3F2FD"/><path d="M20 22Q20 10 32 10T44 22Z" fill="#90A4AE"/>` +
    `<circle cx="28" cy="15" r="1.2" fill="#37474F"/><circle cx="32" cy="13" r="1.2" fill="#37474F"/><circle cx="36" cy="15" r="1.2" fill="#37474F"/>` + `<rect x="20" y="36" width="24" height="14" fill="#1E88E5"/>` + hl(23, 26, 2.5, 28, 0.6),
  spice: (c = '#D84315') => `<rect x="20" y="20" width="24" height="40" rx="4" fill="${c}"/><rect x="20" y="20" width="24" height="40" rx="4" fill="#fff" opacity=".18"/><rect x="21" y="10" width="22" height="11" rx="2" fill="#37474F"/>` +
    `<rect x="20" y="32" width="24" height="16" fill="#FFF8E7"/><circle cx="32" cy="40" r="4.5" fill="${c}"/>` + hl(23, 24, 2.5, 30, 0.45),
  oliveOil: () => bottle('#9E9D24', '#33691E', '#FFF8E1', mini(`<ellipse cx="32" cy="34" rx="12" ry="16" fill="#6E8B2E"/>` + leaf(32, 18, -60, 22, 6, LEAFD), 32, 41, 12), { neck: 'thin' }),
  oil: () => bottle('#FBC02D', '#F57F17', '#fff', mini(drop('#FBC02D'), 32, 41, 12)),
  vinegar: () => bottle('#EAF3F6', '#C62828', '#FFF3E0', `<text x="32" y="45" text-anchor="middle" font-size="9" font-weight="700" fill="#C62828" font-family="Arial">5%</text>`, { neck: 'thin' }),
  legumes: (c = '#E06C3B') => `<path d="M10 28Q10 22 16 22H48Q54 22 54 28L52 54Q52 58 48 58H16Q12 58 12 54Z" fill="#D7B98A"/><ellipse cx="32" cy="24" rx="22" ry="6" fill="${c}"/>` +
    [[22, 23], [30, 21], [38, 23], [44, 25], [26, 26], [34, 26]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.8" fill="#000" opacity=".15"/>`).join('') + `<path d="M12 34H52" stroke="#A88A5C" stroke-width="1.6"/>`,
  smallPack: (c = '#E53935') => `<rect x="14" y="16" width="36" height="40" rx="3" fill="${c}"/><path d="M14 16L18 12H46L50 16Z" fill="${c}" opacity=".7"/><rect x="20" y="26" width="24" height="20" rx="2" fill="#fff"/><circle cx="32" cy="36" r="5" fill="${c}" opacity=".5"/>`,
  darkChoco: () => PD.chocolate('#3E2416', '#1E88E5'),
  chocolate: (c = '#6B3A1E', wrap = '#C62828') => `<g transform="rotate(-20 32 32)"><rect x="10" y="12" width="36" height="44" rx="2" fill="${c}"/>` +
    [[12, 14], [24, 14], [12, 26], [24, 26]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="10" rx="1" fill="#fff" opacity=".12"/>`).join('') +
    `<rect x="8" y="36" width="40" height="22" rx="2" fill="${wrap}"/><rect x="8" y="36" width="40" height="3" fill="#fff" opacity=".3"/></g>`,
  nuts: () => [[20, 40], [32, 30], [44, 40], [26, 50], [38, 50]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="6" fill="${i % 2 ? '#B9783F' : '#C98A4B'}" transform="rotate(${i * 30} ${x} ${y})"/><path d="M${x - 4} ${y}Q${x} ${y - 3} ${x + 4} ${y}" stroke="#7A4A1F" stroke-width="1" fill="none"/>`).join(''),
  raisins: () => [[22, 34], [32, 30], [42, 34], [26, 44], [38, 44], [32, 38], [32, 50]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4.5" fill="#4A2340"/><path d="M${x - 3} ${y - 1}Q${x} ${y + 1} ${x + 3} ${y - 1}" stroke="#7B3F6E" stroke-width="1" fill="none"/>`).join(''),
  soup: () => `<path d="M14 18Q20 12 24 18T34 18" stroke="#B0BEC5" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 30H58" stroke="#455A64" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M10 30H54V48Q54 58 44 58H20Q10 58 10 48Z" fill="#E53935"/><ellipse cx="32" cy="30" rx="22" ry="4" fill="#F9C846"/><circle cx="26" cy="30" r="1.6" fill="#F57C00"/><circle cx="36" cy="29" r="1.6" fill="#43A047"/>` + hl(14, 34, 2.5, 18, 0.35),
  honey: () => jar('#F9A825', '#F6B024', `<path d="M24 39L28 36L32 39V44L28 47L24 44Z M32 39L36 36L40 39V44L36 47L32 44Z" fill="#F9C846" stroke="#E08E00" stroke-width="1"/>`, '#FFF8E1'),
  jam: () => jar('#C62828', '#B71C1C', fruitMini('strawberry', 32, 39, 16), '#FFF8E1'),
  peanutButter: () => jar('#C62828', '#B57A3B', mini(PD.nuts(), 32, 39, 16), '#FFF8E1'),
  chocoSpread: () => jar('#FFFFFF', '#4E2C1A', `<text x="32" y="43" text-anchor="middle" font-size="10" font-weight="800" fill="#C62828" font-family="Arial">choco</text>`, '#FFFFFF'),
  tahini: () => jar('#5D4037', '#E3C99A', `<rect x="22" y="33" width="20" height="12" rx="2" fill="#E3C99A"/>`, '#FFF8E1'),

  // שימורים ורטבים
  tuna: () => can('#B0BEC5', '#1E88E5', mini(PD.fish(), 32, 39.5, 14), { flat: true }),
  cannedCorn: () => can('#B0BEC5', '#2E7D32', mini(D.corn(), 32, 35, 18)),
  tomatoPaste: () => can('#B0BEC5', '#C62828', mini(D.tomato(), 32, 39.5, 14), { flat: true }),
  tomatoSauce: () => jar('#2E7D32', '#C62828', mini(D.tomato(), 32, 39, 14), '#FFF8E1'),
  canned: () => can('#B0BEC5', '#F9A825', mini(D.peas(), 32, 35, 16)),
  cannedMushrooms: () => can('#B0BEC5', '#5D4037', mini(D.mushroom(), 32, 35, 16)),
  ketchup: () => squeeze('#D32F2F', '#2E7D32', `<rect x="23" y="32" width="18" height="16" rx="2" fill="#fff"/>` + mini(D.tomato(), 32, 40, 12)),
  mayo: () => squeeze('#FFF8E1', '#1565C0', `<rect x="23" y="32" width="18" height="16" rx="2" fill="#1565C0"/>` + mini(PD.egg(), 32, 40, 12)),
  mustard: () => squeeze('#FBC02D', '#C62828', `<rect x="23" y="32" width="18" height="16" rx="2" fill="#fff"/>`),
  soySauce: () => bottle('#3E2723', '#C62828', '#fff', `<circle cx="32" cy="41" r="4" fill="#C62828"/>`, { neck: 'thin' }),

  // ארוחת בוקר
  cereal: () => box('#F9A825', '#E08E00', `<path d="M17 38H37Q37 50 27 50T17 38Z" fill="#fff"/>` + [[21, 36], [26, 34], [31, 36], [24, 39], [29, 39]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2" fill="#F2B84B"/>`).join('') + `<rect x="16" y="20" width="22" height="7" rx="2" fill="#C62828"/>`),
  oats: () => `<rect x="16" y="14" width="32" height="46" rx="4" fill="#C62828"/><ellipse cx="32" cy="14" rx="16" ry="4" fill="#8D2020"/><rect x="16" y="28" width="32" height="20" fill="#FFF8E1"/>` +
    [[26, 36], [32, 34], [38, 37], [29, 41], [35, 41]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.8" fill="#D9B77A"/>`).join('') + hl(19, 18, 2.5, 38, 0.3),
  coffee: () => cup('#6D4C41', '#3E2723', true),
  tea: () => cup('#FFFFFF', '#C77B30', true) + `<path d="M40 22L44 38" stroke="#90A4AE" stroke-width="1"/><rect x="41" y="37" width="7" height="8" rx="1" fill="#43A047"/>`,
  cocoa: () => `<rect x="16" y="14" width="32" height="46" rx="4" fill="#6D4C41"/><ellipse cx="32" cy="14" rx="16" ry="4" fill="#3E2723"/><rect x="16" y="28" width="32" height="20" fill="#FFF8E1"/>` + mini(cup('#8D6E63', '#4E342E'), 32, 38, 18),

  // חטיפים ומתוקים
  bamba: () => bag('#FFB300', `<ellipse cx="32" cy="38" rx="13" ry="10" fill="#fff"/>` + [[26, 37, 20], [33, 34, -20], [38, 40, 30], [29, 42, -10]].map(([x, y, r]) => `<rect x="${x - 5}" y="${y - 2}" width="10" height="4" rx="2" fill="#F2B84B" transform="rotate(${r} ${x} ${y})"/>`).join(''), { dark: '#BF360C' }),
  bissli: () => bag('#E53935', `<ellipse cx="32" cy="38" rx="13" ry="10" fill="#FFD54F"/>` + [[26, 37], [32, 34], [38, 39], [30, 42]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1" fill="#C77B30" transform="rotate(45 ${x} ${y})"/>`).join('')),
  snacks: () => bag('#7E57C2', `<ellipse cx="32" cy="38" rx="13" ry="10" fill="#FFD54F"/><ellipse cx="32" cy="38" rx="7" ry="5" fill="#F2B84B"/>`),
  chips: () => bag('#FDD835', `<ellipse cx="32" cy="38" rx="13" ry="10" fill="#C62828"/>` + [[27, 37], [36, 39], [31, 42]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.5" fill="#FFE082"/>`).join(''), { dark: '#F57F17' }),
  candy: () => [[22, 36, '#E91E63', -20], [42, 30, '#29B6F6', 25], [34, 48, '#FDD835', 0]].map(([x, y, c, r]) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 9} ${y}L${x - 16} ${y - 6}V${y + 6}Z M${x + 9} ${y}L${x + 16} ${y - 6}V${y + 6}Z" fill="${c}" opacity=".8"/><circle cx="${x}" cy="${y}" r="8.5" fill="${c}"/><path d="M${x - 5} ${y - 3}Q${x} ${y - 6} ${x + 4} ${y - 3}" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/></g>`).join(''),
  gum: () => `<rect x="10" y="18" width="44" height="28" rx="4" fill="#26C6DA"/><rect x="10" y="38" width="44" height="8" rx="3" fill="#00838F"/><rect x="16" y="24" width="12" height="10" rx="2" fill="#fff"/><rect x="36" y="24" width="12" height="10" rx="2" fill="#fff"/>`,
  popcorn: () => [[22, 22], [32, 16], [42, 22], [27, 14], [37, 12], [18, 30], [46, 30], [32, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="#FFF8E1"/><circle cx="${x + 2}" cy="${y + 2}" r="3" fill="#FFE082"/>`).join('') +
    `<path d="M12 28H52L46 60H18Z" fill="#fff"/>${[18, 28, 38].map((x) => `<path d="M${x - 2} 28H${x + 4}L${x + 3.5} 60H${x}Z" fill="#E53935"/>`).join('')}<path d="M44 28H52L46 60H44Z" fill="#E53935" opacity=".6"/>`,
  pretzel: () => `<path d="M32 50C20 40 10 34 12 24C14 14 26 14 32 26C38 14 50 14 52 24C54 34 44 40 32 50ZM22 52L32 36L42 52" stroke="#A0522D" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` +
    [[16, 24], [26, 20], [40, 20], [48, 28], [28, 44], [38, 42]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="1.4" fill="#fff"/>`).join(''),
  wafers: () => [44, 34, 24].map((y) => `<rect x="10" y="${y}" width="44" height="9" rx="1.5" fill="#E8B56A"/><path d="M14 ${y + 2}V${y + 7}M20 ${y + 2}V${y + 7}M26 ${y + 2}V${y + 7}M32 ${y + 2}V${y + 7}M38 ${y + 2}V${y + 7}M44 ${y + 2}V${y + 7}M50 ${y + 2}V${y + 7}" stroke="#C78A3A" stroke-width="1"/><rect x="10" y="${y + 8}" width="44" height="2" fill="#6D3A1E"/>`).join(''),
  crackers: () => [[22, 40, -10], [40, 30, 8]].map(([x, y, r]) => `<rect x="${x - 14}" y="${y - 12}" width="28" height="24" rx="3" fill="#E3B064" transform="rotate(${r} ${x} ${y})"/>` + [[-7, -5], [0, -5], [7, -5], [-7, 3], [0, 3], [7, 3]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="1.1" fill="#A8742E" transform="rotate(${r} ${x} ${y})"/>`).join('')).join(''),
  riceCakes: () => [46, 38, 30].map((y) => `<ellipse cx="32" cy="${y}" rx="22" ry="8" fill="#F2DDB0"/><ellipse cx="32" cy="${y - 1.5}" rx="20" ry="6.5" fill="#FAEBCB"/>`).join('') + [[24, 27], [32, 26], [40, 28], [28, 31], [36, 31]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="1" fill="#E0C48C"/>`).join(''),
  seeds: () => [[20, 36, -30], [32, 28, 0], [44, 36, 30], [26, 48, -15], [38, 48, 15]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x} ${y - 12}Q${x + 8} ${y} ${x} ${y + 11}Q${x - 8} ${y} ${x} ${y - 12}Z" fill="#37474F"/><path d="M${x - 1.5} ${y - 7}V${y + 6}M${x + 1.5} ${y - 7}V${y + 6}" stroke="#ECEFF1" stroke-width=".9"/></g>`).join(''),

  // משקאות
  water: () => bottle('#BBDEFB', '#1565C0', '#1E88E5', mini(drop('#fff'), 32, 41, 12)),
  water6: () => [14, 50, 32].map((x, i) => `<g transform="translate(${x - 32 + (i === 2 ? 0 : 0)} ${i === 2 ? 4 : -2}) scale(${i === 2 ? 1 : 0.85}) translate(${i === 2 ? 0 : 5.6} ${i === 2 ? 0 : 4})">${bottle('#BBDEFB', '#1565C0', '#1E88E5', mini(drop('#fff'), 32, 41, 12))}</g>`).join(''),
  soda: () => bottle('#E3F2FD', '#43A047', '#43A047', [[28, 26], [34, 22], [31, 54], [36, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('')),
  cola: () => bottle('#3E2723', '#C62828', '#C62828', `<path d="M24 41Q32 37 40 43" stroke="#fff" stroke-width="2" fill="none"/>`),
  lemonSoda: () => bottle('#C5E1A5', '#2E7D32', '#2E7D32', mini(D.lemon(), 32, 41, 12)),
  juice: () => carton('#F57C00', '#FB8C00', mini(D.orange(), 27, 41, 16)),
  raspberry: () => bottle('#C2185B', '#880E4F', '#FCE4EC', mini(D.strawberry(), 32, 41, 12), { neck: 'thin' }),
  beer: () => bottle('#8D5A1E', '#F9A825', '#FFF8E1', `<circle cx="32" cy="41" r="4.6" fill="#F9A825"/>`, { neck: 'thin' }),
  wine: () => `<path d="M24 28C24 22 28 20 28 14V4H36V14C36 20 40 22 40 28V58Q40 61 37 61H27Q24 61 24 58Z" fill="#4A0E1E"/><rect x="27.5" y="3" width="9" height="7" fill="#7B1F2E"/><rect x="24" y="36" width="16" height="14" fill="#F5EBDC"/><circle cx="32" cy="43" r="3" fill="#7B1F2E"/>` + hl(26.5, 26, 2.5, 30, 0.35),
  softDrinks: () => `<g transform="translate(-10 2) scale(.82) translate(6 4)">${PD.cola()}</g><g transform="translate(14 2) scale(.82) translate(6 4)">${PD.juiceBottle()}</g>`,
  juiceBottle: () => bottle('#FB8C00', '#2E7D32', '#fff', mini(D.orange(), 32, 41, 12)),
  icedCoffee: () => `<path d="M16 18H48L44 58H20Z" fill="#E3F2FD" opacity=".9"/><path d="M17.5 26H46.5L44 58H20Z" fill="#A1887F"/><rect x="22" y="30" width="8" height="8" rx="1.5" fill="#fff" opacity=".7"/><rect x="33" y="36" width="8" height="8" rx="1.5" fill="#fff" opacity=".7"/>` +
    `<path d="M36 26L42 4" stroke="#E53935" stroke-width="3" stroke-linecap="round"/><rect x="14" y="15" width="36" height="5" rx="2" fill="#fff" stroke="#CFD8DC"/>`,

  // ניקיון
  bleach: () => jug('#FFFFFF', '#1E88E5', `<rect x="18" y="34" width="28" height="16" rx="2" fill="#1E88E5"/><path d="M28 38L32 46L36 38" stroke="#fff" stroke-width="2" fill="none"/>`),
  dishSoap: () => squeeze('#66BB6A', '#2E7D32', `<rect x="23" y="32" width="18" height="16" rx="2" fill="#fff"/>` + mini(D.lemon(P.lime), 32, 40, 12)),
  dishTabs: () => box('#1565C0', '#0D47A1', [[22, 30], [32, 30], [22, 42], [32, 42]].map(([x, y]) => `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" fill="#fff"/><rect x="${x - 4.5}" y="${y}" width="9" height="4.5" fill="#42A5F5"/>`).join('')),
  laundry: () => jug('#1E88E5', '#FFFFFF', `<rect x="18" y="34" width="28" height="16" rx="2" fill="#fff"/><path d="M24 44Q28 38 32 44T40 44" stroke="#1E88E5" stroke-width="2" fill="none"/>`),
  softener: () => jug('#EC407A', '#FFFFFF', `<rect x="18" y="34" width="28" height="16" rx="2" fill="#fff"/><circle cx="29" cy="42" r="3" fill="#F8BBD0"/><circle cx="35" cy="42" r="3" fill="#F8BBD0"/><circle cx="32" cy="38" r="3" fill="#F8BBD0"/>`),
  sponge: () => `<path d="M8 34L34 22L56 30L30 42Z" fill="#43A047"/><path d="M8 34V44L30 54V42Z" fill="#FDD835"/><path d="M30 42V54L56 42V30Z" fill="#F9A825"/><path d="M8 34V37L30 46V42Z" fill="#2E7D32"/><path d="M30 42V46L56 34V30Z" fill="#1B5E20"/>` +
    [[14, 44], [20, 48], [36, 48], [44, 44], [50, 40], [24, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#E08E00"/>`).join(''),
  wipes: () => `<path d="M8 28Q8 20 16 20H48Q56 20 56 28V48Q56 56 48 56H16Q8 56 8 48Z" fill="#81D4FA"/><rect x="20" y="24" width="24" height="12" rx="6" fill="#0288D1"/><path d="M26 30Q32 18 40 22Q36 26 38 30Z" fill="#fff"/>` + hl(11, 30, 2.5, 20, 0.4),
  trashBags: () => `<path d="M20 22Q14 32 14 44Q14 58 32 58T50 44Q50 32 44 22Z" fill="#37474F"/><path d="M24 22L20 10L28 16L32 8L36 16L44 10L40 22Z" fill="#455A64"/><rect x="24" y="19" width="16" height="4" rx="2" fill="#FDD835"/>` + hl(20, 30, 3, 18, 0.25),
  spray: () => spray('#4FC3F7', '#1565C0'),
  cloth: () => `<path d="M8 22L40 14L56 30L24 40Z" fill="#FFCA28"/><path d="M8 22L24 40V50L8 32Z" fill="#F9A825"/><path d="M24 40L56 30V40L24 50Z" fill="#FFB300"/><path d="M14 22L46 15M18 27L50 20" stroke="#fff" stroke-width="1" opacity=".5"/>`,

  // פארם והיגיינה
  toiletPaper: () => roll(3),
  paperTowel: () => `<path d="M18 8V56A14 4.6 0 0 0 46 56V8Z" fill="#fff" stroke="#B8C2CA"/><path d="M38 9V60A14 4.6 0 0 0 46 56V8Z" fill="#90A4AE" opacity=".25"/>` +
    `<ellipse cx="32" cy="8" rx="14" ry="4.6" fill="#F4F6F7" stroke="#B8C2CA"/><ellipse cx="32" cy="8" rx="4" ry="1.6" fill="#B0906A"/><path d="M18 22Q32 26 46 22M18 38Q32 42 46 38" stroke="#4FC3F7" stroke-width="1.4" stroke-dasharray="2 2" fill="none"/>`,
  tissues: () => box('#4DB6AC', '#26A69A', `<ellipse cx="27" cy="16" rx="8" ry="2.4" fill="#00796B"/>`) + `<path d="M22 16Q24 4 30 6Q28 10 34 8Q32 14 32 16Z" fill="#fff"/>`,
  shampoo: () => pump('#7E57C2', '#4527A0', '#fff'),
  conditioner: () => pump('#EC407A', '#AD1457', '#fff'),
  showerGel: () => squeeze('#29B6F6', '#0277BD', `<rect x="23" y="32" width="18" height="16" rx="2" fill="#fff"/><circle cx="30" cy="40" r="2.6" fill="#B3E5FC"/><circle cx="34.5" cy="37.5" r="2" fill="#B3E5FC"/><circle cx="35" cy="43" r="1.6" fill="#B3E5FC"/>`),
  soap: () => `<rect x="8" y="26" width="48" height="26" rx="12" fill="#F48FB1"/><rect x="8" y="22" width="48" height="24" rx="12" fill="#F8BBD0"/><ellipse cx="24" cy="30" rx="8" ry="2.6" fill="#fff" opacity=".7"/>` +
    [[46, 16, 5], [52, 9, 3.4], [40, 10, 2.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E1F5FE" stroke="#81D4FA" stroke-width="1"/>`).join(''),
  toothpaste: () => `<g transform="rotate(-30 32 32)"><path d="M12 22H44L52 28V36L44 42H12Z" fill="#fff"/><path d="M12 22H24V42H12Z" fill="#1E88E5"/><path d="M28 26H42M28 32H44M28 38H42" stroke="#E53935" stroke-width="2"/><rect x="52" y="28" width="6" height="8" rx="1.5" fill="#1E88E5"/><path d="M10 20V44" stroke="#90A4AE" stroke-width="3"/></g>`,
  toothbrush: () => `<g transform="rotate(-40 32 32)"><rect x="2" y="29" width="46" height="7" rx="3.5" fill="#29B6F6"/><rect x="44" y="30" width="16" height="5" rx="2" fill="#81D4FA"/>${[46, 49, 52, 55, 58].map((x) => `<rect x="${x - 1}" y="19" width="2.4" height="11" rx="1" fill="${x % 2 ? '#fff' : '#E1F5FE'}" stroke="#B0BEC5" stroke-width=".5"/>`).join('')}</g>`,
  deodorant: () => `<rect x="20" y="20" width="24" height="40" rx="5" fill="#26A69A"/><rect x="21" y="8" width="22" height="13" rx="4" fill="#B2DFDB"/><rect x="23" y="34" width="18" height="14" rx="2" fill="#fff"/>` + hl(22.5, 24, 2.5, 30, 0.4),
  razor: () => `<g transform="rotate(-35 32 32)"><rect x="28" y="22" width="8" height="40" rx="4" fill="#1E88E5"/><rect x="18" y="8" width="28" height="14" rx="3" fill="#90A4AE"/><path d="M20 12H44M20 17H44" stroke="#ECEFF1" stroke-width="1.6"/></g>`,
  lotion: () => `<path d="M14 40Q14 26 26 26H38Q50 26 50 40V56H14Z" fill="#FFF3E0"/><rect x="12" y="50" width="40" height="10" rx="3" fill="#FFB74D"/><rect x="18" y="36" width="28" height="10" rx="2" fill="#FFB74D"/>` + hl(17, 34, 2.5, 14, 0.6),
  pads: () => `<g transform="rotate(-20 32 32)"><path d="M14 32Q14 18 24 18Q32 22 40 18Q50 18 50 32Q50 46 40 46Q32 42 24 46Q14 46 14 32Z" fill="#fff" stroke="#F8BBD0" stroke-width="2"/><ellipse cx="32" cy="32" rx="12" ry="6" fill="#F8BBD0" opacity=".6"/></g>`,
  bandaid: () => [[-30, '#F2C39A'], [30, '#E8B08A']].map(([r, c]) => `<g transform="rotate(${r} 32 32)"><rect x="8" y="24" width="48" height="16" rx="8" fill="${c}"/><rect x="24" y="25" width="16" height="14" rx="2" fill="#F8E6D6"/>${[[13, 30], [17, 34], [47, 30], [51, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#C68C64"/>`).join('')}</g>`).join(''),
  pills: () => `<rect x="10" y="14" width="44" height="36" rx="5" fill="#ECEFF1"/>` + [[20, 24], [32, 24], [44, 24], [20, 40], [32, 40], [44, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#B0BEC5"/><path d="M${x - 3} ${y}H${x + 3}" stroke="#CFD8DC" stroke-width="1"/>`).join('') +
    `<g transform="rotate(-30 46 52)"><rect x="34" y="47" width="24" height="10" rx="5" fill="#E53935"/><rect x="46" y="47" width="12" height="10" rx="5" fill="#fff"/><rect x="46" y="47" width="4" height="10" fill="#fff"/></g>`,
  vitamins: () => `<rect x="18" y="20" width="28" height="40" rx="5" fill="#FB8C00"/><rect x="20" y="10" width="24" height="11" rx="2" fill="#fff"/><rect x="18" y="32" width="28" height="16" fill="#fff"/><text x="32" y="44" text-anchor="middle" font-size="11" font-weight="800" fill="#FB8C00" font-family="Arial">C</text>` + hl(21, 24, 2.5, 30, 0.35),
  cotton: () => [[22, 30], [40, 30], [31, 42], [18, 44], [44, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#E0E0E0"/>`).join(''),
  cottonSwabs: () => [-20, -6, 8, 22].map((r) => `<g transform="rotate(${r} 32 34)"><rect x="31" y="10" width="2.2" height="44" fill="#90CAF9"/><ellipse cx="32" cy="10" rx="3.4" ry="5" fill="#fff" stroke="#E0E0E0"/><ellipse cx="32" cy="54" rx="3.4" ry="5" fill="#fff" stroke="#E0E0E0"/></g>`).join(''),

  // תינוקות
  diapers: () => `<path d="M8 18H56V30Q56 44 44 50Q38 54 32 54T20 50Q8 44 8 30Z" fill="#fff" stroke="#B3E5FC" stroke-width="2"/><path d="M8 18H56V26H8Z" fill="#81D4FA"/><rect x="6" y="22" width="8" height="8" rx="2" fill="#FDD835"/><rect x="50" y="22" width="8" height="8" rx="2" fill="#FDD835"/>` +
    `<circle cx="26" cy="38" r="2" fill="#F8BBD0"/><circle cx="38" cy="38" r="2" fill="#F8BBD0"/><circle cx="32" cy="44" r="2" fill="#B3E5FC"/>`,
  formula: () => can('#ECEFF1', '#81D4FA', mini(PD.babyBottle(), 32, 35, 20)),
  pacifier: () => `<ellipse cx="32" cy="40" rx="20" ry="11" fill="#F48FB1"/><circle cx="32" cy="40" r="6" fill="#EC407A"/><path d="M32 29Q26 18 32 10Q38 18 32 29Z" fill="#FFE0B2"/><path d="M24 44Q32 62 40 44" stroke="#F48FB1" stroke-width="4" fill="none"/>`,
  babyBottle: () => `<path d="M28 10Q32 2 36 10L38 16H26Z" fill="#FFE0B2"/><rect x="22" y="16" width="20" height="6" rx="2" fill="#4FC3F7"/><rect x="21" y="22" width="22" height="36" rx="7" fill="#E3F2FD"/><rect x="21" y="34" width="22" height="24" rx="7" fill="#fff"/>` +
    `<path d="M26 30H30M26 38H30M26 46H30" stroke="#90A4AE" stroke-width="1.4"/>` + hl(23.5, 26, 2.5, 26, 0.6),
  babyCereal: () => `<path d="M8 32H56Q56 56 32 56T8 32Z" fill="#81D4FA"/><ellipse cx="32" cy="32" rx="24" ry="6" fill="#FFE9B8"/><path d="M40 30L52 10" stroke="#F06292" stroke-width="4" stroke-linecap="round"/>`,

  // בית וחד"פ
  plates: () => [44, 38, 32].map((y) => `<ellipse cx="32" cy="${y}" rx="26" ry="9" fill="#ECEFF1"/><ellipse cx="32" cy="${y - 1}" rx="26" ry="9" fill="#fff" stroke="#CFD8DC"/>`).join('') + `<ellipse cx="32" cy="31" rx="15" ry="5" fill="#F5F7F8" stroke="#E0E0E0"/>`,
  cups: () => [0, 6, 12].map((d) => `<path d="M18 ${10 + d}H46L42 ${56}H22Z" fill="#fff" stroke="#CFD8DC"/>`).join('') + `<path d="M18 22H46" stroke="#E53935" stroke-width="2"/>`,
  cutlery: () => `<g transform="rotate(-12 22 32)"><rect x="20.5" y="26" width="4" height="32" rx="2" fill="#90A4AE"/><path d="M16 6V20Q16 28 22.5 28T29 20V6" stroke="#90A4AE" stroke-width="2.6" fill="none"/><path d="M22.5 6V22" stroke="#90A4AE" stroke-width="2.4"/></g>` +
    `<g transform="rotate(12 42 32)"><rect x="39.5" y="30" width="5" height="28" rx="2.5" fill="#90A4AE"/><path d="M40 6Q48 10 46 32H40Z" fill="#B0BEC5"/></g>`,
  napkins: () => `<path d="M10 30L32 20L54 30L32 40Z" fill="#fff"/><path d="M10 30V44L32 54V40Z" fill="#ECEFF1"/><path d="M32 40V54L54 44V30Z" fill="#CFD8DC"/><path d="M10 34L32 44L54 34M10 38L32 48L54 38" stroke="#B0BEC5" stroke-width=".8" fill="none"/>`,
  foil: (c = '#CFD8DC') => `<path d="M6 26L44 14L58 22L20 34Z" fill="#E53935"/><path d="M6 26V44L20 52V34Z" fill="#C62828"/><path d="M20 34V52L58 40V22Z" fill="#E57373"/><path d="M20 34L58 22L58 26L20 38Z" fill="${c}"/><path d="M20 38L4 46L6 50L22 42Z" fill="${c}"/>`,
  bags: () => `<path d="M14 24H50L52 58H12Z" fill="#E3F2FD" stroke="#90CAF9" stroke-width="1.4"/><path d="M22 24Q22 10 32 10T42 24" stroke="#90CAF9" stroke-width="3" fill="none"/>`,
  pans: () => `<path d="M6 28H58L52 50H12Z" fill="#CFD8DC"/><path d="M4 26H60V30H4Z" fill="#B0BEC5"/><path d="M10 34H54M12 40H52M14 46H50" stroke="#ECEFF1" stroke-width="1.2"/>`,
  candles: () => [[22, 22], [32, 16], [42, 22]].map(([x, y]) => `<rect x="${x - 4}" y="${y}" width="8" height="${58 - y}" rx="1.5" fill="#FFF8E1" stroke="#E0E0E0"/><path d="M${x} ${y}V${y - 3}" stroke="#37474F" stroke-width="1.2"/><path d="M${x} ${y - 13}Q${x + 5} ${y - 6} ${x} ${y - 3}Q${x - 5} ${y - 6} ${x} ${y - 13}Z" fill="#FFA000"/><path d="M${x} ${y - 9}Q${x + 2.4} ${y - 5} ${x} ${y - 4}Q${x - 2.4} ${y - 5} ${x} ${y - 9}Z" fill="#FFF59D"/>`).join(''),
  batteries: () => [[24, -10], [40, 10]].map(([x, r]) => `<g transform="rotate(${r} ${x} 34)"><rect x="${x - 7}" y="12" width="14" height="44" rx="3" fill="#37474F"/><rect x="${x - 7}" y="12" width="14" height="16" rx="3" fill="#FB8C00"/><rect x="${x - 3}" y="8" width="6" height="5" rx="1" fill="#B0BEC5"/></g>`).join(''),
  bulb: () => `<path d="M32 6Q48 6 48 22Q48 30 41 37Q38 40 38 44H26Q26 40 23 37Q16 30 16 22Q16 6 32 6Z" fill="#FFEB3B"/><path d="M28 44V30L32 34L36 30V44" stroke="#F57F17" stroke-width="1.6" fill="none"/>` +
    `<rect x="25" y="44" width="14" height="10" rx="2" fill="#90A4AE"/><path d="M25 48H39M25 51H39" stroke="#607D8B" stroke-width="1"/><path d="M28 54H36L34 58H30Z" fill="#455A64"/>` + hl(21, 14, 3, 12, 0.6),
  matches: () => box('#E53935', '#B71C1C', `<rect x="16" y="28" width="22" height="16" rx="2" fill="#FDD835"/>`) + [22, 28, 34].map((x) => `<rect x="${x}" y="4" width="2.4" height="14" fill="#E0B57A"/><ellipse cx="${x + 1.2}" cy="4" rx="2.2" ry="3" fill="#C62828"/>`).join(''),
  lighter: () => `<rect x="20" y="22" width="24" height="38" rx="5" fill="#E53935"/><rect x="22" y="12" width="20" height="11" rx="1.5" fill="#B0BEC5"/><circle cx="36" cy="17" r="3" fill="#607D8B"/><path d="M27 10Q32 0 30 -2" stroke="none"/>` +
    `<path d="M28 11Q24 4 29 -1Q30 5 33 6Q34 9 28 11Z" fill="#FFA000"/>` + hl(23, 26, 2.5, 30, 0.4),
  charcoal: () => bag('#37474F', [[26, 38], [36, 36], [31, 44], [38, 46], [24, 46]].map(([x, y]) => `<path d="M${x - 5} ${y}L${x - 2} ${y - 4}L${x + 4} ${y - 3}L${x + 5} ${y + 2}L${x} ${y + 4}Z" fill="#212121"/>`).join('') + `<path d="M20 26Q24 20 26 24Q30 18 32 24Q36 18 38 24Q42 20 44 26" fill="#FF7043"/>`, { dark: '#000' }),
};

// [ציור, מילים ביחיד, מילים ברבים]. המילה/הצירוף הארוך ביותר שמופיע בשם — מנצח.
export const PRODUCT_ENTRIES = [
  ['chocomilk', ['שוקו'], []], ['soymilk', ['חלב סויה', 'חלב שקדים', 'חלב שיבולת', 'משקה סויה', 'משקה שקדים'], []],
  ['milk', ['חלב', 'חלב 3%', 'חלב 1%'], []], ['cream', ['שמנת', 'שמנת מתוקה', 'שמנת חמוצה', 'שמנת לבישול'], []],
  ['eggs', ['ביצים', 'תבנית ביצים'], []], ['egg', ['ביצה'], []],
  ['yellowCheese', ['גבינה צהובה', 'גבינת עמק', 'עמק', 'גאודה', 'צ\'דר', 'פרמזן', 'גבינה קשה'], []],
  ['whiteCheese', ['גבינה לבנה', 'גבינה', 'גבינת', 'גבינות', 'שמנת לבנה', 'לבנה', 'ממרח גבינה', 'סקי'], []],
  ['cottage', ["קוטג'", 'קוטג'], []], ['yogurt', ['יוגורט', 'יוגורטים', 'יופלה', 'דנונה'], []],
  ['leben', ['אשל', 'לבן אשל', 'גיל 5%', 'לבן 3%'], []], ['pudding', ['מעדן', 'מעדנים', 'מילקי', 'דני', 'פודינג'], []],
  ['butter', ['חמאה', 'מרגרינה'], []], ['feta', ['בולגרית', 'צפתית', 'פטה', 'פטה'], []], ['mozzarella', ['מוצרלה'], []],

  ['bread', ['לחם', 'לחם אחיד', 'כיכר לחם'], []], ['roll', ['לחמניה', 'לחמנייה'], ['לחמניות']], ['pita', ['פיתה', 'טורטיה', 'לאפה'], ['פיתות', 'טורטיות']],
  ['challah', ['חלה'], ['חלות']], ['baguette', ['באגט'], ['באגטים']], ['croissant', ['קרואסון'], ['קרואסונים']], ['cake', ['עוגה', 'עוגת', 'עוגת גבינה', 'עוגת שוקולד'], ['עוגות']],
  ['cookies', ['עוגיה', 'עוגייה'], ['עוגיות', 'ביסקוויטים', 'פתי בר']], ['bourekas', ['בורקס'], []], ['breadcrumbs', ['פירורי לחם', 'פירורים'], []],

  ['chicken', ['עוף', 'הודו', 'כרעיים', 'שוקיים', 'כנפיים', 'פרגית', 'פרגיות', 'חזה עוף', 'עוף שלם', 'כרעיים עוף'], []],
  ['schnitzel', ['שניצל', 'שניצלים', 'נאגטס'], []], ['steak', ['בשר', 'סטייק', 'אנטריקוט', 'צלע', 'צלעות', 'כבד', 'אסאדו', 'פילה', 'צלי'], []],
  ['groundMeat', ['בשר טחון', 'טחון'], []], ['kebab', ['קבב', 'שיפודים', 'שיפוד'], []], ['burger', ['המבורגר', 'המבורגרים'], []],
  ['hotdog', ['נקניקיה', 'נקניקייה', 'נקניקיות'], []], ['fish', ['דג', 'דגים', 'אמנון', 'בקלה', 'מושט', 'דניס', 'לברק', 'פילה דג'], []], ['salmon', ['סלמון'], []],

  ['salami', ['פסטרמה', 'נקניק', 'סלמי', 'קבנוס', 'פסטרמות'], []],
  ['hummus', ['חומוס', 'סלט חומוס', 'כבד קצוץ', 'חציל במיונז', 'באבא גנוש'], []], ['matbucha', ['מטבוחה', 'סחוג', 'סלט פלפלים'], []], ['salad', ['סלט', 'סלטים', 'סלט כרוב', 'טבולה', 'סלט ירקות'], []],
  ['olives', ['זיתים', 'זית'], []], ['pickles', ['חמוצים', 'מלפפון חמוץ', 'מלפפונים חמוצים', 'מלפפון בחומץ'], []],

  ['iceCream', ['גלידה', 'גלידות'], []], ['popsicle', ['שלגון', 'שלגונים', 'ארטיק', 'קרטיב'], []], ['pizza', ['פיצה', 'פיצות'], []],
  ['puffPastry', ['בצק עלים', 'בצק'], []], ['fries', ["צ'יפס", 'ציפס', "צ'יפס קפוא"], []], ['ice', ['קרח', 'קוביות קרח'], []],
  ['frozenVeg', ['ירקות קפואים', 'ירק קפוא', 'קפוא', 'קפואים', 'מיקס ירקות'], []], ['greenBeans', ['שעועית ירוקה', 'שעועית ירוקה קפואה'], []],
  ['malawach', ['מלוואח', "ג'חנון", 'גחנון'], []],

  ['rice', ['אורז'], []], ['pasta', ['פסטה', 'פתיתים', 'מקרוני', 'פוזילי', 'פנה'], []], ['spaghetti', ['ספגטי'], []], ['noodles', ['אטריות', 'נודלס'], []],
  ['flour', ['קמח', 'קוסקוס', 'בורגול', 'קינואה', 'קורנפלור', 'סולת'], []], ['sugar', ['סוכר', 'סוכר חום', 'סוכרזית', 'ממתיק'], []], ['salt', ['מלח'], []],
  ['spiceBlack', ['פלפל שחור', 'פלפל לבן', 'פלפל אנגלי'], []], ['spiceRed', ['פפריקה', "צ'ילי גרוס", 'פלפל גרוס'], []], ['spiceYellow', ['כורכום', 'קארי'], []], ['spice', ['כמון', 'תבלינים', 'תבלין', 'בהרט', 'זעתר', 'קינמון', 'אורגנו', 'הל', 'ציפורן', 'אבקת שום'], []],
  ['oliveOil', ['שמן זית'], []], ['oil', ['שמן', 'שמן קנולה', 'שמן חמניות', 'שמן תירס'], []], ['vinegar', ['חומץ'], []],
  ['legumesLentil', ['עדשים', 'עדשים כתומות', 'עדשים ירוקות'], []], ['legumesBean', ['שעועית', 'שעועית לבנה', 'שעועית אדומה'], []], ['legumesChick', ['חומוס יבש', 'גרגירי חומוס', 'אפונה יבשה'], []],
  ['smallPack', ['שמרים', 'אבקת אפייה', 'סודה לשתיה', 'סודה לשתייה', 'וניל', 'סוכר וניל', 'ג\'לטין', 'אינסטנט'], []],
  ['darkChoco', ['שוקולד מריר'], []], ['nuts', ['אגוזים', 'שקדים', 'בוטנים', 'קשיו', 'פיסטוק', 'אגוזי מלך', 'פקאן'], []], ['raisins', ['צימוקים', 'פירות יבשים', 'חמוציות'], []],
  ['soup', ['מרק', 'אבקת מרק', 'מרק עוף', 'שקדי מרק'], []], ['honey', ['דבש', 'סילאן'], []],

  ['tuna', ['טונה'], []], ['cannedCorn', ['תירס בקופסה', 'תירס שימורים', 'תירס מתוק'], []], ['tomatoPaste', ['רסק', 'רסק עגבניות'], []],
  ['tomatoSauce', ['רוטב', 'רוטב עגבניות', 'רוטב פסטה', 'רוטב פיצה'], []], ['canned', ['שימורים', 'קופסת שימורים', 'אפונה וגזר', 'זיתים בקופסה'], []],
  ['cannedMushrooms', ['פטריות בקופסה', 'פטריות שימורים', 'פטריות משומרות'], []],
  ['ketchup', ['קטשופ'], []], ['mayo', ['מיונז'], []], ['mustard', ['חרדל'], []], ['soySauce', ['סויה', 'רוטב סויה', 'טריאקי'], []],
  ['peanutButter', ['חמאת בוטנים'], []], ['jam', ['ריבה', 'קונפיטורה', 'ריבת'], []], ['chocoSpread', ['נוטלה', 'ממרח שוקולד', 'ממרח'], []], ['tahini', ['טחינה', 'טחינה גולמית'], []],

  ['cereal', ['קורנפלקס', 'דגני בוקר', 'דגנים', 'כריות', 'קוקומן', 'צ\'יריוס'], []], ['oats', ['שיבולת שועל', 'קוואקר', 'גרנולה'], []],
  ['coffee', ['קפה', 'נס קפה', 'קפה שחור', 'קפסולות', 'קפה טורקי'], []], ['tea', ['תה', 'שקיות תה', 'ויסוצקי'], []], ['cocoa', ['קקאו', 'אבקת שוקו'], []],

  ['bamba', ['במבה'], []], ['bissli', ['ביסלי'], []], ['snacks', ['חטיפים', 'חטיף', 'אפרופו', 'דוריטוס', 'תפוציפס', 'צ\'יטוס'], []],
  ['chocolate', ['שוקולד', 'שוקולדים', 'קליק', 'פסק זמן', 'כיף כף'], []], ['candy', ['סוכריות', 'סוכריה', 'ממתקים', 'גומי'], []], ['gum', ['מסטיק', 'מסטיקים'], []],
  ['chips', ["צ'יפס שקית", 'תפוצ\'יפס', 'פרינגלס'], []], ['popcorn', ['פופקורן'], []], ['pretzel', ['בייגלה', 'בייגלך', 'מיני בייגלה'], []],
  ['wafers', ['וופלים', 'ופלים', 'וופל'], []], ['crackers', ['קרקרים', 'קרקר', 'מצות', 'מצה'], []], ['riceCakes', ['פריכיות', 'פריכית'], []], ['seeds', ['גרעינים'], []],

  ['water', ['מים', 'מים מינרלים', 'בקבוק מים'], []], ['water6', ['שישיית מים', 'שישיה מים', 'שישית מים'], []], ['soda', ['סודה', 'מים מוגזים'], []],
  ['cola', ['קולה', 'קוקה קולה', 'פפסי', 'קולה זירו'], []], ['lemonSoda', ['ספרייט', 'סבן אפ', 'ספרייט זירו'], []], ['juice', ['מיץ', 'פריגת', 'ספרינג', 'פרי מיקס', 'מיץ תפוזים', 'תפוזים סחוט', 'מיצים'], []],
  ['raspberry', ['פטל', 'תרכיז', 'סירופ'], []], ['beer', ['בירה', 'בירות', 'גולדסטאר', 'מכבי'], []], ['wine', ['יין', 'יין אדום', 'יין לבן', 'יין לקידוש', 'מיץ ענבים'], []],
  ['softDrinks', ['שתיה', 'שתייה', 'משקה', 'משקאות', 'שתיה קלה'], []], ['icedCoffee', ['אייס קפה', 'אייס', 'קפה קר'], []],

  ['bleach', ['אקונומיקה'], []], ['dishSoap', ['נוזל כלים', 'סבון כלים', 'פיירי'], []], ['dishTabs', ['טבליות למדיח', 'מדיח', 'טבליות', 'פיניש'], []],
  ['laundry', ['אבקת כביסה', "ג'ל כביסה", 'כביסה', 'ג׳ל כביסה', 'אריאל', 'סנו'], []], ['softener', ['מרכך כביסה', 'מרכך', 'בדין'], []],
  ['sponge', ['ספוג', 'ספוגים', 'סקוטש', 'ספוג ברזל'], []], ['wipes', ['מגבונים', 'מגבונים לחים', 'מגבונים לתינוק'], []],
  ['trashBags', ['שקיות זבל', 'שקיות אשפה', 'שקית זבל', 'שקיות לפח'], []], ['spray', ['מנקה', 'ניקוי', 'וינדקס', 'מסיר שומנים', 'מסיר אבנית', 'תרסיס', 'ספריי', 'אנטי קלק'], []],
  ['cloth', ['מטליות', 'מטלית', 'סמרטוט', 'סחבה', 'סחבות', 'מגב'], []],

  ['toiletPaper', ['נייר טואלט', 'נייר טואלט', 'טואלט'], []], ['paperTowel', ['מגבות נייר', 'מגבת נייר', 'נייר מגבת', 'ניר מגבת'], []], ['tissues', ['טישו', 'ממחטות'], []],
  ['shampoo', ['שמפו'], []], ['conditioner', ['מרכך שיער', 'קרם שיער'], []], ['showerGel', ["ג'ל רחצה", 'סבון גוף', 'תחליב רחצה', 'סבון נוזלי'], []],
  ['soap', ['סבון', 'סבון ידיים', 'סבונים'], []], ['toothpaste', ['משחת שיניים', 'משחות שיניים'], []], ['toothbrush', ['מברשת שיניים', 'מברשות שיניים'], []],
  ['deodorant', ['דאודורנט', 'דיאודורנט', 'רול און'], []], ['razor', ['סכיני גילוח', 'סכין גילוח', 'ג\'ילט', 'קצף גילוח'], []], ['lotion', ['קרם', 'קרם ידיים', 'קרם גוף', 'קרם הגנה'], []],
  ['pads', ['תחבושות', 'תחבושות היגייניות', 'טמפונים'], []], ['bandaid', ['פלסטרים', 'פלסטר', 'תחבושת'], []],
  ['pills', ['אקמול', 'תרופה', 'תרופות', 'כדורים', 'נורופן', 'אדוויל', 'אופטלגין'], []], ['vitamins', ['ויטמינים', 'ויטמין', 'ברזל', 'אומגה'], []],
  ['cotton', ['צמר גפן', 'פדים'], []], ['cottonSwabs', ['מקלוני אוזניים', 'מקלונים'], []],

  ['diapers', ['חיתולים', 'טיטולים', 'האגיס', 'פמפרס', 'חיתול'], []], ['formula', ['מטרנה', 'תמ"ל', 'סימילאק', 'נוטרילון', 'אבקת חלב'], []],
  ['pacifier', ['מוצץ', 'מוצצים'], []], ['babyBottle', ['בקבוק תינוק', 'בקבוקים לתינוק', 'פטמה'], []], ['babyCereal', ['דייסה', 'מחית', 'מחיות', 'דייסות'], []],

  ['plates', ['צלחות', 'צלחות חד פעמיות', 'צלחת'], []], ['cups', ['כוסות', 'כוסות חד פעמיות', 'כוס'], []], ['cutlery', ['סכו"ם', 'סכום', 'מזלגות', 'כפות', 'כפיות', 'סכינים'], []],
  ['napkins', ['מפיות', 'מפית'], []], ['foil', ['נייר כסף', 'נייר אלומיניום', 'אלומיניום'], []], ['bakingPaper', ['נייר אפייה', 'נייר אפיה'], []], ['clingWrap', ['ניילון נצמד', 'ניילון'], []],
  ['bags', ['שקיות', 'שקיות הקפאה', 'שקיות סנדוויץ', 'שקית'], []], ['pans', ['תבניות', 'תבנית', 'תבניות אלומיניום', 'מגשי אלומיניום'], []],
  ['candles', ['נרות', 'נרות שבת', 'נר', 'נרות נשמה', 'נרות חנוכה'], []], ['batteries', ['סוללות', 'סוללה'], []], ['bulb', ['נורה', 'נורות'], []],
  ['matches', ['גפרורים'], []], ['lighter', ['מצית', 'מציתים'], []], ['charcoal', ['פחם', 'פחמים'], []],
];

PD.spiceBlack = () => PD.spice('#37474F');
PD.spiceRed = () => PD.spice('#D84315');
PD.spiceYellow = () => PD.spice('#F9A825');
PD.legumesLentil = () => PD.legumes('#E67E3B');
PD.legumesBean = () => PD.legumes('#F5F0E1');
PD.legumesChick = () => PD.legumes('#E3C27E');
PD.bakingPaper = () => PD.foil('#F5E9D3');
PD.clingWrap = () => PD.foil('#E1F5FE');
PD.matbucha = () => PD.hummus('#D84315', '#9E2A0B');
PD.salad = () => PD.hummus('#7CB342', '#33691E');
