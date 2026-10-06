/**
 * Dry-brush marks taken from the BASST CUT poster language:
 * a tapered underline swoosh and loose diagonal scratches.
 */
export function BrushStroke({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 36" fill="currentColor" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 25 C52 17 140 10 294 3 L297 8 C230 12 150 18 92 24 C140 22 200 20 252 19 L249 23 C170 26 96 30 30 34 C18 34 8 32 3 25 Z" />
      <path d="M22 28 C90 22 170 16 280 8" stroke="currentColor" strokeWidth=".8" fill="none" opacity=".55" />
      <path d="M40 31 C110 26 180 22 236 20" stroke="currentColor" strokeWidth=".6" fill="none" opacity=".4" />
      <circle cx="286" cy="14" r="1.4" />
      <circle cx="292" cy="17" r=".9" />
    </svg>
  );
}

export function BrushSlashes({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 400" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M10 120 L190 40" strokeWidth="3" />
      <path d="M18 132 L170 64" strokeWidth="1.2" opacity=".7" />
      <path d="M30 300 L196 200" strokeWidth="2.4" />
      <path d="M44 316 L180 234" strokeWidth="1" opacity=".6" />
      <path d="M4 230 L90 190" strokeWidth="1.6" opacity=".8" />
      <g fill="currentColor" stroke="none" opacity=".8">
        <circle cx="160" cy="80" r="2" />
        <circle cx="172" cy="70" r="1.2" />
        <circle cx="70" cy="262" r="1.6" />
        <circle cx="120" cy="250" r="1" />
      </g>
    </svg>
  );
}
