import './globals.css';

export const metadata = {
  title: 'חנות מכשירים ואביזרים כשרים',
  description: 'החנות המובילה למכשירים ואביזרים כשרים',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
