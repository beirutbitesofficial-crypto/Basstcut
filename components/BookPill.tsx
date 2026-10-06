"use client";

import { useRef } from "react";
import { gsap, MQ, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { bookingHref } from "@/lib/site";

/** Floating "Book" button on the landing page — appears after the haircut scene. */
export default function BookPill() {
  const pill = useRef<HTMLAnchorElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ, (ctx) => {
      const { reduced } = ctx.conditions as Record<keyof typeof MQ, boolean>;
      if (reduced) {
        gsap.set(pill.current, { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.set(pill.current, { autoAlpha: 0, y: 20 });
      const show = (on: boolean) => gsap.to(pill.current, { autoAlpha: on ? 1 : 0, y: on ? 0 : 20, duration: 0.4, ease: "power2.out", overwrite: true });
      let afterIntro = false;
      let onCta = false;
      ScrollTrigger.create({ trigger: "#about", start: "top bottom", end: "max", onToggle: (s) => ((afterIntro = s.isActive), show(afterIntro && !onCta)) });
      ScrollTrigger.create({ trigger: "#book", start: "top 80%", end: "bottom 20%", onToggle: (s) => ((onCta = s.isActive), show(afterIntro && !onCta)) });
    });
    return () => mm.revert();
  });

  return (
    <a
      ref={pill}
      href={bookingHref()}
      className="invisible fixed bottom-5 right-5 z-50 flex min-h-12 items-center gap-2 rounded-full bg-terracotta px-6 font-sans text-xs font-bold uppercase tracking-[0.3em] text-ink shadow-[0_12px_30px_-8px_rgba(239,98,64,0.6)] md:bottom-8 md:right-8"
    >
      Book
      <svg className="h-3 w-5" viewBox="0 0 24 12" fill="none" aria-hidden="true">
        <path d="M0 6 H22 M17 1 L22 6 L17 11" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </a>
  );
}
