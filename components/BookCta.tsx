"use client";

import { useRef } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import { bookingHref } from "@/lib/site";
import { BrushStroke } from "./Brush";
import { SplitWords } from "./SplitText";

/** Landing-page hand-off to the booking app at /booking/. */
export default function BookCta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);
      mm.add(MQ, (ctx) => {
        const { reduced } = ctx.conditions as Record<keyof typeof MQ, boolean>;
        if (reduced) return;
        gsap.fromTo(
          q(".bc-title .word"),
          { yPercent: 115 },
          { yPercent: 0, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: root.current, start: "top 85%", end: "top 40%", scrub: 0.8 } }
        );
        gsap.fromTo(
          q(".bc-fade"),
          { y: 30, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.1, scrollTrigger: { trigger: root.current, start: "top 60%", end: "top 25%", scrub: 0.6 } }
        );
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} id="book" className="relative overflow-hidden bg-ink px-5 py-24 text-offwhite md:px-12 md:py-36">
      <div className="pointer-events-none absolute inset-0 texture-scratch opacity-30" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-6 font-sans text-[11px] uppercase tracking-[0.45em] text-terracotta md:text-xs">N°04 — Booking</p>
          <h2 className="bc-title font-display uppercase leading-[0.85] tracking-tight text-[19vw] lg:text-[9vw]">
            <span className="block">
              <SplitWords text="Reserve" />
            </span>
            <span className="block">
              <SplitWords text="your chair" />
              <span className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                <span className="word inline-block text-terracotta">.</span>
              </span>
            </span>
          </h2>
          <BrushStroke className="bc-fade mt-1 h-4 w-56 text-terracotta md:h-6 md:w-96" />
        </div>
        <div className="bc-fade max-w-md">
          <ol className="space-y-4 font-sans text-sm text-beige/80 md:text-base">
            {[
              ["01", "Pick your cut, day and time."],
              ["02", "The barber confirms your request."],
              ["03", "Your confirmation arrives on WhatsApp."],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-5">
                <span className="font-display text-terracotta">{n}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <a
            href={bookingHref()}
            className="mt-10 flex min-h-14 items-center justify-center gap-4 rounded-full bg-terracotta px-8 font-sans text-xs font-bold uppercase tracking-[0.35em] text-ink transition-transform duration-300 hover:scale-[1.02]"
          >
            Book now
            <svg className="h-3 w-6" viewBox="0 0 24 12" fill="none" aria-hidden="true">
              <path d="M0 6 H22 M17 1 L22 6 L17 11" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
