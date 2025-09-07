import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import GlobalTriggersClient from "@/components/GlobalTriggersClient";
import ThemeInit from "@/components/ThemeInit";
import { Toaster } from "@/components/ui/sonner";
import { SPAProvider } from "@/components/SPAProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Millennial Reign App",
  description: "PWA with Supabase auth and offline support",
  applicationName: "Millennial Reign App",
  // Ensure browsers can discover the PWA manifest on every route.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      "/favicon.ico",
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#000000" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Explicitly include manifest link to ensure it loads on all routes */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeInit />
        <SPAProvider>
          <AppChrome>{children}</AppChrome>
          {/* Global client-side triggers (portaled) */}
          <GlobalTriggersClient />
        </SPAProvider>
        {/* Toast notifications (auto dark/light) */}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}

// Enable iOS safe-area env vars (for bottom nav padding)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
