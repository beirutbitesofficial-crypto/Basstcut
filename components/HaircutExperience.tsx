"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MQ, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { HairScene, type CutLine, type Snip } from "@/lib/hair";
import Scissors, { BLADE_REACH, PIVOT_X, PIVOT_Y, SCISSORS_VIEWBOX } from "./Scissors";
import { SplitChars } from "./SplitText";
import { BrushStroke } from "./Brush";

/*
 * TIMELINE MAP (timeline seconds, scrubbed by scroll)
 *  0.0 – 0.8   scissors slide in along the lower cut line
 *  0.8 – 3.8   pass 1: open / move / snip — lower hair falls, "PRECISION" revealed
 *  3.8 – 4.4   scissors exit right
 *  4.6 – 5.2   scissors re-enter from the right on the upper cut line
 *  5.2 – 8.2   pass 2: the rest of the hair falls, brand is revealed
 *  8.2 – 9.0   scissors flourish out
 *  9.0 – 10.2  hold on the brand
 * 10.2 – 12.0  arch doorway grows and hands over to the About section
 */
const T = {
  enter1: [0, 0.8],
  pass1: [0.8, 3.8],
  exit1: [3.8, 4.4],
  enter2: [4.6, 5.2],
  pass2: [5.2, 8.2],
  exit2: [8.2, 9.0],
  arch: [10.2, 12],
} as const;

const CUTS: { desktop: [CutLine, CutLine]; mobile: [CutLine, CutLine] } = {
  desktop: [
    { y0: 0.665, y1: 0.585 },
    { y0: 0.2, y1: 0.29 },
  ],
  mobile: [
    { y0: 0.635, y1: 0.6 },
    { y0: 0.25, y1: 0.3 },
  ],
};

const OPEN_DEG = 21;

type PassPlan = {
  snips: Snip[];
  /** pivot positions in pass space (u), k = 0..n */
  stops: number[];
  d: number;
};

/** Plan where each scissors close happens and which hair it cuts. */
function planPass(W: number, reach: number, dir: 1 | -1, start: number, dur: number, n: number): PassPlan {
  const pStart = -reach * 0.3;
  const pEnd = W - reach * 0.55;
  const stops = Array.from({ length: n + 1 }, (_, k) => pStart + ((pEnd - pStart) * k) / n);
  const front = stops.map((p) => p + reach * 0.95);
  const d = dur / (n + 0.35);
  const toX = (u: number) => (dir === 1 ? u : W - u);

  const snips: Snip[] = stops.map((_, k) => {
    const a = k === 0 ? -1e5 : front[k - 1];
    const b = k === n ? 1e5 : front[k];
    return { time: start + k * d + d * 0.32, from: toX(a), to: toX(b) };
  });
  return { snips, stops, d };
}

export default function HaircutExperience() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scissorsEl = useRef<HTMLDivElement>(null);
  const halfA = useRef<SVGGElement>(null);
  const halfB = useRef<SVGGElement>(null);
  // Bumped on real resizes only (mobile address-bar height changes are ignored).
  const [sizeKey, setSizeKey] = useState(0);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const keyOf = () => (touch ? `${window.innerWidth}` : `${window.innerWidth}x${window.innerHeight}`);
    let last = keyOf();
    let id = 0;
    const onResize = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => {
        const next = keyOf();
        if (next !== last) {
          last = next;
          setSizeKey((k) => k + 1);
        }
      }, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(id);
    };
  }, []);

  useGSAP(
    () => {
      if (!root.current || !canvas.current) return;
      const mm = gsap.matchMedia();

      mm.add(MQ, (context) => {
        const { desktop, mobile, reduced } = context.conditions as Record<keyof typeof MQ, boolean>;
        const section = root.current!;
        const q = gsap.utils.selector(section);
        const W = section.clientWidth;
        const H = section.clientHeight;
        const isMobile = !!mobile || (!!reduced && W < 1024);
        const cuts = isMobile ? CUTS.mobile : CUTS.desktop;

        // Scissors geometry in CSS px
        const sw = isMobile ? Math.min(W * 0.8, 360) : gsap.utils.clamp(400, 620, W * 0.38);
        const sh = (sw * SCISSORS_VIEWBOX.h) / SCISSORS_VIEWBOX.w;
        const reach = (sw * BLADE_REACH) / SCISSORS_VIEWBOX.w;
        const px = (sw * PIVOT_X) / SCISSORS_VIEWBOX.w;
        const py = (sh * PIVOT_Y) / SCISSORS_VIEWBOX.h;
        const sEl = scissorsEl.current!;
        gsap.set(sEl, { width: sw, height: sh, transformOrigin: `${px}px ${py}px` });

        const n = isMobile ? 5 : 7;
        const p1 = planPass(W, reach, 1, T.pass1[0], T.pass1[1] - T.pass1[0], n);
        const p2 = planPass(W, reach, -1, T.pass2[0], T.pass2[1] - T.pass2[0], n);

        const hair = new HairScene(canvas.current!, {
          width: W,
          height: H,
          dpr: Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2),
          mobile: isMobile,
          cuts,
          snips: [p1.snips, p2.snips],
        });

        // ---- Scissors state, written to the DOM in one place ----
        const S = { u: -sw, pass: 0, open: 0.3, lift: 0, spin: 0, alpha: 1 };
        const slope = [0, 1].map((i) => Math.atan2((cuts[i].y1 - cuts[i].y0) * H, W) * (180 / Math.PI));

        const drawScissors = () => {
          const pass = S.pass as 0 | 1;
          const x = pass === 0 ? S.u : W - S.u;
          const y = hair.cutY(pass, x) + S.lift;
          const flip = pass === 0 ? 1 : -1;
          const bob = Math.sin(S.u * 0.018) * 3;
          sEl.style.transform = `translate3d(${x - px}px, ${y - py + bob}px, 0) rotate(${slope[pass] + S.spin}deg) scale(${flip}, 1)`;
          sEl.style.opacity = String(S.alpha);
          const a = S.open * OPEN_DEG;
          halfA.current?.setAttribute("transform", `rotate(${-a} ${PIVOT_X} ${PIVOT_Y})`);
          halfB.current?.setAttribute("transform", `rotate(${a} ${PIVOT_X} ${PIVOT_Y})`);
        };

        if (reduced) {
          // Static, already-cut composition: clean fringe, brand visible, shears resting.
          hair.render(100);
          gsap.set(q(".hx-hint, .hx-text1, .hx-hud, .hx-arch"), { autoAlpha: 0 });
          gsap.set(sEl, {
            x: W - sw * (isMobile ? 0.85 : 0.75),
            y: H - sh * (isMobile ? 1.6 : 1.9),
            rotation: -14,
            opacity: 1,
          });
          return;
        }

        // ---- Initial states ----
        gsap.set(q(".hx-line"), { yPercent: 110 });
        gsap.set(q(".hx-brand .char"), { yPercent: 115, rotate: 4 });
        gsap.set(q(".hx-sub"), { autoAlpha: 0, y: 24 });
        gsap.set(q(".hx-rule"), { scaleX: 0 });
        gsap.set(q(".hx-arch-line"), { yPercent: 100, scale: 1 });
        gsap.set(q(".hx-arch-fill"), { yPercent: 100, scale: 1 });
        gsap.set(q(".hx-bar"), { scaleX: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: () => {
            drawScissors();
            hair.render(tl.time());
          },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${H * (isMobile ? 5 : 6)}`,
            pin: true,
            scrub: isMobile ? 0.6 : 1,
            anticipatePin: 1,
            // Everything below depends on this pin's spacer — measure it first.
            refreshPriority: 3,
          },
        });

        const addPass = (plan: PassPlan, enter: readonly [number, number], exit: readonly [number, number]) => {
          tl.to(S, { u: plan.stops[0], open: 1, duration: enter[1] - enter[0], ease: "power2.out" }, enter[0]);
          plan.stops.forEach((stop, k) => {
            const t0 = plan.snips[k].time - plan.d * 0.32;
            // Snap shut — this is the cut.
            tl.to(S, { open: 0, duration: plan.d * 0.35, ease: "power3.in" }, t0);
            if (k < plan.stops.length - 1) {
              // Re-open while gliding to the next position.
              tl.to(S, { open: 1, duration: plan.d * 0.5, ease: "power2.out" }, t0 + plan.d * 0.38);
              tl.to(S, { u: plan.stops[k + 1], duration: plan.d * 0.6, ease: "power2.inOut" }, t0 + plan.d * 0.38);
            }
          });
          tl.to(S, { u: W + sw * 0.7, duration: exit[1] - exit[0], ease: "power2.in" }, exit[0]);
        };

        // Pass 1 — lower line, left to right
        addPass(p1, T.enter1, T.exit1);
        // Swap to pass 2 (instant, reverses cleanly when scrubbing back)
        tl.set(S, { pass: 1, u: -sw, open: 0.3 }, 4.5);
        addPass(p2, T.enter2, [T.exit2[0], T.exit2[1]]);
        // Exit flourish: rise and spin away
        tl.to(S, { lift: -H * 0.12, spin: -28, duration: T.exit2[1] - T.exit2[0], ease: "power2.in" }, T.exit2[0]);

        // Hint & HUD
        tl.to(q(".hx-hint"), { autoAlpha: 0, y: -20, duration: 0.5 }, 0.15);
        tl.to(q(".hx-bar"), { scaleX: 1, duration: T.exit2[1] }, 0);
        tl.to(q(".hx-hud"), { autoAlpha: 0, duration: 0.5 }, 9.4);

        // Reveal 1 — PRECISION IN EVERY CUT.
        tl.to(q(".hx-line"), { yPercent: 0, duration: 0.9, stagger: 0.25, ease: "power3.out" }, 2.1);
        tl.to(q(".hx-line"), { yPercent: -110, duration: 0.7, stagger: 0.1, ease: "power2.in" }, 5.6);

        // Reveal 2 — the brand
        tl.to(q(".hx-brand .char"), { yPercent: 0, rotate: 0, duration: 1, stagger: 0.07, ease: "power3.out" }, 7.0);
        tl.to(q(".hx-sub"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.15, ease: "power2.out" }, 8.2);
        tl.to(q(".hx-rule"), { scaleX: 1, duration: 0.9, ease: "power2.inOut" }, 8.6);

        // Doorway transition into the dark About section
        const [a0, a1] = T.arch;
        tl.to(q(".hx-content"), { scale: 0.94, yPercent: -4, duration: a1 - a0, ease: "power1.in" }, a0);
        tl.to(q(".hx-arch-line"), { yPercent: 0, duration: 0.6, ease: "power2.out" }, a0);
        tl.to(q(".hx-arch-line"), { scale: 3.8, duration: 1.2, ease: "power2.in" }, a0 + 0.5);
        tl.to(q(".hx-arch-fill"), { yPercent: 0, duration: 0.6, ease: "power2.out" }, a0 + 0.2);
        tl.to(q(".hx-arch-fill"), { scale: 3.8, duration: 1.1, ease: "power2.in" }, a0 + 0.7);

        drawScissors();
        hair.render(0);
      });

      // After a rebuild, sections below must re-measure against the new pin spacer.
      if (sizeKey > 0) {
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
      }

      return () => mm.revert();
    },
    { scope: root, dependencies: [sizeKey], revertOnUpdate: true }
  );

  return (
    <section
      ref={root}
      id="experience"
      aria-label="Precision in every cut"
      className="relative h-screen-l w-full overflow-hidden bg-beige text-ink"
    >
      {/* ---------- Layer 1: what lies beneath the hair ---------- */}
      <div className="hx-content absolute inset-0 will-change-transform">
        <div className="absolute inset-0 texture-paper" aria-hidden="true" />
        <BeneathArches />

        {/* Reveal 1 */}
        <div className="hx-text1 absolute inset-x-0 bottom-safe px-5 md:px-12">
          <div className="flex items-end justify-between gap-6">
            <h2 className="font-display uppercase leading-[0.86] tracking-tight text-[min(14.5vw,12.5vh)] md:text-[min(9vw,13vh)]">
              <span className="block overflow-hidden pb-[0.04em]">
                <span className="hx-line block">Precision</span>
              </span>
              <span className="block overflow-hidden pb-[0.04em]">
                <span className="hx-line block">
                  In every cut<span className="text-terracotta">.</span>
                </span>
              </span>
            </h2>
            <p className="hidden md:block max-w-[16rem] pb-3 text-right font-sans text-xs uppercase tracking-[0.3em] text-ink/60">
              <span className="block overflow-hidden">
                <span className="hx-line block">N°01 — The cut</span>
              </span>
            </p>
          </div>
        </div>

        {/* Reveal 2 */}
        <div className="hx-brand absolute inset-x-0 top-[34%] flex flex-col items-center px-5 text-center md:top-[36%]">
          <p className="hx-sub mb-4 font-sans text-[10px] uppercase tracking-[0.45em] text-ink/60 md:text-xs">
            Precision in every cut
          </p>
          <h2 className="font-display uppercase leading-[0.82] tracking-tight text-[21vw] md:text-[min(15vw,24vh)]">
            <span className="sr-only">BASST CUT</span>
            <span aria-hidden="true" className="flex flex-wrap justify-center gap-x-[0.18em]">
              <SplitChars text="BASST" />
              <SplitChars text="CUT" />
            </span>
          </h2>
          <span className="hx-rule mt-3 block w-52 origin-left text-terracotta md:mt-4 md:w-[26rem]">
            <BrushStroke className="h-4 w-full md:h-7" />
          </span>
          <p className="hx-sub mt-5 font-sans text-xs font-semibold uppercase tracking-[0.5em] text-terracotta md:text-sm">
            Haircut &amp; Style
          </p>
          <p className="hx-sub mt-2 font-serif text-lg italic text-ink/70 md:text-xl">Abra, Sidon</p>
        </div>
      </div>

      {/* ---------- Layer 2: the hair ---------- */}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-ink via-ink/60 to-transparent"
        aria-hidden="true"
      />

      {/* ---------- Layer 3: the shears ---------- */}
      <div
        ref={scissorsEl}
        className="pointer-events-none absolute left-0 top-0 will-change-transform drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]"
        aria-hidden="true"
      >
        <Scissors className="h-full w-full" halfARef={halfA} halfBRef={halfB} />
      </div>

      {/* ---------- HUD ---------- */}
      <div className="hx-hint pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
        <p className="font-sans text-[10px] uppercase tracking-[0.5em] text-offwhite/70 md:text-xs">
          Keep scrolling — the cut begins
        </p>
      </div>
      <div className="hx-hud pointer-events-none absolute right-5 top-5 flex items-center gap-3 md:right-12 md:top-8">
        <span className="font-sans text-[10px] uppercase tracking-[0.35em] text-offwhite/60 mix-blend-difference">Cut</span>
        <span className="relative block h-px w-20 bg-offwhite/20 md:w-32">
          <span className="hx-bar absolute inset-0 origin-left bg-terracotta" />
        </span>
      </div>

      {/* ---------- Doorway transition ---------- */}
      <div className="hx-arch pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="hx-arch-line arch absolute bottom-0 left-1/2 -ml-[35vmin] h-[92vmin] w-[70vmin] origin-bottom border-2 border-b-0 border-terracotta" />
        <div className="hx-arch-fill arch absolute bottom-0 left-1/2 -ml-[33vmin] h-[88vmin] w-[66vmin] origin-bottom bg-ink" />
      </div>
    </section>
  );
}

/** Faint arch silhouettes on the beige wall — a nod to the shop interior. */
function BeneathArches() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-terracotta"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hx-glow" cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#F6F1EA" stopOpacity=".9" />
          <stop offset="1" stopColor="#EBDFD0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#hx-glow)" />
      <g fill="none" stroke="#8F311C" strokeOpacity=".28" strokeWidth="2">
        <path d="M120 1000 V420 a170 170 0 0 1 340 0 V1000" />
        <path d="M1140 1000 V420 a170 170 0 0 1 340 0 V1000" />
        <path d="M560 1000 V330 a240 240 0 0 1 480 0 V1000" strokeOpacity=".12" />
      </g>
      <path d="M0 960 H1600" stroke="#141110" strokeOpacity=".12" />
    </svg>
  );
}
