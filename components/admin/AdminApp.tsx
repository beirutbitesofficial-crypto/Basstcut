"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ApiError, setCsrf } from "@/lib/adminApi";
import { Button, Field, inputCls, ToastProvider, useToast } from "./ui";
import { RequestsView, ScheduleView, ServicesView, SettingsView } from "./Views";

type Session = { installed: boolean; loggedIn: boolean; csrf: string | null };
type Tab = "requests" | "schedule" | "services" | "settings";

/** Barber admin web app — talks to the PHP API in public/api. */
export default function AdminApp() {
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}

function Gate() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<Session>("session")
      .then((s) => {
        setCsrf(s.csrf);
        setSession(s);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <Centered><p className="text-center font-sans text-beige/80">{error}</p></Centered>;
  if (!session) return <Centered><p className="text-center font-sans text-beige/60">Loading…</p></Centered>;
  if (!session.installed) return <SetupScreen />;
  if (!session.loggedIn) return <LoginScreen onDone={load} />;
  return <Shell onLoggedOut={load} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[100svh] max-w-sm flex-col justify-center px-5 py-10">{children}</div>;
}

function BrandBadge() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/basst-cut-logo-640.webp"
      alt="BASST CUT"
      width={128}
      height={128}
      className="mx-auto mb-6 h-32 w-32"
      style={{ clipPath: "circle(47.3% at 50% 50%)" }}
    />
  );
}

/* ---------------- not configured yet ---------------- */

function SetupScreen() {
  const vars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "ADMIN_PASSWORD", "SESSION_SECRET"];
  return (
    <Centered>
      <BrandBadge />
      <h1 className="text-center font-display text-4xl uppercase tracking-tight">Almost ready</h1>
      <p className="mt-3 text-center font-sans text-sm leading-relaxed text-beige/70">
        Add these environment variables to the web app in Hostinger, then redeploy:
      </p>
      <ul className="mt-5 space-y-2 rounded-2xl border border-offwhite/10 bg-[#1b1714] p-4 font-mono text-sm">
        {vars.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
      <p className="mt-4 text-center font-sans text-xs text-beige/60">The database tables are created automatically on first use.</p>
    </Centered>
  );
}

/* ---------------- login ---------------- */

function LoginScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Centered>
      <BrandBadge />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await adminApi("login", { password: pw });
            onDone();
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-3"
      >
        <Field label="Admin password">
          <input
            id="pw"
            className={inputCls}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? "pw-err" : undefined}
          />
        </Field>
        {err && <p id="pw-err" role="alert" className="font-sans text-sm text-terracotta">{err}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>{busy ? "Checking…" : "Log in"}</Button>
      </form>
    </Centered>
  );
}

/* ---------------- app shell ---------------- */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

function Shell({ onLoggedOut }: { onLoggedOut: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("requests");
  const [pending, setPending] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const latest = useRef<number | null>(null);
  const [notifAsk, setNotifAsk] = useState(false);
  const [install, setInstall] = useState<InstallEvent | "ios" | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Poll for new requests: badge, title, sound, vibration, system notification.
  const poll = useCallback(async () => {
    try {
      const d = await adminApi<{ pending: number; latestId: number }>("poll");
      setPending(d.pending);
      document.title = (d.pending ? `(${d.pending}) ` : "") + "BASST CUT · Admin";
      if (latest.current !== null && d.latestId > latest.current) {
        beep();
        navigator.vibrate?.([200, 100, 200]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New booking request", { body: "Open BASST CUT Admin to approve", icon: "/icons/icon-192.png" });
        }
        toast("New booking request");
        refresh();
      }
      latest.current = d.latestId;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLoggedOut();
    }
  }, [toast, refresh, onLoggedOut]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, 20000);
    const onVis = () => {
      if (!document.hidden) {
        poll();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll, refresh]);

  // Alerts permission + install
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") setNotifAsk(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setInstall("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const tabs: [Tab, string][] = [
    ["requests", "Requests"],
    ["schedule", "Schedule"],
    ["services", "Services & prices"],
    ["settings", "Settings"],
  ];

  return (
    <div className="min-h-[100svh]">
      <header className="sticky top-0 z-30 border-b border-offwhite/10 bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="font-display text-xl uppercase tracking-tight">
            Basst <span className="text-terracotta">Cut</span>
          </span>
          {pending > 0 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-terracotta px-1.5 font-sans text-xs font-bold text-ink" aria-label={`${pending} pending`}>
              {pending}
            </span>
          )}
          <span className="flex-1" />
          {install && (
            <Button
              size="sm"
              onClick={async () => {
                if (install === "ios") toast("On iPhone: tap Share in Safari, then “Add to Home Screen”.", true);
                else {
                  await install.prompt();
                  await install.userChoice.catch(() => null);
                  setInstall(null);
                }
              }}
            >
              Install app
            </Button>
          )}
          {notifAsk && (
            <Button size="sm" onClick={async () => { await Notification.requestPermission(); setNotifAsk(false); }}>
              Turn on alerts
            </Button>
          )}
          <Button size="sm" onClick={async () => { await adminApi("logout", {}).catch(() => null); onLoggedOut(); }}>
            Log out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" aria-label="Admin sections">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`min-h-10 shrink-0 rounded-full border px-4 font-sans text-sm transition-colors ${
                tab === key ? "border-offwhite bg-offwhite text-ink" : "border-offwhite/15 text-beige/80 hover:border-offwhite/40"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        {tab === "requests" && <RequestsView refreshKey={refreshKey} onChanged={() => { refresh(); poll(); }} />}
        {tab === "schedule" && <ScheduleView refreshKey={refreshKey} onChanged={() => { refresh(); poll(); }} />}
        {tab === "services" && <ServicesView />}
        {tab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const a = new Ctx();
    [0, 0.18].forEach((t) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(0.2, a.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + t + 0.15);
      o.start(a.currentTime + t);
      o.stop(a.currentTime + t + 0.16);
    });
  } catch {}
}

