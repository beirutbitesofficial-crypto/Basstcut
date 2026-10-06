import { useId, type Ref } from "react";

/**
 * Premium barber shears, drawn horizontally with the blades pointing right.
 * ViewBox 620 x 220. The pivot screw sits at (PIVOT_X, PIVOT_Y).
 *
 * Each half is a separate <g> so it can be rotated around the pivot:
 *   half A = upper blade + lower finger ring  (rotate negative to open)
 *   half B = lower blade + upper thumb ring   (rotate positive to open)
 */
export const SCISSORS_VIEWBOX = { w: 620, h: 220 };
export const PIVOT_X = 250;
export const PIVOT_Y = 110;
/** How far (in viewBox units) the blades reach in front of the pivot. */
export const BLADE_REACH = 350;

type Props = {
  className?: string;
  halfARef?: Ref<SVGGElement>;
  halfBRef?: Ref<SVGGElement>;
};

export default function Scissors({ className, halfARef, halfBRef }: Props) {
  const uid = useId().replace(/:/g, "");
  const steel = `steel-${uid}`;
  const steelLow = `steelLow-${uid}`;
  const handle = `handle-${uid}`;
  const screw = `screw-${uid}`;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SCISSORS_VIEWBOX.w} ${SCISSORS_VIEWBOX.h}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={steel} x1="0" y1="86" x2="0" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d6a66" />
          <stop offset="0.25" stopColor="#f4f1ec" />
          <stop offset="0.55" stopColor="#b9b5af" />
          <stop offset="0.8" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8a8680" />
        </linearGradient>
        <linearGradient id={steelLow} x1="0" y1="108" x2="0" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d9d5cf" />
          <stop offset="0.3" stopColor="#8f8b85" />
          <stop offset="0.65" stopColor="#e9e6e1" />
          <stop offset="1" stopColor="#4d4a46" />
        </linearGradient>
        <linearGradient id={handle} x1="0" y1="20" x2="0" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a3734" />
          <stop offset="0.5" stopColor="#141312" />
          <stop offset="1" stopColor="#2a2725" />
        </linearGradient>
        <radialGradient id={screw} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#f0a58f" />
          <stop offset="0.55" stopColor="#C25A43" />
          <stop offset="1" stopColor="#5e2516" />
        </radialGradient>
      </defs>

      {/* Half B — lower blade + upper ring (drawn first, sits underneath) */}
      <g ref={halfBRef}>
        <path
          d="M238 110 L606 110 C560 116 470 126 360 130 C300 132 262 130 238 120 Z"
          fill={`url(#${steelLow})`}
        />
        <path d="M268 126 C360 127 480 120 598 111" stroke="#2b2927" strokeOpacity=".35" strokeWidth="1" />
        <path
          d="M262 118 C220 114 192 96 168 76 L178 62 C202 82 228 96 262 100 Z"
          fill={`url(#${handle})`}
        />
        <ellipse
          cx="118"
          cy="50"
          rx="48"
          ry="28"
          transform="rotate(12 118 50)"
          stroke={`url(#${handle})`}
          strokeWidth="14"
        />
        <ellipse
          cx="118"
          cy="50"
          rx="48"
          ry="28"
          transform="rotate(12 118 50)"
          stroke="#C25A43"
          strokeOpacity=".55"
          strokeWidth="1.2"
        />
      </g>

      {/* Half A — upper blade + lower ring with finger rest */}
      <g ref={halfARef}>
        <path
          d="M238 110 L606 110 C560 104 470 94 360 90 C300 88 262 90 238 100 Z"
          fill={`url(#${steel})`}
        />
        <path d="M262 96 C380 92 500 99 600 109" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
        <path d="M250 109.2 L604 109.2" stroke="#1e1e1e" strokeOpacity=".45" strokeWidth=".8" />
        <path
          d="M262 102 C220 106 192 124 168 144 L178 158 C202 138 228 124 262 120 Z"
          fill={`url(#${handle})`}
        />
        <ellipse
          cx="122"
          cy="170"
          rx="52"
          ry="30"
          transform="rotate(-10 122 170)"
          stroke={`url(#${handle})`}
          strokeWidth="14"
        />
        <ellipse
          cx="122"
          cy="170"
          rx="52"
          ry="30"
          transform="rotate(-10 122 170)"
          stroke="#C25A43"
          strokeOpacity=".55"
          strokeWidth="1.2"
        />
        <path d="M78 190 C58 204 38 208 18 202 C36 199 52 191 64 178 Z" fill={`url(#${handle})`} />
      </g>

      {/* Pivot screw (does not rotate) */}
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="11" fill={`url(#${screw})`} />
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="11" stroke="#1e1e1e" strokeOpacity=".5" />
      <path d={`M${PIVOT_X - 6} ${PIVOT_Y + 3} L${PIVOT_X + 6} ${PIVOT_Y - 3}`} stroke="#3b160d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Minimal line-art scissors, used as a recurring motif outside the main scene. */
export function ScissorsOutline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 620 220" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M238 110 L606 110 C560 104 470 94 360 90 C300 88 262 90 238 100 Z" />
        <path d="M238 110 L606 110 C560 116 470 126 360 130 C300 132 262 130 238 120 Z" />
        <path d="M262 102 C220 106 192 124 168 144" />
        <path d="M262 118 C220 114 192 96 168 76" />
        <ellipse cx="122" cy="170" rx="52" ry="30" transform="rotate(-10 122 170)" />
        <ellipse cx="118" cy="50" rx="48" ry="28" transform="rotate(12 118 50)" />
        <path d="M78 190 C58 204 38 208 18 202" />
        <circle cx="250" cy="110" r="11" />
      </g>
    </svg>
  );
}
