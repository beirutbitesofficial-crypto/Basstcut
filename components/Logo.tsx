/**
 * Official BASST CUT logo (circular badge).
 * Source file: brand-assets/basst-cut-logo-original.png → optimized copies in public/brand/.
 * The thin ring drawn around it (`logo-ring`) is animated on load by the hero.
 */
export default function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={`relative aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-optimized webp */}
      <img
        src="/brand/basst-cut-logo-1000.webp"
        srcSet="/brand/basst-cut-logo-640.webp 640w, /brand/basst-cut-logo-1000.webp 1000w"
        sizes="(min-width: 1024px) 420px, 70vw"
        alt="BASST CUT — Haircut & Style"
        width={1000}
        height={1000}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="logo-img h-full w-full select-none"
        // Trim the black square corners just outside the badge's own gold ring.
        style={{ clipPath: "circle(47.3% at 50% 50%)" }}
        draggable={false}
      />
      <svg className="pointer-events-none absolute -inset-[4%] h-[108%] w-[108%]" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle className="logo-ring" pathLength={1} cx="50" cy="50" r="49" stroke="#EF6240" strokeOpacity=".55" strokeWidth=".35" transform="rotate(-90 50 50)" />
      </svg>
    </div>
  );
}
