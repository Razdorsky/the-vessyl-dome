import type { Metadata } from "next";
import "./globals.css";

const TYPOGRAPHY_PROFILE: "legacy" | "updated" = "updated";

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://thevessyl.com",
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "The Vessyl — Arenal, Costa Rica",
    template: "%s | The Vessyl",
  },
  description:
    "An immersive wellness resort in Arenal, Costa Rica, where nature, sound, vibration, and light create the conditions for deep restoration and expanded awareness.",
  applicationName: "The Vessyl",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "The Vessyl",
    "Arenal",
    "Costa Rica",
    "immersive wellness",
    "The Dome",
    "spatial sound",
    "wellness resort",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "The Vessyl",
    title: "The Vessyl — Not a Vacation. A Recalibration.",
    description:
      "Enter The Dome: a full-body environment of spatial sound, vibration, light, and nature in Arenal, Costa Rica.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Conceptual visualization of The Dome in the Arenal rainforest",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Vessyl — Not a Vacation. A Recalibration.",
    description:
      "An immersive wellness experience shaped by nature, sound, vibration, and light.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  }>) {
  return (
    <html lang="en" data-typography={TYPOGRAPHY_PROFILE}>
      <head>
        <link rel="icon" href="/vessyl-mark.svg" type="image/svg+xml" />
        <link
          rel="preload"
          href="/fonts/manrope-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/prata-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
