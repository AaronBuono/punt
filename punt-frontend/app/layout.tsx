import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const defaultSiteUrl = "https://punt.fun";

function resolveSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      return url.origin;
    } catch (error) {
      console.warn(
        "[metadata] NEXT_PUBLIC_SITE_URL is not a valid absolute URL. Falling back to default.",
        error
      );
    }
  }
  return defaultSiteUrl;
}

const siteUrl = resolveSiteUrl();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Punt",
  description: "Punt – lightweight on-chain prediction markets for streams",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Punt — Live Prediction Markets",
    description: "Watch live pack openings, place private predictions, and follow encrypted bet history.",
    url: siteUrl,
    siteName: "Punt",
    images: [
      {
        url: "/og-image.png",
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Punt social preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Punt — Live Prediction Markets",
    description: "Watch live pack openings, place private predictions, and follow encrypted bet history.",
    images: [
      {
        url: "/og-image.png",
        type: "image/png",
        alt: "Punt social preview",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
