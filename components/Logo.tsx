/**
 * BASST CUT emblem — arch doorway + open shears.
 * Placeholder for the official logo: swap the SVG contents (keep the
 * `logo-arch` / `logo-glyph` class names if you want the intro animation
 * to keep working), or replace the component with <Image src="/brand/logo.svg" />.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 240" fill="none" role="img" aria-label="BASST CUT logo">
      <g className="text-terracotta" stroke="currentColor" strokeLinecap="round">
        <path className="logo-arch" pathLength={1} d="M18 232 V100 A82 82 0 0 1 182 100 V232" strokeWidth="3" />
        <path className="logo-arch" pathLength={1} d="M34 232 V104 A66 66 0 0 1 166 104 V232" strokeWidth="1" strokeOpacity=".55" />
        <path className="logo-arch" pathLength={1} d="M10 232 H190" strokeWidth="2" />
      </g>
      {/* open shears, standing upright */}
      <g className="logo-glyph" style={{ transformOrigin: "100px 128px", transformBox: "view-box" }}>
        <g stroke="#F4F0E8" strokeWidth="2.4" strokeLinejoin="round" fill="none">
          <path d="M100 128 L82 48 C86 70 92 96 100 128 Z" fill="#F4F0E8" />
          <path d="M100 128 L118 48 C114 70 108 96 100 128 Z" fill="#F4F0E8" />
          <path d="M100 128 L86 160" />
          <path d="M100 128 L114 160" />
          <ellipse cx="80" cy="176" rx="12" ry="17" transform="rotate(18 80 176)" />
          <ellipse cx="120" cy="176" rx="12" ry="17" transform="rotate(-18 120 176)" />
        </g>
        <circle cx="100" cy="128" r="4" fill="#C25A43" />
      </g>
      <text
        x="100"
        y="216"
        textAnchor="middle"
        fill="#E8D9C4"
        fontSize="11"
        letterSpacing="5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        EST · ABRA
      </text>
    </svg>
  );
}
