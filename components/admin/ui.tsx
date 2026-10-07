"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/* ---------- small design-system pieces for the admin ---------- */

export const inputCls =
  "h-12 w-full min-w-0 rounded-xl border border-offwhite/10 bg-ink px-3 font-sans text-base text-offwhite outline-none focus:border-terracotta";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block font-sans text-xs text-beige/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-sans text-xs text-beige/60">{hint}</span>}
    </label>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ok" | "ghost"; size?: "md" | "sm" };
export function Button({ variant = "ghost", size = "md", className = "", ...rest }: BtnProps) {
  const v =
    variant === "primary"
      ? "bg-terracotta text-ink"
      : variant === "ok"
        ? "bg-[#4fb477] text-[#0b1a10]"
        : "border border-offwhite/15 text-offwhite hover:border-offwhite/40";
  const s = size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm";
  return <button className={`rounded-xl font-sans font-bold transition-colors disabled:opacity-40 ${v} ${s} ${className}`} {...rest} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-offwhite/10 bg-[#1b1714] p-4 md:p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-8 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-beige/70 first:mt-2">{children}</h2>;
}

export function Pill({ tone, children }: { tone: "pending" | "approved" | "block" | "muted"; children: ReactNode }) {
  const t =
    tone === "pending"
      ? "bg-terracotta/15 text-terracotta"
      : tone === "approved"
        ? "bg-[#4fb477]/15 text-[#4fb477]"
        : "bg-offwhite/10 text-beige/80";
  return <span className={`rounded-full px-2.5 py-1 font-sans text-[11px] font-bold uppercase tracking-wider ${t}`}>{children}</span>;
}

/* ---------- toasts ---------- */

type Toast = { id: number; content: ReactNode; sticky?: boolean };
const ToastCtx = createContext<(content: ReactNode, sticky?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((content: ReactNode, sticky = false) => {
    const id = Date.now() + Math.random();
    setToasts([{ id, content, sticky }]);
    if (!sticky) window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-offwhite px-4 py-3 font-sans text-sm font-semibold text-ink shadow-2xl"
          >
            <span className="flex-1">{t.content}</span>
            <button aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/10" onClick={() => setToasts([])}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
