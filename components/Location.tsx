"use client";

import { useRef } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import { site } from "@/lib/site";
import { SplitWords } from "./SplitText";

export default function Location() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);

      mm.add(MQ, (context) => {
        const { desktop, reduced } = context.conditions as Record<keyof typeof MQ, boolean>;
        if (reduced) {
          gsap.set(q(".lc-road"), { strokeDashoffset: 0 });
          return;
        }

        // Doorway: the arch frame grows out of the dark as the section arrives.
        gsap.fromTo(
          q(".lc-arch"),
          { scale: desktop ? 0.72 : 0.86, yPercent: desktop ? 18 : 10 },
          {
            scale: 1,
            yPercent: 0,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: desktop ? "top top" : "top 20%", scrub: true },
          }
        );
        gsap.fromTo(
          q(".lc-map"),
          { scale: 1.25 },
          { scale: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "center center", scrub: true } }
        );

        // Heading words
        gsap.fromTo(
          q(".lc-title .word"),
          { yPercent: 115 },
          {
            yPercent: 0,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: { trigger: q(".lc-title")[0], start: "top 90%", end: "top 45%", scrub: 0.8 },
          }
        );
        gsap.fromTo(
          q(".lc-meta"),
          { y: 30, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.1, scrollTrigger: { trigger: q(".lc-title")[0], start: "top 60%", end: "bottom 40%", scrub: 0.6 } }
        );

        // Roads draw themselves, then the pin drops.
        gsap.fromTo(
          q(".lc-road"),
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, stagger: 0.08, ease: "none", scrollTrigger: { trigger: q(".lc-arch")[0], start: "top 75%", end: "center 45%", scrub: true } }
        );
        gsap.fromTo(
          q(".lc-pin"),
          { y: -40, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, ease: "back.out(2)", scrollTrigger: { trigger: q(".lc-arch")[0], start: "center 70%", end: "center 50%", scrub: 0.5 } }
        );

        // Background arches drift at different depths.
        q(".lc-bg-arch").forEach((el, i) => {
          gsap.fromTo(
            el,
            { yPercent: 10 + i * 8 },
            {
              yPercent: -(10 + i * 8) * (desktop ? 1 : 0.4),
              ease: "none",
              scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
            }
          );
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} id="location" className="relative overflow-hidden bg-ink py-24 text-offwhite md:py-36">
      {/* Background arches */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="lc-bg-arch arch absolute -left-[20vw] top-[10%] h-[90vh] w-[50vw] border border-b-0 border-terracotta/15" />
        <div className="lc-bg-arch arch absolute -right-[10vw] top-[30%] h-[80vh] w-[36vw] border border-b-0 border-beige/10" />
        <div className="absolute inset-0 texture-scratch opacity-30" />
      </div>

      <div className="relative mx-auto grid max-w-[1400px] items-center gap-16 px-5 md:px-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="lc-meta mb-6 font-sans text-[10px] uppercase tracking-[0.45em] text-terracotta md:text-xs">N°04 — Location</p>
          <h2 className="lc-title font-display uppercase leading-[0.85] tracking-tight text-[19vw] lg:text-[8.6vw]">
            <span className="block">
              <SplitWords text="Find" />
            </span>
            <span className="block">
              <SplitWords text="your next" />
            </span>
            <span className="block">
              <SplitWords text="cut" />
              <span className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                <span className="word inline-block text-terracotta">.</span>
              </span>
            </span>
          </h2>

          <div className="mt-10 flex flex-col gap-8 md:mt-14 md:flex-row md:items-end md:gap-14">
            <div className="lc-meta">
              <p className="font-sans text-sm font-semibold uppercase tracking-[0.45em] text-beige">{site.location}</p>
              <p className="mt-2 font-serif text-lg italic text-offwhite/60">{site.country}</p>
            </div>
            <a
              href={site.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lc-meta group inline-flex min-h-14 items-center gap-4 self-start rounded-full border border-terracotta px-7 py-4 font-sans text-xs font-semibold uppercase tracking-[0.35em] text-offwhite transition-colors duration-500 hover:bg-terracotta focus-visible:bg-terracotta focus-visible:outline-none"
            >
              Get directions
              <svg className="h-3 w-6 transition-transform duration-500 group-hover:translate-x-1" viewBox="0 0 24 12" fill="none" aria-hidden="true">
                <path d="M0 6 H22 M17 1 L22 6 L17 11" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </a>
          </div>
        </div>

        <div className="lg:col-span-6 lg:pl-8">
          <a
            href={site.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open BASST CUT in Google Maps"
            className="lc-arch arch group relative mx-auto block aspect-[4/5] w-full max-w-[520px] overflow-hidden bg-beige will-change-transform"
          >
            <div className="lc-map absolute inset-0 will-change-transform">
              <StylizedMap />
            </div>
            <span className="absolute inset-x-0 bottom-0 h-[16%] bg-terracotta" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-[16%] h-px bg-ink/30" aria-hidden="true" />
            <span className="absolute bottom-[5%] left-0 right-0 text-center font-sans text-[10px] uppercase tracking-[0.45em] text-offwhite">
              33.55° N · 35.40° E
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/** Stylized map of Sidon & Abra — coast on the left, hills to the east. */
function StylizedMap() {
  return (
    <svg className="h-full w-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="500" fill="#E8D9C4" />
      {/* sea */}
      <path d="M0 0 H96 C86 70 112 120 92 180 C74 236 104 300 84 360 C70 410 88 460 80 500 H0 Z" fill="#1E1E1E" fillOpacity=".9" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M8 ${40 + i * 52} q12 -6 24 0 t24 0`} stroke="#E8D9C4" strokeOpacity=".18" fill="none" />
      ))}
      <text x="22" y="470" fill="#E8D9C4" fillOpacity=".5" fontSize="9" letterSpacing="3" style={{ fontFamily: "var(--font-sans)" }}>
        MEDITERRANEAN
      </text>

      {/* contour lines (hills of Abra) */}
      <g fill="none" stroke="#C25A43" strokeOpacity=".22">
        <path d="M200 120 C260 90 340 110 380 160 C400 200 380 260 330 270 C270 280 220 240 200 200 C188 170 186 140 200 120 Z" />
        <path d="M225 140 C270 120 330 135 355 170 C370 200 350 240 315 245 C270 250 240 225 228 195 C220 175 218 155 225 140 Z" />
        <path d="M252 162 C280 150 318 160 332 182 C340 200 326 222 302 223 C276 224 258 210 252 190 Z" />
      </g>

      {/* roads */}
      <g fill="none" stroke="#1E1E1E" strokeLinecap="round">
        <path className="lc-road" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d="M118 0 C110 90 132 160 116 240 C104 310 124 400 110 500" strokeWidth="5" />
        <path className="lc-road" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d="M120 230 C170 222 210 210 250 196 C290 182 330 186 400 170" strokeWidth="3" />
        <path className="lc-road" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d="M128 330 C180 320 220 290 262 250 C280 232 300 226 340 236" strokeWidth="2" strokeOpacity=".7" />
        <path className="lc-road" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d="M180 90 C200 140 230 190 258 210 C280 226 290 280 300 360 C306 410 330 450 360 500" strokeWidth="1.5" strokeOpacity=".55" />
        <path className="lc-road" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d="M150 140 C190 150 220 150 260 140" strokeWidth="1.2" strokeOpacity=".45" />
      </g>

      {/* labels */}
      <g style={{ fontFamily: "var(--font-sans)" }} fontSize="10" letterSpacing="3" fill="#1E1E1E">
        <text x="130" y="262" fillOpacity=".6">SIDON</text>
        <text x="282" y="158" fontWeight="700">ABRA</text>
      </g>

      {/* pin */}
      <g className="lc-pin">
        <circle cx="268" cy="200" r="22" fill="#C25A43" fillOpacity=".18" className="pin-pulse" style={{ transformOrigin: "268px 200px" }} />
        <path d="M268 204 C258 190 252 182 252 174 a16 16 0 0 1 32 0 C284 182 278 190 268 204 Z" fill="#C25A43" />
        <circle cx="268" cy="174" r="5.5" fill="#F4F0E8" />
        <text x="268" y="226" textAnchor="middle" fontSize="9" letterSpacing="2.5" fontWeight="700" fill="#1E1E1E" style={{ fontFamily: "var(--font-sans)" }}>
          BASST CUT
        </text>
      </g>
    </svg>
  );
}
