import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import "@/components/betmind/theme.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "BetMind",
    template: "%s · BetMind",
  },
  description: "Analizza · Impara · Vinci — centro di controllo per intelligenza sportiva (solo simulazione)",
  applicationName: "BetMind",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BetMind",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [{ url: "/brand/icon-192.jpg", sizes: "192x192", type: "image/jpeg" }],
    apple: [{ url: "/brand/apple-touch-icon.jpg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${sora.variable} antialiased`}>
      <body className="min-h-full bg-[var(--bm-bg,#0a0a0a)] text-white">
        {children}
      </body>
    </html>
  );
}
