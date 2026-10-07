"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import { bookingHref, services, type Service } from "@/lib/site";
import ServiceArt from "./ServiceArt";
import { SplitChars } from "./SplitText";

export default function Services() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  // Live prices from the booking admin (falls back to lib/site.ts when unavailable).
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/booking/?action=config")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        const map: Record<string, string> = {};
        for (const sv of d.services as { name: string; price: string | null }[]) if (sv.price) map[sv.name.toLowerCase()] = sv.price;
        setPrices(map);
      })
      .catch(() => {});
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);

      // ---------- Desktop: vertical scroll drives a horizontal track ----------
      mm.add(MQ.desktop, () => {
        const el = track.current!;
        const distance = () => el.scrollWidth - window.innerWidth;

        const horizontal = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            refreshPriority: 1,
          },
        });

        gsap.fromTo(
          q(".sv-progress"),
          { scaleX: 0 },
          { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: true } }
        );

        // Heading chars settle in as the section arrives.
        gsap.fromTo(
          q(".sv-title .char"),
          { yPercent: 115 },
          {
            yPercent: 0,
            stagger: 0.04,
            ease: "power3.out",
            scrollTrigger: { trigger: root.current, start: "top 85%", end: "top 15%", scrub: 0.8 },
          }
        );

        // Per-panel motion, tied to the horizontal tween.
        q(".svc").forEach((panel) => {
          const art = panel.querySelector(".svc-parallax");
          const name = panel.querySelector(".svc-name");
          const base = { trigger: panel, containerAnimation: horizontal, scrub: true };
          gsap.fromTo(art, { xPercent: -10 }, { xPercent: 10, ease: "none", scrollTrigger: { ...base, start: "left right", end: "right left" } });
          gsap.fromTo(
            name,
            { xPercent: 18, autoAlpha: 0.2 },
            { xPercent: 0, autoAlpha: 1, ease: "power2.out", scrollTrigger: { ...base, start: "left 95%", end: "left 45%" } }
          );
        });

        gsap.fromTo(
          q(".sv-next-arch"),
          { scale: 0.6, rotate: -6 },
          { scale: 1, rotate: 0, ease: "none", scrollTrigger: { trigger: q(".sv-next")[0], containerAnimation: horizontal, start: "left right", end: "center center", scrub: true } }
        );
      });

      // ---------- Mobile / tablet: vertical editorial stack ----------
      mm.add(MQ.mobile, () => {
        gsap.fromTo(
          q(".sv-title .char"),
          { yPercent: 115 },
          { yPercent: 0, stagger: 0.04, ease: "power3.out", scrollTrigger: { trigger: q(".sv-title")[0], start: "top 90%", end: "top 50%", scrub: 0.6 } }
        );
        q(".svc").forEach((panel) => {
          const art = panel.querySelector(".svc-parallax");
          const name = panel.querySelector(".svc-name");
          const line = panel.querySelector(".svc-line");
          gsap.fromTo(art, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: true } });
          const tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: "top 80%", end: "top 35%", scrub: 0.5 } });
          tl.fromTo(name, { xPercent: -12, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, ease: "power2.out" }).fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: "power2.out" }, 0.2);
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} id="services" className="relative overflow-hidden bg-ink text-offwhite hz:h-screen">
      <div className="pointer-events-none absolute inset-0 texture-scratch opacity-30" aria-hidden="true" />

      <div
        ref={track}
        className="relative flex flex-col gap-20 px-5 py-20 md:px-12 lgr:grid lgr:grid-cols-3 lgr:gap-x-12 lgr:py-32 hz:h-full hz:w-max hz:flex-row hz:items-center hz:gap-[6vw] hz:py-0 hz:pl-12 hz:pr-[10vw] hz:will-change-transform"
      >
        {/* Intro panel */}
        <header className="shrink-0 lgr:col-span-3 hz:w-[40vw]">
          <p className="mb-6 font-sans text-[11px] uppercase tracking-[0.45em] text-terracotta md:text-xs">N°03 — Services</p>
          <h2 className="sv-title font-display uppercase leading-[0.84] tracking-tight text-[20vw] lg:text-[10vw]">
            <span className="sr-only">Choose your cut.</span>
            <span aria-hidden="true" className="block">
              <SplitChars text="CHOOSE" />
            </span>
            <span aria-hidden="true" className="block">
              <SplitChars text="YOUR CUT" />
              <SplitChars text="." className="text-terracotta" />
            </span>
          </h2>
          <p className="mt-8 max-w-sm font-sans text-sm leading-relaxed text-beige/70 md:text-base">
            Six services. One standard. <span className="hidden hz:inline">Keep scrolling →</span>
          </p>
        </header>

        {services.map((s, i) => (
          <ServicePanel key={s.name} service={{ ...s, price: prices[s.name.toLowerCase()] ?? s.price }} index={i} />
        ))}

        {/* Hand-off to Location (desktop) */}
        <div className="sv-next hidden shrink-0 items-center justify-center hz:flex hz:w-[34vw]" aria-hidden="true">
          <div className="sv-next-arch arch flex aspect-[3/4] w-[24vw] items-end justify-center border border-b-0 border-terracotta/60 pb-10">
            <span className="font-sans text-[11px] uppercase tracking-[0.45em] text-beige/60">Next — Find us</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-12 bottom-10 hidden h-px bg-offwhite/10 hz:block" aria-hidden="true">
        <span className="sv-progress absolute inset-0 origin-left bg-terracotta" />
      </div>
    </section>
  );
}

function ServicePanel({ service, index }: { service: Service; index: number }) {
  return (
    <article className="svc group shrink-0 hz:w-[26vw]">
      <div className="arch relative aspect-[4/5] overflow-hidden bg-ink lg:aspect-[3/4]">
        <div className="svc-parallax absolute -inset-x-[12%] inset-y-0 will-change-transform">
          <div className="h-full w-full transition-transform duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.06]">
            {service.image ? (
              <Image src={service.image} alt="" fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
            ) : (
              <ServiceArt art={service.art} />
            )}
          </div>
        </div>
        <span className="pointer-events-none absolute inset-0 bg-terracotta/0 mix-blend-multiply transition-colors duration-700 group-hover:bg-terracotta/20" />
      </div>

      <div className="mt-6 flex items-center justify-between font-sans text-[11px] uppercase tracking-[0.35em] text-beige/60 md:text-xs">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="text-beige/60">{service.price ?? "$ —"}</span>
      </div>
      <h3 className="svc-name mt-3 font-display text-[13vw] uppercase leading-[0.9] tracking-tight transition-[translate,color] duration-500 group-hover:translate-x-2 group-hover:text-terracotta lg:text-[3.4vw]">
        {service.name}
      </h3>
      <span className="svc-line mt-4 block h-px w-full origin-left bg-terracotta/70 lg:scale-x-0 lg:transition-transform lg:duration-700 lg:group-hover:scale-x-100" />
      <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-beige/70">{service.description}</p>
      <a
        href={bookingHref(service.name)}
        className="mt-5 inline-flex min-h-11 items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-terracotta transition-colors hover:text-offwhite"
      >
        Book this
        <svg className="h-3 w-5" viewBox="0 0 24 12" fill="none" aria-hidden="true">
          <path d="M0 6 H22 M17 1 L22 6 L17 11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </a>
    </article>
  );
}
