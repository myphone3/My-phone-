import type React from 'react';

// אייקונים אחידים בקו דק (במקום אימוג'ים). שימוש: <Icon name="truck" size={20} />
// הצבע לפי currentColor, כך שמשנים אותו עם text-*.

const PATHS: Record<string, React.ReactNode> = {
  // השוואה: שני מוצרים זה לצד זה עם חצים הלוך-חזור
  compare: (
    <>
      <rect x="2.5" y="4" width="7" height="16" rx="1.5" />
      <rect x="14.5" y="4" width="7" height="16" rx="1.5" />
      <path d="M10.5 9h3m-1.2-1.6L13.9 9l-1.6 1.6M13.5 15h-3m1.2-1.6L10.1 15l1.6 1.6" />
    </>
  ),
  bell: <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Zm4 11a2.2 2.2 0 0 0 4 0" />,
  cart: <path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2M9.5 20h.01M17 20h.01" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm0 15A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  gift: <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3.5 7.5 7 12 7Zm0 0s1.5-4 4-3.5S16.5 7 12 7Z" />,
  truck: <path d="M2 6h11v10H2zM13 9.5h4.5L21 13v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.2 2.2 4.4-4.4" />,
  return: <path d="M4 9h11a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4" />,
  phone: <path d="M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18.5h2" />,
  call: <path d="M5 4h3.5l1.5 4-2 1.3a10 10 0 0 0 6.7 6.7L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />,
  sms: <path d="M4 5h16v11H9l-5 4V5Zm4 5h8M8 13h5" />,
  chat: <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12Z" />,
  camera: (
    <>
      <path d="M3 8h3.5L8 5.5h8L17.5 8H21v11H3V8Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6M15.5 8.5h.01" />
    </>
  ),
  music: <path d="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  map: <path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5" />,
  apps: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
    </>
  ),
  mail: <path d="M3 5.5h18v13H3zM3 6l9 7 9-7" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0" />,
  users: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6 6 0 0 1 3 5.5" />,
  child: <path d="M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4 3h8m-4 0v5m0 0-3 5m3-5 3 5" />,
  box: <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Zm0 9 8.5-4.5M12 12v9m0-9L3.5 7.5" />,
  tools: <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z" />,
  lock: <path d="M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11" />,
  card: <path d="M3 5.5h18v13H3zM3 10h18M7 15h3" />,
  wallet: <path d="M4 6.5h14.5A1.5 1.5 0 0 1 20 8v11H5.5A1.5 1.5 0 0 1 4 17.5v-11Zm0 0V5a1.5 1.5 0 0 1 1.5-1.5H16M16 13.5h.01" />,
  battery: <path d="M3 8h15v8H3zM21 11v2M6 11v2" />,
  screen: <path d="M3 4h18v12H3zM8 20h8M12 16v4" />,
  keypad: <path d="M6 3h12v18H6zM9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" />,
  sim: <path d="M7 3h7l4 4v14H7V3Zm3 9h5v5h-5z" />,
  headphones: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z" />,
  plug: <path d="M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v4" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
    </>
  ),
  sparkle: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6" />,
  tag: <path d="M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3m0 13v3M2.5 12h3m13 0h3M5.3 5.3l2.1 2.1m9.2 9.2 2.1 2.1M5.3 18.7l2.1-2.1m9.2-9.2 2.1-2.1" />
    </>
  ),
  coins: <path d="M8 9c3.3 0 6-1.1 6-2.5S11.3 4 8 4 2 5.1 2 6.5 4.7 9 8 9Zm-6-2.5v4C2 11.9 4.7 13 8 13s6-1.1 6-2.5v-4M10 15.5c.7.3 1.8.5 4 .5 3.3 0 6-1.1 6-2.5v-4c0-1.4-2.7-2.5-6-2.5M2 10.5v4C2 15.9 4.7 17 8 17s6-1.1 6-2.5" />,
  shrug: <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 8c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5M3 9l2 2m16-2-2 2" />,
  kosher: <path d="M12 3 20 17H4L12 3Zm0 18L4 7h16l-8 14Z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.7, title }: { name: string; size?: number; className?: string; strokeWidth?: number; title?: string }) {
  const content = PATHS[name] || PATHS.sparkle;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}
