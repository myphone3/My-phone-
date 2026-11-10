import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'איזה מכשיר מתאים לי? | NEW PHONE',
  description: 'כמה שאלות קצרות, ונמליץ לך על המכשיר שהכי מתאים לך: כשר, תומך כשר או סמארטפון.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
