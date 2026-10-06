"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Install the app" button. Android/desktop Chrome: native install prompt.
 * iPhone (Safari has no prompt): short Add-to-Home-Screen instructions.
 * Hidden when already running as an installed app.
 */
export default function InstallApp({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice.catch(() => null);
            setDeferred(null);
          } else setShowIosHelp((v) => !v);
        }}
        aria-expanded={ios ? showIosHelp : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-offwhite/20 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-offwhite transition-colors hover:border-terracotta"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Install app
      </button>
      {showIosHelp && (
        <p className="mt-3 max-w-xs rounded-2xl border border-offwhite/10 bg-[#1b1714] p-4 font-sans text-sm leading-relaxed text-beige/80">
          On iPhone: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
        </p>
      )}
    </div>
  );
}
