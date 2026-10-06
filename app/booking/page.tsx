import type { Metadata } from "next";
import Booking from "@/components/Booking";
import InstallApp from "@/components/InstallApp";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book — BASST CUT",
  description: "Book your haircut, fade or beard trim at BASST CUT, Abra, Sidon. Pick a time and get your confirmation on WhatsApp.",
  alternates: { canonical: "/booking/" },
};

export default function BookingPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-offwhite/10 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3 md:px-12">
          <a href="/" className="flex items-center gap-3" aria-label="BASST CUT home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/basst-cut-logo-640.webp"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11"
              style={{ clipPath: "circle(47.3% at 50% 50%)" }}
            />
            <span className="font-display text-xl uppercase tracking-tight">
              Basst <span className="text-terracotta">Cut</span>
            </span>
          </a>
          <span className="flex-1" />
          <InstallApp />
        </div>
      </header>
      <main>
        <Booking />
      </main>
      <footer className="border-t border-offwhite/10 px-5 py-8 font-sans text-xs text-beige/60 md:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <span>© BASST CUT · {site.location}</span>
          <span className="flex gap-6">
            <a href="/" className="hover:text-offwhite">Website</a>
            <a href={site.directionsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-offwhite">
              Directions
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
