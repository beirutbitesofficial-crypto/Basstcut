/**
 * Tiny, dependency-free text splitters. Each piece sits inside an
 * overflow-hidden mask so it can slide in with transforms only.
 * Use an sr-only copy of the text alongside for screen readers.
 */
export function SplitChars({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex ${className}`}>
      {Array.from(text).map((c, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.06em] -mb-[0.06em]">
          <span className="char inline-block will-change-transform">{c === " " ? " " : c}</span>
        </span>
      ))}
    </span>
  );
}

export function SplitWords({
  text,
  className = "",
  mask = true,
}: {
  text: string;
  className?: string;
  mask?: boolean;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className={`inline-block ${mask ? "overflow-hidden pb-[0.08em] -mb-[0.08em]" : ""} ${className}`}>
          <span className="word inline-block">{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
