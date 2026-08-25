import type { Metadata } from 'next';
import { Rubik, Heebo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/Header';

const display = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

const body = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500'],
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'החנות שלי | סלולר ואביזרים',
  description: 'חנות סלולר אונליין - מכשירים, אביזרים ומחירים הוגנים',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body bg-paper text-ink min-h-screen flex flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line mt-16 py-8 text-center text-sm text-muted">
            <p>© {new Date().getFullYear()} החנות שלי · כל הזכויות שמורות</p>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
