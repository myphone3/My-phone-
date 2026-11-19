// ציורי ירקות ופירות + עזרים משותפים לציור
export const P = {
  red: { b: '#E53935', d: '#A51D1A', l: '#FF9C94' },
  orange: { b: '#FB8C00', d: '#C25E00', l: '#FFD08A' },
  yellow: { b: '#FDD22F', d: '#D9A400', l: '#FFF3A6' },
  green: { b: '#43A047', d: '#22672A', l: '#A8DCA9' },
  lime: { b: '#A5CF5E', d: '#6E9A2F', l: '#E2F2C4' },
  dgreen: { b: '#2F7D34', d: '#174A1B', l: '#7FC384' },
  purple: { b: '#7B2A8E', d: '#4B1258', l: '#C88BD6' },
  plum: { b: '#5E2A6E', d: '#381442', l: '#A673B4' },
  magenta: { b: '#9C1F4A', d: '#5E0E2B', l: '#E07A9E' },
  onion: { b: '#D79A4E', d: '#9C6328', l: '#F3D2A0' },
  redonion: { b: '#8E3570', d: '#5A1A46', l: '#D58DBE' },
  potato: { b: '#C9A06A', d: '#8E6A3C', l: '#EBD3AE' },
  sweet: { b: '#B9573D', d: '#7E3423', l: '#E39A82' },
  cream: { b: '#F4EEDF', d: '#CFC2A5', l: '#FFFFFF' },
  mush: { b: '#E3D0B0', d: '#A98D63', l: '#FFF8EC' },
  brownmush: { b: '#8D6248', d: '#5C3C29', l: '#C49C80' },
  pear: { b: '#C5D94A', d: '#8FA324', l: '#EEF5B5' },
  peach: { b: '#FFA163', d: '#E0603A', l: '#FFD9B8' },
  melon: { b: '#E3CF6A', d: '#B79E35', l: '#F7EDB5' },
  tan: { b: '#D8B27A', d: '#A07B45', l: '#F2DDB8' },
  date: { b: '#8A4B22', d: '#5A2C10', l: '#C58556' },
};
export const LEAF = '#4CAF50', LEAFD = '#2E7D32', STEM = '#6D4C41';

export const f = (n) => Math.round(n * 10) / 10;
// גוף עגול עם צל בצד ימין־למטה והברקה בשמאל־למעלה
export function ball(cx, cy, rx, ry, c, hl = true) {
  const a1 = (-30 * Math.PI) / 180, a2 = (120 * Math.PI) / 180;
  const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
  const x2 = cx + rx * Math.cos(a2), y2 = cy + ry * Math.sin(a2);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.b}"/>` +
    `<path d="M${f(x1)} ${f(y1)}A${rx} ${ry} 0 0 1 ${f(x2)} ${f(y2)}A${f(rx * 1.25)} ${f(ry * 1.25)} 0 0 0 ${f(x1)} ${f(y1)}Z" fill="${c.d}" opacity=".35"/>` +
    (hl ? `<ellipse cx="${f(cx - rx * 0.42)}" cy="${f(cy - ry * 0.42)}" rx="${f(rx * 0.24)}" ry="${f(ry * 0.14)}" fill="${c.l}" opacity=".9" transform="rotate(-35 ${f(cx - rx * 0.42)} ${f(cy - ry * 0.42)})"/>` : '');
}
export const leaf = (x, y, rot, len = 12, w = 5, col = LEAF) =>
  `<path d="M0 0C${f(len * 0.3)} ${-w} ${f(len * 0.75)} ${-w} ${len} 0C${f(len * 0.75)} ${w} ${f(len * 0.3)} ${w} 0 0Z" fill="${col}" transform="translate(${x} ${y}) rotate(${rot})"/>`;
export function calyx(cx, cy, s = 1) {
  let o = '';
  for (const a of [-90, -18, 54, 126, 198]) o += leaf(cx, cy, a + 90, 8 * s, 2.6 * s, LEAFD);
  return o + `<circle cx="${cx}" cy="${cy}" r="${2 * s}" fill="${LEAFD}"/>`;
}

export const D = {
  tomato: (c = P.red) => ball(32, 37, 22, 19, c) + `<path d="M32 19v-6" stroke="${LEAFD}" stroke-width="3" stroke-linecap="round"/>` + calyx(32, 20, 1.2),

  vine: (c = P.red, r = 12, n = 3) => {
    const pts = n === 3 ? [[17, 38], [33, 44], [48, 35]] : [[12, 32], [25, 42], [38, 33], [51, 43], [31, 54]];
    let o = `<path d="M6 12C18 18 30 14 40 16S56 14 60 10" stroke="${LEAFD}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    for (const [x, y] of pts) o += `<path d="M${x} ${y - r}Q${x} ${y - r - 6} ${x + 2} ${n === 3 ? 15 : y > 50 ? 36 : 15}" stroke="${LEAFD}" stroke-width="2" fill="none"/>`;
    for (const [x, y] of pts) o += ball(x, y, r, r * 0.92, c) + calyx(x, y - r + 1, r / 16);
    return o;
  },

  bellPepper: (c = P.red) =>
    `<path d="M32 18C20 15 12 22 13 35C14 47 19 56 26 55C29 57.5 35 57.5 38 55C45 56 50 47 51 35C52 22 44 15 32 18Z" fill="${c.b}"/>` +
    `<path d="M44 20C50 25 51 36 49 45C47 51 43 55 38 55C42 49 44 40 43 31C42 25 41 22 44 20Z" fill="${c.d}" opacity=".35"/>` +
    `<path d="M32 23C30.5 34 30.5 45 32 55.5" stroke="${c.d}" stroke-width="2" fill="none" opacity=".45"/>` +
    `<ellipse cx="21.5" cy="32" rx="3" ry="7" fill="${c.l}" opacity=".85" transform="rotate(12 21.5 32)"/>` +
    `<ellipse cx="32" cy="18.5" rx="8" ry="3.4" fill="${LEAFD}"/>` +
    `<path d="M32 17C32 12 34 9 38 7.5" stroke="${LEAFD}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,

  chili: (c = P.red) =>
    `<path d="M16 17C11 21 12 29 18 37C26 47 38 53.5 53 56C57 56.5 57.5 53 53.5 51C41 46 31 38 25.5 28C23 23 21 16.5 16 17Z" fill="${c.b}"/>` +
    `<path d="M25.5 28C31 38 41 46 53.5 51C55.5 52 56 54 54.5 55C42 51 31 45 24 34Z" fill="${c.d}" opacity=".35"/>` +
    `<path d="M17 23C19 31 26 39 35 45" stroke="${c.l}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M11.5 18.5C13 14 18.5 13 21 15.5C19 18 15 19.5 11.5 18.5Z" fill="${LEAFD}"/>` +
    `<path d="M15.5 15C14 11 10 8.5 6.5 8" stroke="${LEAFD}" stroke-width="3" fill="none" stroke-linecap="round"/>`,

  mushroom: (c = P.mush) =>
    `<path d="M24 36C24 44 22.5 51 24.5 55C28.5 57.5 35.5 57.5 39.5 55C41.5 51 40 44 40 36Z" fill="#F6EFE2"/>` +
    `<path d="M34.5 36C36 44 36 51 35 56.5C37 56.3 38.5 55.8 39.5 55C41.5 51 40 44 40 36Z" fill="#D8CAB0" opacity=".7"/>` +
    `<path d="M9 34C9 20 19 11 32 11S55 20 55 34C55 37.5 52 39 48 39H16C12 39 9 37.5 9 34Z" fill="${c.b}"/>` +
    `<path d="M47 16C53 21 55 28 55 34C55 37.5 52 39 48 39H38C46 35 50 26 47 16Z" fill="${c.d}" opacity=".35"/>` +
    `<ellipse cx="22" cy="20.5" rx="6" ry="3" fill="${c.l}" opacity=".9" transform="rotate(-25 22 20.5)"/>` +
    `<path d="M15 38.5H49" stroke="${c.d}" stroke-width="2" opacity=".5"/>`,

  onion: (c = P.onion) =>
    `<path d="M32 13C30.5 19 14 25 14 40C14 50 22 56.5 32 56.5S50 50 50 40C50 25 33.5 19 32 13Z" fill="${c.b}"/>` +
    `<path d="M42 24C48 29 50 34 50 40C50 50 42 56.5 32 56.5C42 51 45 37 42 24Z" fill="${c.d}" opacity=".35"/>` +
    `<path d="M32 17C25 26 23 42 30 56M32 17C39 26 41 42 34 56" stroke="${c.d}" stroke-width="1.6" fill="none" opacity=".5"/>` +
    `<ellipse cx="21.5" cy="36" rx="2.6" ry="6.5" fill="${c.l}" opacity=".8" transform="rotate(15 21.5 36)"/>` +
    `<path d="M32 13C31.5 10 33 7.5 35.5 6.5" stroke="${c.d}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M27 56.5L25 60M32 57V61M37 56.5L39 60" stroke="#B89A72" stroke-width="1.6" stroke-linecap="round"/>`,

  greenOnion: () => {
    let o = '';
    for (const [x, r] of [[24, -8], [32, 0], [40, 8]])
      o += `<g transform="rotate(${r} 32 56)"><path d="M${x - 3} 34V8C${x - 3} 5 ${x + 3} 5 ${x + 3} 8V34Z" fill="${LEAF}"/><path d="M${x + 1} 34V8" stroke="${LEAFD}" stroke-width="1.4" opacity=".6"/><path d="M${x - 3} 34V50C${x - 3} 55 ${x + 3} 55 ${x + 3} 50V34Z" fill="#F4F1E6"/><path d="M${x - 3} 34H${x + 3}" stroke="#C5DDA2" stroke-width="3"/></g>`;
    return o + `<path d="M28 57L26 61M32 57.5V62M36 57L38 61" stroke="#C9B48F" stroke-width="1.6" stroke-linecap="round"/>`;
  },

  garlic: () =>
    `<path d="M32 12C30 19 13 25 13 39C13 50 22 56 32 56S51 50 51 39C51 25 34 19 32 12Z" fill="#F7F3EA"/>` +
    `<path d="M32 16C24 25 22 42 27 55.5M32 16C40 25 42 42 37 55.5M32 16C21 26 16 40 20 52M32 16C43 26 48 40 44 52" stroke="#C4B391" stroke-width="1.6" fill="none"/>` +
    `<path d="M43 24C49 29 51 34 51 39C51 50 42 56 32 56C42 50 46 37 43 24Z" fill="#CBBE9F" opacity=".45"/>` +
    `<path d="M32 12V7" stroke="#CDBE9E" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M26 56L24 60M32 56.5V61M38 56L40 60" stroke="#BFAE8A" stroke-width="1.6" stroke-linecap="round"/>`,

  potato: (c = P.potato) =>
    `<path d="M12 33C10 22 22 15 34 16C47 17 55 24 54 35C53 46 44 51 32 51C20 51 13 44 12 33Z" fill="${c.b}"/>` +
    `<path d="M47 20C53 25 55 31 54 37C52 46 43 51 32 51C44 46 50 33 47 20Z" fill="${c.d}" opacity=".35"/>` +
    `<circle cx="24" cy="28" r="1.4" fill="${c.d}"/><circle cx="38" cy="25" r="1.4" fill="${c.d}"/><circle cx="31" cy="38" r="1.4" fill="${c.d}"/><circle cx="44" cy="38" r="1.4" fill="${c.d}"/><circle cx="20" cy="40" r="1.2" fill="${c.d}"/>` +
    `<ellipse cx="22" cy="23" rx="5" ry="2.4" fill="${c.l}" opacity=".8" transform="rotate(-20 22 23)"/>`,

  sweetPotato: (c = P.sweet) =>
    `<path d="M6 40C8 30 22 22 36 21C48 20 57 25 58 31C59 37 50 42 38 45C24 48 13 48 6 40Z" fill="${c.b}"/>` +
    `<path d="M58 31C59 37 50 42 38 45C26 48 14 48 7 42C20 43 36 41 48 35C53 33 57 31 58 31Z" fill="${c.d}" opacity=".35"/>` +
    `<path d="M20 31Q22 35 20 39M33 27Q35 32 33 37M45 26Q47 30 45 34" stroke="${c.d}" stroke-width="1.4" fill="none" opacity=".6"/>` +
    `<ellipse cx="24" cy="28" rx="6" ry="2" fill="${c.l}" opacity=".7" transform="rotate(-15 24 28)"/>`,

  carrot: () =>
    `<path d="M24 20C20 30 21 42 27 54C28.5 57 31 57 32 54C38 41 40 30 38 20C34 17 28 17 24 20Z" fill="#F57C00" transform="rotate(-25 31 37)"/>` +
    `<path d="M38 20C40 30 38 41 32 54C31.4 55.4 30.6 56 30 56C34 44 36 30 34 19Z" fill="#B85000" opacity=".35" transform="rotate(-25 31 37)"/>` +
    `<path d="M24.5 27H29M23.5 35H28M25 43H29.5M34 31H37.5M33 39H36.5" stroke="#B85000" stroke-width="1.5" stroke-linecap="round" opacity=".6" transform="rotate(-25 31 37)"/>` +
    leaf(28, 19, -110, 13, 3.4) + leaf(28, 19, -75, 15, 3.4, LEAFD) + leaf(28, 19, -140, 12, 3.4, LEAFD),

  cucumber: (c = P.dgreen) =>
    `<g transform="rotate(-38 32 32)"><rect x="6" y="23" width="52" height="18" rx="9" fill="${c.b}"/>` +
    `<path d="M10 37C20 40 44 40 55 36C53 39.5 50 41 49 41H15C13 41 11 39.5 10 37Z" fill="${c.d}" opacity=".5"/>` +
    `<path d="M14 28H40" stroke="${c.l}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
    `<circle cx="22" cy="33" r="1" fill="${c.l}"/><circle cx="32" cy="30" r="1" fill="${c.l}"/><circle cx="43" cy="33" r="1" fill="${c.l}"/><circle cx="50" cy="29" r="1" fill="${c.l}"/>` +
    `<rect x="55" y="30" width="5" height="4" rx="1.5" fill="${c.d}"/></g>`,

  zucchini: () =>
    `<g transform="rotate(-38 32 32)"><path d="M8 32C8 26 13 23 20 23H48C54 23 58 27 58 32S54 41 48 41H20C13 41 8 38 8 32Z" fill="#9CC86A"/>` +
    `<path d="M12 37C22 40 44 40 56 36C54.5 39.5 51 41 48 41H20C16 41 13 39.5 12 37Z" fill="#5E8C33" opacity=".5"/>` +
    `<path d="M16 28H44" stroke="#D8EBB5" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M24 25V39M36 24.5V39.5" stroke="#7FAE4C" stroke-width="1.2" opacity=".6"/>` +
    `<rect x="57" y="29.5" width="5" height="5" rx="1.5" fill="#6E8F3A"/><circle cx="8.5" cy="32" r="2" fill="#E8C64A"/></g>`,

  eggplant: () =>
    `<path d="M30 16C20 17 14 26 14 36C14 48 21 57 31 57C42 57 50 50 50 40C50 30 43 26 40 20C38 17 34 16 30 16Z" fill="${P.purple.b}"/>` +
    `<path d="M45 27C49 32 50 36 50 40C50 50 42 57 31 57C42 52 47 39 45 27Z" fill="${P.purple.d}" opacity=".45"/>` +
    `<ellipse cx="22" cy="35" rx="3" ry="8" fill="${P.purple.l}" opacity=".7" transform="rotate(15 22 35)"/>` +
    `<path d="M24 20C27 14 37 13 41 19C38 24 35 22 33 26C31 22 27 24 24 20Z" fill="${LEAFD}"/>` +
    `<path d="M33 17C33 12 35 9 38 8" stroke="${LEAFD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,

  lettuce: () => {
    let o = '';
    for (const [x, y, r, col] of [[20, 38, 14, '#7CB342'], [44, 38, 14, '#7CB342'], [32, 26, 15, '#8BC34A'], [32, 42, 16, '#9CCC65'], [24, 30, 11, '#AED581'], [40, 30, 11, '#AED581']])
      o += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
    return o + `<path d="M32 56V30M32 44L24 36M32 40L40 33M32 50L22 44M32 48L42 42" stroke="#E6F2C9" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
  },

  cabbage: (c = { b: '#9ACD5A', d: '#5E9128', l: '#D8EDB0' }) =>
    ball(32, 34, 23, 21, c, false) +
    `<path d="M32 13C22 18 18 30 22 45M32 13C42 18 46 30 42 45M32 13V54" stroke="${c.l}" stroke-width="1.8" fill="none" opacity=".9"/>` +
    `<path d="M10 36C16 46 24 52 32 55C40 52 48 46 54 36C50 50 42 56 32 56S14 50 10 36Z" fill="${c.d}" opacity=".5"/>`,

  broccoli: () =>
    `<path d="M27 36L25 56C29 58 35 58 39 56L37 36Z" fill="#8BC34A"/><path d="M33 40L30 34M31 46L36 38" stroke="#689F38" stroke-width="2.4" stroke-linecap="round"/>` +
    [[20, 28, 10], [44, 28, 10], [32, 20, 11], [27, 32, 9], [38, 33, 9], [32, 28, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2E7D32"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.45}" fill="#43A047"/>`).join(''),

  cauliflower: () =>
    leaf(32, 40, 200, 24, 8, LEAF) + leaf(32, 40, -20, 24, 8, LEAF) + leaf(32, 42, 160, 22, 7, LEAFD) + leaf(32, 42, 20, 22, 7, LEAFD) +
    [[20, 32, 10], [44, 32, 10], [32, 22, 11], [26, 35, 9], [38, 35, 9], [32, 31, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#F3EAD3"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.4}" fill="#FFFBF0"/><circle cx="${x + r * 0.35}" cy="${y + r * 0.35}" r="${r * 0.35}" fill="#DCCDA8" opacity=".6"/>`).join(''),

  corn: () => {
    let k = '';
    for (let y = 14; y <= 46; y += 6) for (let x = 25; x <= 39; x += 5) k += `<circle cx="${x}" cy="${y + (x % 2 ? 1.5 : 0)}" r="2.3" fill="#FFE57F"/>`;
    return `<g transform="rotate(-20 32 34)"><ellipse cx="32" cy="31" rx="11" ry="22" fill="#FBC02D"/>${k}` +
      `<path d="M32 58C20 54 15 42 18 26C22 38 26 46 32 50Z" fill="${LEAF}"/><path d="M32 58C44 54 49 42 46 26C42 38 38 46 32 50Z" fill="${LEAFD}"/></g>`;
  },

  avocado: () =>
    `<path d="M32 8C24 8 20 16 18 24C15 31 10 36 10 44C10 53 20 59 32 59S54 53 54 44C54 36 49 31 46 24C44 16 40 8 32 8Z" fill="#33691E"/>` +
    `<path d="M32 12C26 12 23.5 18 22 25C20 31 15 36 15 43C15 51 23 55 32 55S49 51 49 43C49 36 44 31 42 25C40.5 18 38 12 32 12Z" fill="#DCE775"/>` +
    `<path d="M32 18C27 18 25 23 24 28C22 33 19 37 19 43C19 49 25 52 32 52S45 49 45 43C45 37 42 33 40 28C39 23 37 18 32 18Z" fill="#F0F4C3"/>` +
    `<circle cx="32" cy="41" r="8.5" fill="#8D5524"/><circle cx="29" cy="38" r="2.6" fill="#B9783F"/>`,

  lemon: (c = P.yellow) =>
    `<path d="M8 34C10 33 11 31 13 28C17 20 25 16 33 16S49 20 52 28C53 31 54 33 56 34C54 35 53 37 52 40C49 48 41 52 33 52S17 48 13 40C11 37 10 35 8 34Z" fill="${c.b}"/>` +
    `<path d="M50 26C52 30 53 32 56 34C54 35 53 37 52 40C49 48 41 52 33 52C43 48 51 39 50 26Z" fill="${c.d}" opacity=".35"/>` +
    `<ellipse cx="24" cy="25" rx="6" ry="2.4" fill="${c.l}" opacity=".9" transform="rotate(-20 24 25)"/>` +
    leaf(40, 17, -30, 13, 4.4),

  apple: (c = P.red) =>
    `<path d="M32 20C26 14 12 15 11 31C10 45 20 57 27 57C30 57 30.5 55.5 32 55.5S34 57 37 57C44 57 54 45 53 31C52 15 38 14 32 20Z" fill="${c.b}"/>` +
    `<path d="M46 19C51 22 53 27 53 31C54 45 44 57 37 57C34 57 33 56 32 55.5C43 51 50 36 46 19Z" fill="${c.d}" opacity=".35"/>` +
    `<ellipse cx="20" cy="28" rx="3.4" ry="6" fill="${c.l}" opacity=".85" transform="rotate(25 20 28)"/>` +
    `<path d="M32 21C32 16 33 12 35 9" stroke="${STEM}" stroke-width="3" fill="none" stroke-linecap="round"/>` + leaf(34, 14, -25, 13, 4.4),

  banana: () =>
    `<path d="M12 18C9 32 15 47 30 53C40 57 51 55 56 49C57 47 55 45.5 53 46.5C44 50 34 48 26 41C19 35 16 26 17 17C17 13 13 13 12 18Z" fill="#FDD835"/>` +
    `<path d="M14 26C15 39 23 49 35 52C42 53.5 49 52 53 49C47 54 37 56 29 52C19 48 13 37 14 26Z" fill="#E0A800" opacity=".55"/>` +
    `<path d="M18 22C19 32 24 40 33 45" stroke="#FFF59D" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M12.5 17.5L13.5 11.5L17.5 12.5L16.5 17.5Z" fill="#7A5A2E"/><circle cx="55.5" cy="47.5" r="1.8" fill="#5D4320"/>`,

  orange: (c = P.orange, s = 1) =>
    ball(32, 35, 21 * s, 20 * s, c) +
    `<circle cx="27" cy="40" r=".9" fill="${c.d}" opacity=".5"/><circle cx="38" cy="30" r=".9" fill="${c.d}" opacity=".5"/><circle cx="36" cy="44" r=".9" fill="${c.d}" opacity=".5"/><circle cx="22" cy="32" r=".9" fill="${c.d}" opacity=".5"/>` +
    `<circle cx="32" cy="${f(35 - 20 * s + 1.5)}" r="1.8" fill="${LEAFD}"/>` + leaf(33, f(35 - 20 * s + 1), -35, 13, 4.6),

  pear: (c = P.pear) =>
    `<path d="M32 15C27 15 25 20 25 26C25 31 15 35 15 46C15 54 23 58 32 58S49 54 49 46C49 35 39 31 39 26C39 20 37 15 32 15Z" fill="${c.b}"/>` +
    `<path d="M40 30C46 34 49 39 49 46C49 54 41 58 32 58C42 53 45 42 40 30Z" fill="${c.d}" opacity=".35"/>` +
    `<ellipse cx="22" cy="42" rx="3" ry="6" fill="${c.l}" opacity=".85" transform="rotate(20 22 42)"/>` +
    `<path d="M32 16C32 12 33 9 35 7" stroke="${STEM}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` + leaf(34, 11, -20, 11, 4),

  grapes: (c = { b: '#9CCC65', d: '#5E8F2C', l: '#E1F2C4' }) => {
    let o = `<path d="M32 16V8" stroke="${STEM}" stroke-width="3" stroke-linecap="round"/>` + leaf(32, 11, -15, 14, 6);
    for (const [x, y] of [[21, 22], [32, 21], [43, 22], [26, 31], [37, 31], [17, 31], [47, 31], [21, 40], [32, 40], [43, 40], [26, 49], [37, 49], [32, 57]])
      o += `<circle cx="${x}" cy="${y}" r="6" fill="${c.b}"/><path d="M${x + 5.2} ${y + 3}A6 6 0 0 1 ${x - 2} ${y + 5.6}A6.5 6.5 0 0 0 ${x + 5.2} ${y + 3}Z" fill="${c.d}" opacity=".4"/><circle cx="${x - 2}" cy="${y - 2}" r="1.6" fill="${c.l}"/>`;
    return o;
  },

  watermelon: () =>
    `<path d="M6 24H58C58 40 46 54 32 54S6 40 6 24Z" fill="#2E7D32"/>` +
    `<path d="M9 24H55C55 38 45 50 32 50S9 38 9 24Z" fill="#E8F5C8"/>` +
    `<path d="M11.5 24H52.5C52.5 37 43 47 32 47S11.5 37 11.5 24Z" fill="#EF4545"/>` +
    `<path d="M14 24H50" stroke="#FF8A8A" stroke-width="2" opacity=".6"/>` +
    [[22, 31], [32, 34], [42, 31], [27, 40], [37, 40]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="2.2" fill="#2B2B2B"/>`).join(''),

  melon: () =>
    ball(32, 34, 23, 21, P.melon) +
    `<path d="M14 25C24 31 40 31 50 25M11 36C22 42 42 42 53 36M18 48C26 51 38 51 46 48M22 16C18 26 18 42 24 53M42 16C46 26 46 42 40 53M32 13V55" stroke="#FBF4D6" stroke-width="1.2" fill="none" opacity=".9"/>`,

  strawberry: () =>
    `<path d="M32 58C22 52 11 40 12 28C13 20 21 17 32 18C43 17 51 20 52 28C53 40 42 52 32 58Z" fill="#E53935"/>` +
    `<path d="M45 21C50 24 52 26 52 30C52 41 42 52 32 58C41 49 47 36 45 21Z" fill="#A51D1A" opacity=".35"/>` +
    [[22, 28], [32, 27], [42, 28], [27, 36], [37, 36], [20, 37], [44, 37], [32, 44], [26, 45], [38, 45], [32, 51]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".9" ry="1.5" fill="#FFE082"/>`).join('') +
    leaf(32, 19, 200, 12, 4, LEAFD) + leaf(32, 19, -20, 12, 4, LEAFD) + leaf(32, 19, 135, 10, 4) + leaf(32, 19, 45, 10, 4) +
    `<path d="M32 19V11" stroke="${LEAFD}" stroke-width="2.6" stroke-linecap="round"/>`,

  peach: (c = P.peach) =>
    ball(32, 36, 21, 20, c) + `<path d="M32 17C27 26 27 44 33 55" stroke="${c.d}" stroke-width="1.8" fill="none" opacity=".5"/>` +
    `<path d="M32 17C32 13 33 11 35 9" stroke="${STEM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` + leaf(33, 13, -30, 13, 4.6),

  mango: () =>
    `<path d="M14 38C10 26 18 13 32 12C46 11 56 21 55 33C54 46 44 56 32 56C23 56 17 47 14 38Z" fill="#FFB300"/>` +
    `<path d="M14 38C10 26 18 13 32 12C40 12 46 15 50 20C40 18 26 22 20 34C18 38 16 40 14 38Z" fill="#E53935" opacity=".75"/>` +
    `<path d="M50 22C54 27 55 30 55 34C54 46 44 56 32 56C44 50 52 38 50 22Z" fill="#C67100" opacity=".35"/>` +
    `<path d="M33 12C33 9 34 7 36 6" stroke="${STEM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` + leaf(34, 9, -20, 13, 4.4),

  pineapple: () => {
    let o = '';
    for (const [r, l, col] of [[-40, 18, LEAFD], [-15, 22, LEAF], [0, 24, LEAFD], [15, 22, LEAF], [40, 18, LEAFD]]) o += leaf(32, 24, r - 90, l, 4, col);
    return o + `<ellipse cx="32" cy="41" rx="15" ry="18" fill="#F9A825"/>` +
      `<path d="M20 30L42 56M17 39L36 59M25 24L46 49M44 30L22 56M47 39L28 59M39 24L18 49" stroke="#B9770E" stroke-width="1.4" opacity=".7"/>` +
      `<path d="M42 28C46 33 47 37 47 41C47 51 40 59 32 59C40 54 44 42 42 28Z" fill="#B9770E" opacity=".3"/>`;
  },

  kiwi: () =>
    `<ellipse cx="32" cy="34" rx="23" ry="21" fill="#8D6E3F"/><ellipse cx="32" cy="34" rx="20.5" ry="18.5" fill="#8BC34A"/>` +
    `<ellipse cx="32" cy="34" rx="15" ry="13.5" fill="#AED581"/><ellipse cx="32" cy="34" rx="6" ry="5" fill="#F1F8E0"/>` +
    Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<ellipse cx="${f(32 + 9.5 * Math.cos(a))}" cy="${f(34 + 8.5 * Math.sin(a))}" rx="1" ry="1.8" fill="#222" transform="rotate(${i * 30 + 90} ${f(32 + 9.5 * Math.cos(a))} ${f(34 + 8.5 * Math.sin(a))})"/>`; }).join(''),

  pomegranate: () =>
    ball(32, 37, 21, 20, { b: '#C62828', d: '#7F1010', l: '#FF8A80' }) +
    `<path d="M25 19L26 11L29 15L32 9L35 15L38 11L39 19Z" fill="#A31515"/>`,

  herbs: (col = LEAF) => {
    let o = '';
    for (const [x, r] of [[24, -14], [30, -4], [36, 6], [42, 16]]) o += `<path d="M32 58L${x} 20" stroke="#5C8F2E" stroke-width="2" transform="rotate(${r / 3} 32 58)"/>`;
    for (const [x, y, r] of [[22, 18, 7], [31, 14, 8], [41, 17, 7], [18, 28, 6], [27, 25, 7], [37, 25, 7], [46, 28, 6], [25, 34, 5], [39, 34, 5]])
      o += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x - 2}" cy="${y - 2}" r="${r * 0.45}" fill="#81C784"/>`;
    return o + `<rect x="27" y="44" width="10" height="5" rx="1.5" fill="#E57373"/>`;
  },

  celery: () => {
    let o = '';
    for (const [x, r] of [[26, -10], [32, 0], [38, 10]])
      o += `<g transform="rotate(${r} 32 58)"><path d="M${x - 3.5} 58V24H${x + 3.5}V58Z" fill="#C5E1A5"/><path d="M${x + 1} 58V24" stroke="#9CCC65" stroke-width="1.6"/></g>`;
    for (const [x, y] of [[20, 18], [30, 12], [40, 14], [46, 22], [26, 22], [36, 20]]) o += `<circle cx="${x}" cy="${y}" r="5.5" fill="${LEAF}"/>`;
    return o;
  },

  beet: () =>
    leaf(30, 24, -110, 18, 5, '#43A047') + leaf(32, 24, -70, 18, 5, LEAFD) + `<path d="M31 24L28 10M33 24L38 10" stroke="#AD1457" stroke-width="1.6"/>` +
    ball(32, 38, 18, 17, P.magenta) + `<path d="M32 55Q31 59 33 62" stroke="${P.magenta.d}" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  radish: () =>
    leaf(30, 26, -115, 16, 5) + leaf(32, 26, -65, 16, 5, LEAFD) + leaf(31, 26, -90, 18, 5) +
    ball(32, 39, 15, 14, { b: '#E2365B', d: '#9A1838', l: '#FF9EB3' }) +
    `<path d="M28 51C30 55 34 55 36 51C35 54 33 56 32 61C31 56 29 54 28 51Z" fill="#F7EDEA"/>`,

  pumpkin: () =>
    `<ellipse cx="20" cy="38" rx="12" ry="16" fill="#E8730C"/><ellipse cx="44" cy="38" rx="12" ry="16" fill="#D9650A"/><ellipse cx="32" cy="38" rx="12" ry="17" fill="#F7861A"/>` +
    `<ellipse cx="28" cy="30" rx="2.4" ry="6" fill="#FFBE76" opacity=".8"/>` +
    `<path d="M32 22C32 17 33 14 36 12" stroke="#5D7A2A" stroke-width="4" fill="none" stroke-linecap="round"/>`,

  ginger: () =>
    `<path d="M10 40C8 34 14 30 20 32C22 26 28 24 32 28C35 22 42 22 44 28C50 27 56 31 54 37C53 42 47 44 40 43C36 47 28 47 24 44C18 47 11 45 10 40Z" fill="${P.tan.b}"/>` +
    `<path d="M12 42C18 45 24 44 24 44C28 47 36 47 40 43C47 44 53 42 54 37C53 44 46 47 40 46C34 50 27 49 23 47C17 49 13 46 12 42Z" fill="${P.tan.d}" opacity=".5"/>` +
    `<path d="M18 36Q20 38 19 40M30 34Q32 37 31 40M42 33Q44 36 43 39" stroke="${P.tan.d}" stroke-width="1.4" fill="none" opacity=".7"/>`,

  dates: () =>
    [[20, 44, -30], [32, 46, 0], [44, 44, 30], [26, 30, -15], [38, 30, 15]].map(([x, y, r]) =>
      `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="7" ry="12" fill="${P.date.b}"/><ellipse cx="${x + 2.5}" cy="${y + 2}" rx="3.5" ry="9" fill="${P.date.d}" opacity=".5"/><ellipse cx="${x - 2.5}" cy="${y - 4}" rx="1.6" ry="4" fill="${P.date.l}" opacity=".8"/></g>`).join(''),

  peas: () =>
    `<path d="M6 34C14 22 34 16 54 18C60 19 60 24 55 27C40 36 22 42 10 42C5 42 4 38 6 34Z" fill="#558B2F"/>` +
    [[16, 34], [26, 30], [36, 26], [46, 23]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#9CCC65"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="1.6" fill="#DCEDC8"/>`).join('') +
    `<path d="M54 18C57 14 60 13 62 13" stroke="${LEAFD}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
};
