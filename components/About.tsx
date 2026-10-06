"use client";

import { useRef } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import Scissors, { PIVOT_X, PIVOT_Y, ScissorsOutline } from "./Scissors";
import { SplitWords } from "./SplitText";

/** Loose hair clippings that drift through the section — carried over from the cut. */
const CLIPPINGS = [
  { x: 8, y: 14, r: 20, s: 1.0, speed: 0.6, mobile: true },
  { x: 22, y: 62, r: -35, s: 0.7, speed: 1.3, mobile: false },
  { x: 41, y: 8, r: 70, s: 0.8, speed: 0.9, mobile: true },
  { x: 57, y: 74, r: 10, s: 1.2, speed: 1.6, mobile: true },
  { x: 72, y: 22, r: -60, s: 0.6, speed: 0.7, mobile: false },
  { x: 86, y: 54, r: 35, s: 0.9, speed: 1.2, mobile: true },
  { x: 94, y: 12, r: -15, s: 0.7, speed: 1.9, mobile: false },
  { x: 33, y: 88, r: 50, s: 0.8, speed: 1.1, mobile: false },
];

export default function About() {
  const root = useRef<HTMLElement>(null);
  const halfA = useRef<SVGGElement>(null);
  const halfB = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);

      mm.add(MQ, (context) => {
        const { mobile, reduced } = context.conditions as Record<keyof typeof MQ, boolean>;
        if (reduced) return;

        // Heading words rise in, scrubbed to the scroll.
        gsap.fromTo(
          q(".ab-title .word"),
          { yPercent: 115, rotate: 5 },
          {
            yPercent: 0,
            rotate: 0,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: { trigger: q(".ab-title")[0], start: "top 92%", end: "top 45%", scrub: 0.8 },
          }
        );

        // Body copy lights up word by word.
        gsap.fromTo(
          q(".ab-copy .word"),
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.08,
            scrollTrigger: { trigger: q(".ab-copy")[0], start: "top 85%", end: "bottom 55%", scrub: true },
          }
        );

        gsap.fromTo(
          q(".ab-eyebrow"),
          { autoAlpha: 0, x: -20 },
          { autoAlpha: 1, x: 0, scrollTrigger: { trigger: root.current, start: "top 80%", end: "top 50%", scrub: true } }
        );

        // Background parallax — giant shears outline + drifting clippings.
        gsap.fromTo(
          q(".ab-shears"),
          { yPercent: -10, rotate: -28 },
          {
            yPercent: mobile ? 10 : 30,
            rotate: -8,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
        q(".ab-clip").forEach((el) => {
          const speed = Number((el as HTMLElement).dataset.speed || 1);
          gsap.fromTo(
            el,
            { y: 120 * speed },
            {
              y: -220 * speed * (mobile ? 0.5 : 1),
              rotate: `+=${60 * speed}`,
              ease: "none",
              scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
            }
          );
        });

        gsap.set(q(".ab-dash-cut"), { scaleX: 0 });

        // Small shears travel along the "cut here" line, snipping as they go.
        const snip = { p: 0 };
        gsap.to(snip, {
          p: 1,
          ease: "none",
          scrollTrigger: { trigger: q(".ab-cutline")[0], start: "top 95%", end: "bottom 35%", scrub: 0.6 },
          onUpdate: () => {
            const track = q(".ab-cutline")[0] as HTMLElement;
            const w = track.clientWidth - (q(".ab-mini")[0] as HTMLElement).clientWidth;
            gsap.set(q(".ab-mini"), { x: snip.p * w });
            gsap.set(q(".ab-dash-cut"), { scaleX: snip.p });
            const a = Math.abs(Math.sin(snip.p * Math.PI * 7)) * 22;
            halfA.current?.setAttribute("transform", `rotate(${-a} ${PIVOT_X} ${PIVOT_Y})`);
            halfB.current?.setAttribute("transform", `rotate(${a} ${PIVOT_X} ${PIVOT_Y})`);
          },
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} id="about" className="relative overflow-hidden bg-ink pb-16 pt-24 text-offwhite md:pb-24 md:pt-40">
      {/* Background motifs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <ScissorsOutline className="ab-shears absolute -right-[30%] top-[6%] w-[150%] text-terracotta/[0.09] md:-right-[12%] md:w-[80%]" />
        {CLIPPINGS.map((c, i) => (
          <svg
            key={i}
            data-speed={c.speed}
            className={`ab-clip absolute text-beige/25 ${c.mobile ? "" : "hidden md:block"}`}
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: 36 * c.s, transform: `rotate(${c.r}deg)` }}
            viewBox="0 0 40 12"
            fill="none"
          >
            <path d="M2 8 C12 2 26 2 38 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ))}
        <div className="absolute inset-0 texture-scratch opacity-40" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-5 md:px-12">
        <p className="ab-eyebrow mb-8 font-sans text-[10px] uppercase tracking-[0.45em] text-terracotta md:mb-12 md:text-xs">
          N°02 — BASST CUT
        </p>

        <h2 className="ab-title font-display uppercase leading-[0.86] tracking-tight text-[19vw] md:text-[11.5vw]">
          <span className="block">
            <SplitWords text="More than" />
          </span>
          <span className="block md:pl-[18vw]">
            <SplitWords text="a haircut" />
            <span className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <span className="word inline-block text-terracotta">.</span>
            </span>
          </span>
        </h2>

        <div className="mt-14 grid gap-10 md:mt-24 md:grid-cols-12">
          <div className="hidden md:col-span-4 md:block">
            <span className="block h-px w-24 bg-terracotta/60" />
          </div>
          <div className="ab-copy md:col-span-8">
            <p className="font-serif text-[8.5vw] leading-[1.08] text-offwhite md:text-[3.6vw]">
              <SplitWords text="BASST CUT is about precision, style and confidence." mask={false} />
            </p>
            <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-beige/80 md:mt-8 md:text-lg">
              <SplitWords text="Every cut is shaped around the person wearing it." mask={false} />
            </p>
          </div>
        </div>

        {/* Cut-here line — hands the scissors motif to the services */}
        <div className="ab-cutline relative mt-20 flex h-16 items-center md:mt-32" aria-hidden="true">
          <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-offwhite/25" />
          <span className="ab-dash-cut absolute inset-x-0 top-1/2 h-px origin-left bg-terracotta" />
          <div className="ab-mini relative w-24 md:w-32">
            <Scissors className="h-auto w-full" halfARef={halfA} halfBRef={halfB} />
          </div>
        </div>
      </div>
    </section>
  );
}
