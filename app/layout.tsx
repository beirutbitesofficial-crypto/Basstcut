import type { Metadata, Viewport } from "next";
import { Anton, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const serif = Instrument_Serif({ weight: "400", style: ["italic", "normal"], subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "BASST CUT — Haircut & Style · Abra, Sidon",
  description: "BASST CUT is a barbershop in Abra, Sidon, Lebanon. Precision haircuts, fades, beard trims and styling.",
  openGraph: {
    title: "BASST CUT — Haircut & Style",
    description: "Precision in every cut. Abra, Sidon.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141110",
  width: "device-width",
  initialScale: 1,
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
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
