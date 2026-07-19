import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import SmoothScroll from "@/components/layout/SmoothScroll";
import CookieConsent from "@/components/shared/CookieConsent";
import { cn } from "@/lib/utils";

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ansaraeo.com"),
  title: {
    default: "AnsarAEO — AI Search Visibility for Indian Brands",
    template: "%s · AnsarAEO",
  },
  description:
    "Track how ChatGPT, Perplexity and Gemini talk about your brand — in English, Hindi and Hinglish. Visibility scores, share of voice, and one-click fixes. Built for India, priced in ₹.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://ansaraeo.com",
    siteName: "AnsarAEO",
    title: "AnsarAEO — Be the answer AI gives your customers",
    description:
      "India-first AI search visibility. Hindi & Hinglish prompt tracking, visibility scores, and auto-fixes that win you the mention.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AnsarAEO — AI Search Visibility for Indian Brands",
    description:
      "Track and win AI search mentions across ChatGPT, Perplexity and Gemini — in English, Hindi and Hinglish.",
  },
  robots: { index: true, follow: true },
};

// Explicit viewport export — Next.js 14+ moved this out of `metadata`.
// `viewport-fit=cover` lets the marketing hero + workspace shell paint
// into iOS safe-area notches; `maximum-scale` is deliberately omitted so
// pinch-zoom stays available (a11y — WCAG 1.4.4 Resize Text).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AnsarAEO",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI search visibility (AEO) platform for Indian brands and agencies. Tracks brand mentions across ChatGPT, Perplexity and Gemini in English, Hindi and Hinglish.",
  offers: {
    "@type": "Offer",
    price: "1999",
    priceCurrency: "INR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-mono", interHeading.variable, geistMono.variable)}>
      <body className="bg-white font-sans text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScroll>{children}</SmoothScroll>
        <CookieConsent />
      </body>
    </html>
  );
}
