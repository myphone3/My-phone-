import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ToastHost from '../components/Toast';
import WhatsAppFloat from '../components/WhatsAppFloat';
import type { Metadata, Viewport } from 'next';

import Analytics from '../components/Analytics';
import CampaignTracker from '../components/CampaignTracker';
import CartSync from '../components/CartSync';
import SiteTracker from '../components/SiteTracker';
import ConsentBanner from '../components/ConsentBanner';
import AssistantFloat from '../components/AssistantFloat';
import FloatDodge from '../components/FloatDodge';
import PrefetchOnTouch from '../components/PrefetchOnTouch';
import BackToTop from '../components/BackToTop';
import { Suspense } from 'react';
import { getSiteSettings } from '@/lib/siteSettings';
import { SITE_NAME, SITE_URL, jsonLdString, organizationJsonLd } from '@/lib/seo';

export const viewport: Viewport = {
  themeColor: '#ea580c',
};

// מטא-דאטה: שם האפליקציה והלוגו, וכותרת/תיאור/אימות גוגל מהגדרות ה-SEO בפאנל
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const icon = settings.favicon_url || '/Logo.JPG';
  const title = settings.meta_title?.trim() || 'NEW PHONE - הפלאפון החדש שלך';
  const description = settings.meta_description?.trim() || 'החנות המובילה למכשירים כשרים, סלולר ונגנים';
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'he_IL',
      url: SITE_URL,
      title,
      description,
      images: [{ url: '/Logo.JPG', alt: SITE_NAME }],
    },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'NEW PHONE',
    },
    icons: {
      icon,
      apple: '/icon-192.png',
    },
    verification: settings.google_site_verification ? { google: settings.google_site_verification } : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* הגופן Rubik נמצא באתר עצמו (public/fonts), ומוגדר ב-globals.css */}
        <link rel="preload" href="/fonts/rubik-hebrew.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd()) }} />
      </head>
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[200] focus:bg-orange-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold"
        >
          דילוג לתוכן הראשי
        </a>
        
        {/* הדר ראשי */}
        <Header />

        <main id="main" className="min-h-screen">
          {children}
        </main>

        <Footer />
        <ToastHost />
        <WhatsAppFloat />
        <Analytics />
        <Suspense fallback={null}>
          <CampaignTracker />
        </Suspense>
        <CartSync />
        <SiteTracker />
        <AssistantFloat />
        <FloatDodge />
        <PrefetchOnTouch />
        <BackToTop />
        <ConsentBanner />

      </body>
    </html>
  );
}
