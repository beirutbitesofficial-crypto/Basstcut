import type { Metadata, Viewport } from "next";
import { Anton, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const serif = Instrument_Serif({ weight: "400", style: ["italic", "normal"], subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://basstcut.com"),
  manifest: "/manifest.webmanifest",
  applicationName: "BASST CUT",
  appleWebApp: { capable: true, title: "BASST CUT", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  title: "BASST CUT — Haircut & Style · Abra, Sidon",
  description: "BASST CUT is a barbershop in Abra, Sidon, Lebanon. Precision haircuts, fades, beard trims and styling.",
  openGraph: {
    title: "BASST CUT — Haircut & Style",
    description: "Precision in every cut. Abra, Sidon.",
    type: "website",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "BASST CUT — Haircut & Style" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#141110",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks JS as available before paint so intro elements can start hidden without a flash. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="bg-ink font-sans text-offwhite antialiased">
        {children}
        <PwaRegister />
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
