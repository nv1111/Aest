import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces, Noto_Sans_Devanagari, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

// Devanagari companions — swapped in via html[lang="hi"] in globals.css so
// Hindi renders in its own well-hinted type instead of a system fallback.
const devanagariSans = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});
const devanagariSerif = Noto_Serif_Devanagari({
  variable: "--font-devanagari-serif",
  subsets: ["devanagari"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tara — Your personal jyotish guide",
  description:
    "Understand your birth chart in simple language. Private data, clear pricing, verified astrologers. Tara is your calm, trustworthy guide to Vedic astrology.",
  applicationName: "Tara",
};

export const viewport: Viewport = {
  themeColor: "#FAF8F4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${devanagariSans.variable} ${devanagariSerif.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
