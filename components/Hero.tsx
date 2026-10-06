"use client";

import { useRef } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import Logo from "./Logo";
import { BrushSlashes } from "./Brush";

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);

      mm.add(MQ, (context) => {
        const { desktop, reduced } = context.conditions as Record<keyof typeof MQ, boolean>;

        if (reduced) {
          gsap.set(q(".hero-reveal"), { autoAlpha: 1 });
          gsap.set(q(".logo-ring"), { strokeDashoffset: 0 });
          return;
        }

        // ---- Intro on load ----
        const intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 });
        intro
          .set(q(".hero-reveal"), { autoAlpha: 1 })
          .fromTo(q(".hero-bg"), { scale: 1.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.6 }, 0)
          .fromTo(q(".hero-light"), { autoAlpha: 0, yPercent: -10 }, { autoAlpha: 1, yPercent: 0, duration: 2.2, ease: "power2.out" }, 0.4)
          .fromTo(q(".hero-grain"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6, ease: "none" }, 0.2)
          .fromTo(q(".logo-ring"), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2, ease: "power3.inOut" }, 0.4)
          // Badge opens like an iris, settling from a slight zoom
          .fromTo(q(".logo-img"), { clipPath: "circle(0% at 50% 50%)", scale: 1.15 }, { clipPath: "circle(47.3% at 50% 50%)", scale: 1, duration: 1.8, ease: "expo.inOut" }, 0.6)
          .fromTo(q(".hero-loc"), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 1.8)
          .fromTo(q(".hero-corner"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, stagger: 0.1, ease: "power2.out" }, 2.0)
          .fromTo(q(".hero-scroll"), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1 }, 2.2);

        // ---- Scroll out: content lifts away, backdrop drifts slower ----
        const out = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        out
          .to(q(".hero-content"), { yPercent: -28, autoAlpha: 0 }, 0)
          .to(q(".hero-bg-inner"), { yPercent: 18, scale: 1.08 }, 0)
          .to(q(".hero-chrome"), { autoAlpha: 0, duration: 0.3 }, 0);

        // ---- Subtle pointer parallax (desktop only) ----
        if (desktop) {
          const layers = [
            { el: q(".hero-bg-inner")[0], depth: 14 },
            { el: q(".hero-light")[0], depth: 26 },
            { el: q(".hero-logo")[0], depth: -10 },
          ].map(({ el, depth }) => ({
            depth,
            x: gsap.quickTo(el, "x", { duration: 1.2, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 1.2, ease: "power3.out" }),
          }));
          const onMove = (e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            layers.forEach((l) => {
              l.x(nx * l.depth);
              l.y(ny * l.depth);
            });
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          return () => window.removeEventListener("pointermove", onMove);
        }
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section
      ref={root}
      id="top"
      className="relative h-screen-s w-full overflow-hidden bg-ink text-offwhite"
      aria-label="BASST CUT — Haircut & Style, Abra, Sidon"
    >
      {/* Backdrop — replace HeroBackdrop with a <Image fill priority /> of the shop if desired */}
      <div className="hero-bg hero-reveal absolute inset-0 invisible-pre">
        <div className="hero-bg-inner absolute -inset-[6%] will-change-transform">
          <HeroBackdrop />
        </div>
      </div>
      <div
        className="hero-light hero-reveal pointer-events-none absolute -inset-x-[10%] -top-[10%] h-[80%] invisible-pre"
        style={{
          background:
            "radial-gradient(ellipse 40% 55% at 50% 30%, rgba(239, 98, 64,0.28), transparent 70%), radial-gradient(ellipse 22% 40% at 50% 10%, rgba(244,240,232,0.10), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="hero-grain hero-reveal pointer-events-none absolute inset-0 texture-scratch opacity-60 invisible-pre" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 vignette" aria-hidden="true" />

      {/* Content */}
      <div className="hero-content relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <h1 className="sr-only">BASST CUT — Haircut &amp; Style, Abra, Sidon</h1>
        <div className="hero-logo hero-reveal invisible-pre w-[min(78vw,46svh)] md:w-[min(34vw,52vh)]">
          <Logo className="w-full" priority />
        </div>
        <p className="hero-loc hero-reveal invisible-pre mt-6 flex items-center gap-4 font-sans text-[11px] font-semibold uppercase tracking-[0.5em] text-beige/80 md:mt-8 md:text-xs">
          <span className="h-px w-8 bg-terracotta/70 md:w-12" />
          Abra, Sidon
          <span className="h-px w-8 bg-terracotta/70 md:w-12" />
        </p>
      </div>

      <div className="hero-chrome pointer-events-none absolute inset-0 z-10">
        {/* Orange dry-brush scratches on the edges, as on the BASST CUT posters */}
        <BrushSlashes className="hero-corner hero-reveal invisible-pre absolute -left-6 top-[18%] h-[38%] text-terracotta/45 md:left-0 md:h-[48%]" />
        <BrushSlashes className="hero-corner hero-reveal invisible-pre absolute -right-6 bottom-[8%] h-[34%] rotate-180 text-terracotta/40 md:right-0 md:h-[44%]" />
        {/* Corners — tiny editorial details */}
        <div className="hero-corner hero-reveal invisible-pre absolute left-5 top-5 font-sans text-[11px] uppercase tracking-[0.4em] text-offwhite/50 md:left-10 md:top-8">
          Barbershop
        </div>
        <div className="hero-corner hero-reveal invisible-pre absolute right-5 top-5 font-sans text-[11px] uppercase tracking-[0.4em] text-offwhite/50 md:right-10 md:top-8">
          Lebanon
        </div>

        {/* Scroll indicator */}
        <div className="hero-scroll hero-reveal invisible-pre absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 md:bottom-8">
          <span className="font-sans text-[11px] uppercase tracking-[0.5em] text-offwhite/60">Scroll to discover</span>
          <span className="relative block h-10 w-px overflow-hidden bg-offwhite/15">
            <span className="scroll-tick absolute inset-x-0 top-0 h-1/2 bg-terracotta" />
          </span>
        </div>
      </div>
    </section>
  );
}

/** Cinematic stand-in for a shop photo: receding arches, warm floor light, mirror haze. */
function HeroBackdrop() {
  const arches = [0, 1, 2, 3, 4, 5];
  return (
    <svg className="h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hb-floor" cx="0.5" cy="1" r="0.7">
          <stop offset="0" stopColor="#EF6240" stopOpacity=".35" />
          <stop offset="0.5" stopColor="#3a1d15" stopOpacity=".3" />
          <stop offset="1" stopColor="#141110" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141312" />
          <stop offset="0.6" stopColor="#141110" />
          <stop offset="1" stopColor="#24170f" />
        </linearGradient>
        <linearGradient id="hb-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EBDFD0" stopOpacity=".12" />
          <stop offset="1" stopColor="#EBDFD0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#hb-wall)" />
      {/* receding arches */}
      <g fill="none" stroke="#EF6240">
        {arches.map((i) => {
          const s = 1 - i * 0.14;
          const w = 760 * s;
          const h = 900 * s;
          const x = 800 - w / 2;
          const y = 1000 - h + i * 18;
          const r = w / 2;
          return (
            <path
              key={i}
              d={`M${x} 1000 V${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V1000`}
              strokeOpacity={0.32 - i * 0.045}
              strokeWidth={2.2 - i * 0.25}
            />
          );
        })}
      </g>
      {/* side arches / mirrors */}
      <g fill="#EBDFD0" fillOpacity=".025" stroke="#EBDFD0" strokeOpacity=".08">
        <path d="M70 1000 V560 a110 110 0 0 1 220 0 V1000 Z" />
        <path d="M1310 1000 V560 a110 110 0 0 1 220 0 V1000 Z" />
      </g>
      {/* light beams */}
      <path d="M690 0 L910 0 L1120 1000 L480 1000 Z" fill="url(#hb-beam)" />
      <rect y="560" width="1600" height="440" fill="url(#hb-floor)" />
      <path d="M0 905 H1600" stroke="#EBDFD0" strokeOpacity=".07" />
    </svg>
  );
}
