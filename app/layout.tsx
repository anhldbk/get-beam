import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from '@vercel/speed-insights/next';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://get-beam.vercel.app'),
  title: "Beam - Private File Transfer | No Trace, Offline, Secure",
  description: "Transfer files privately using QR codes. No internet, no servers, no trace. Undetectable offline file sharing between nearby devices without detection or surveillance.",
  keywords: "private file transfer, QR code sharing, offline file transfer, no trace file sharing, anonymous file transfer, secure file sharing, privacy file transfer, local file transfer, surveillance-free sharing",
  authors: [{ name: "Beam" }],
  creator: "Beam",
  publisher: "Beam",
  applicationName: "Beam",
  category: "Privacy Software",
  classification: "File Transfer Application",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Beam",
    title: "Beam - Private QR Code File Transfer | No Trace, Offline, Secure",
    description: "Transfer files privately using QR codes. No internet, no servers, no trace. Undetectable offline file sharing between nearby devices.",
    url: "https://get-beam.vercel.app",
    images: [
      {
        url: "/og-beam.png",
        width: 1200,
        height: 630,
        alt: "Beam - Private File Transfer Using QR Codes",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beam - Private QR Code File Transfer",
    description: "Transfer files privately using QR codes. No internet, no servers, no trace.",
    images: ["/og-beam.png"],
    creator: "@beam_transfers",
    site: "@beam_transfers",
  },
  verification: {
    google: "pgyGtTbMUfNY-_rOkSB82-o0Km_mWXjQ-1NYnvS-0k",
  },
  alternates: {
    canonical: "https://get-beam.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Beam",
    "applicationCategory": "UtilitiesApplication",
    "applicationSubCategory": "File Transfer",
    "operatingSystem": "Web Browser",
    "description": "Private, secure file transfer application that uses QR codes for offline, peer-to-peer file sharing without internet connection or servers. No trace, no detection, complete privacy.",
    "url": "https://get-beam.vercel.app",
    "downloadUrl": "https://get-beam.vercel.app",
    "installUrl": "https://get-beam.vercel.app",
    "screenshot": "https://get-beam.vercel.app/screenshot.png",
    "featureList": [
      "QR Code File Transfer",
      "Offline File Sharing",
      "No Internet Required",
      "No Server Storage",
      "Anonymous File Transfer",
      "Surveillance-Free Sharing",
      "No Trace File Transfer"
    ],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Beam"
    },
    "author": {
      "@type": "Organization",
      "name": "Beam"
    },
    "maintainer": {
      "@type": "Organization",
      "name": "Beam"
    },
    "isAccessibleForFree": true,
    "softwareRequirements": "Web Browser with Camera Support",
    "permissions": "Camera Access",
    "releaseNotes": "Privacy-focused file transfer using QR codes"
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
