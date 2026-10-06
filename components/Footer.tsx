import { site } from "@/lib/site";
import { ScissorsOutline } from "./Scissors";
import { BrushStroke } from "./Brush";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-offwhite/10 bg-ink px-5 pb-8 pt-16 text-offwhite md:px-12 md:pt-24">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-[18vw] uppercase leading-[0.82] tracking-tight md:text-[7vw]">
            BASST <span className="text-terracotta">CUT</span>
          </p>
          <BrushStroke className="mt-1 h-4 w-48 text-terracotta md:h-5 md:w-72" />
          <p className="mt-4 font-sans text-xs font-semibold uppercase tracking-[0.5em] text-beige">{site.tagline}</p>
          <p className="mt-2 font-serif text-lg italic text-offwhite/60">Abra, Sidon</p>
        </div>

        <nav aria-label="Social">
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {site.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex min-h-11 items-center font-sans text-xs uppercase tracking-[0.35em] text-offwhite/80 transition-colors hover:text-offwhite"
                >
                  {s.label}
                  <span className="absolute inset-x-0 bottom-2 h-px origin-left scale-x-0 bg-terracotta transition-transform duration-500 group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-14 flex max-w-[1400px] items-center justify-between border-t border-dashed border-offwhite/15 pt-6 font-sans text-[11px] uppercase tracking-[0.35em] text-offwhite/60">
        <span>© BASST CUT</span>
        <ScissorsOutline className="w-12 text-terracotta/70" />
      </div>
    </footer>
  );
}
