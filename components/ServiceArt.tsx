import type { ReactNode } from "react";
import type { Service } from "@/lib/site";

/**
 * Art-directed SVG stand-ins for service photography.
 * Each sits inside an arch frame; set `image` on a service in lib/site.ts
 * to replace it with a real photo without touching layout or animation.
 */
export default function ServiceArt({ art }: { art: Service["art"] }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sa-bg-${art}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2623" />
          <stop offset="1" stopColor="#151413" />
        </linearGradient>
        <radialGradient id={`sa-glow-${art}`} cx="0.5" cy="0.4" r="0.55">
          <stop offset="0" stopColor="#C25A43" stopOpacity=".28" />
          <stop offset="1" stopColor="#C25A43" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`sa-fade-${art}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E1E1E" />
          <stop offset="0.55" stopColor="#4a3a31" />
          <stop offset="1" stopColor="#E8D9C4" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill={`url(#sa-bg-${art})`} />
      <rect width="300" height="400" fill={`url(#sa-glow-${art})`} />
      <g fill="none" stroke="#E8D9C4" strokeLinecap="round" strokeLinejoin="round">{ART[art]}</g>
    </svg>
  );
}

const head = (
  <>
    <path d="M150 330 C110 330 92 300 92 250 C92 190 112 150 150 150 C188 150 208 190 208 250 C208 300 190 330 150 330 Z" strokeOpacity=".5" strokeWidth="1.5" />
    <path d="M128 330 L120 380 M172 330 L180 380" strokeOpacity=".4" strokeWidth="1.5" />
  </>
);

const ART: Record<Service["art"], ReactNode> = {
  haircut: (
    <>
      {head}
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${96 + i * 8} ${205 - Math.sin(i / 4) * 30} C${100 + i * 8} 170 ${110 + i * 6} 150 ${150 + (i - 7) * 3} 140`} strokeWidth="1.4" strokeOpacity=".8" />
      ))}
      <path d="M60 120 L240 104" stroke="#C25A43" strokeWidth="1.5" strokeDasharray="6 6" />
    </>
  ),
  fade: (
    <>
      <rect x="70" y="60" width="160" height="280" rx="80" fill="url(#sa-fade-fade)" stroke="none" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M70 ${100 + i * 20} H230`} strokeOpacity={0.05 + i * 0.03} strokeWidth="1" />
      ))}
      <path d="M150 60 V340" stroke="#C25A43" strokeOpacity=".6" />
    </>
  ),
  beard: (
    <>
      {head}
      <path d="M100 250 C104 312 128 345 150 345 C172 345 196 312 200 250" stroke="#E8D9C4" strokeWidth="2" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 106 + i * 5.8;
        return <path key={i} d={`M${x} ${262 + Math.abs(i - 7.5) * -2} v${36 - Math.abs(i - 7.5) * 3}`} strokeOpacity=".55" strokeWidth="1.2" />;
      })}
      <path d="M128 286 C140 280 160 280 172 286" stroke="#C25A43" strokeWidth="2" />
    </>
  ),
  combo: (
    <>
      {head}
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${100 + i * 9} 200 C${104 + i * 8} 170 ${114 + i * 6} 152 ${150 + (i - 6) * 3} 144`} strokeWidth="1.3" strokeOpacity=".7" />
      ))}
      <path d="M100 250 C104 312 128 345 150 345 C172 345 196 312 200 250" strokeWidth="2" />
      <path d="M40 300 L260 90" stroke="#C25A43" strokeWidth="1.5" />
    </>
  ),
  kids: (
    <>
      <path d="M150 300 C122 300 108 278 108 244 C108 204 126 180 150 180 C174 180 192 204 192 244 C192 278 178 300 150 300 Z" strokeOpacity=".55" strokeWidth="1.5" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${114 + i * 9} 215 C${118 + i * 8} 196 ${128 + i * 5} 184 ${150 + (i - 4) * 2} 178`} strokeWidth="1.3" strokeOpacity=".75" />
      ))}
      <circle cx="150" cy="110" r="18" stroke="#C25A43" strokeWidth="1.5" />
      <path d="M150 128 V150 M132 380 V320 H168 V380" strokeOpacity=".45" strokeWidth="1.5" />
    </>
  ),
  styling: (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M${60 + i * 6} ${330 - i * 4} C${100 + i * 4} ${250 - i * 10} ${200 - i * 6} ${260 - i * 6} ${150 + i * 6} ${120 + i * 6} S ${210 + i * 3} 80 ${240 - i * 3} 70`}
          strokeWidth="1.4"
          strokeOpacity={0.35 + i * 0.07}
        />
      ))}
      <rect x="196" y="300" width="56" height="44" rx="6" stroke="#C25A43" strokeWidth="1.5" />
      <path d="M196 312 H252" stroke="#C25A43" strokeOpacity=".6" />
    </>
  ),
};
