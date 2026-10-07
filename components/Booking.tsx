"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import { site } from "@/lib/site";
import { BrushStroke } from "./Brush";
import { SplitWords } from "./SplitText";

/** PHP API shipped in public/api (works on Hostinger). Override for local dev if needed. */
const API = process.env.NEXT_PUBLIC_BOOKING_API ?? "/api/booking.php";
const STORE_KEY = "basst-cut:last-booking";

type Service = { id: number; name: string; duration: number; price: string | null };
type Day = { date: string; open: boolean };
type Booked = {
  code: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  service: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
};

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const d = await r.json().catch(() => ({ ok: false, error: "Booking is temporarily unavailable." }));
  if (!d.ok) throw new Error(d.error || "Something went wrong");
  return d as T;
}

const dayLabel = (iso: string, i: number) => {
  const d = new Date(iso + "T12:00:00");
  if (i === 0) return { top: "Today", bottom: d.getDate() };
  if (i === 1) return { top: "Tmrw", bottom: d.getDate() };
  return { top: d.toLocaleDateString("en-GB", { weekday: "short" }), bottom: d.getDate() };
};

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function Booking() {
  const root = useRef<HTMLElement>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [lead, setLead] = useState(30);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const nameError = name.trim().length < 2 ? "Enter your name." : null;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError = phoneDigits.length < 7 || phoneDigits.length > 15 ? "Enter a valid WhatsApp number, e.g. 70 123 456." : null;
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<(Booked & { token: string }) | null>(null);

  const service = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  // ---- initial load (+ restore a request made earlier on this device)
  useEffect(() => {
    getJSON<{ services: Service[]; days: Day[]; leadMinutes: number }>(`${API}?action=config`)
      .then((d) => {
        setServices(d.services);
        setDays(d.days);
        setLead(d.leadMinutes);
        setDate(d.days.find((x) => x.open)?.date ?? null);
      })
      .catch((e) => setLoadError(e.message));
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved?.code && saved?.token && saved?.date >= new Date().toISOString().slice(0, 10)) setBooked(saved);
    } catch {}
  }, []);

  // ---- preselect from /booking/?service=Fade (links on the landing page)
  useEffect(() => {
    if (!services) return;
    const wanted = new URLSearchParams(window.location.search).get("service")?.toLowerCase();
    const match = wanted ? services.find((s) => s.name.toLowerCase() === wanted) : null;
    if (match) setServiceId(match.id);
  }, [services]);

  // ---- free times for the chosen service + day
  const loadSlots = useCallback(() => {
    if (!serviceId || !date) return;
    setSlotsLoading(true);
    setTime(null);
    getJSON<{ slots: string[] }>(`${API}?action=slots&service=${serviceId}&date=${date}`)
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, date]);
  useEffect(loadSlots, [loadSlots]);

  // ---- after booking: poll until the barber decides
  useEffect(() => {
    if (!booked || booked.status !== "pending") return;
    const id = window.setInterval(async () => {
      try {
        const d = await getJSON<{ booking: Booked }>(`${API}?action=status&code=${booked.code}&token=${booked.token}`);
        if (d.booking.status !== booked.status) {
          const next = { ...booked, ...d.booking };
          setBooked(next);
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(next));
          } catch {}
        }
      } catch {}
    }, 15000);
    return () => window.clearInterval(id);
  }, [booked]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!serviceId || !date || !time) return;
    if (nameError || phoneError) {
      setTouched({ name: true, phone: true });
      document.getElementById(nameError ? "bk-name" : "bk-phone")?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const d = await getJSON<{ booking: Booked; token: string }>(`${API}?action=book`, {
        method: "POST",
        body: JSON.stringify({ service: serviceId, date, time, name, phone, note, website: form.get("website") }),
      });
      const next = { ...d.booking, token: d.token };
      setBooked(next);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {}
    } catch (err) {
      setError((err as Error).message);
      loadSlots(); // the time may have just been taken
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setBooked(null);
    setTime(null);
    setNote("");
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
    loadSlots();
  };

  // ---- motion: entrance on page load
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(root);
      mm.add(MQ, (ctx) => {
        const { reduced } = ctx.conditions as Record<keyof typeof MQ, boolean>;
        if (reduced) return;
        gsap
          .timeline({ defaults: { ease: "expo.out" }, delay: 0.1 })
          .fromTo(q(".bk-title .word"), { yPercent: 115 }, { yPercent: 0, duration: 1.2, stagger: 0.08 })
          .fromTo(q(".bk-intro"), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08 }, 0.4)
          .fromTo(q(".bk-panel"), { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 0.25);
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  const openDays = days.length > 0;

  return (
    <>
      <section ref={root} id="book" className="relative overflow-hidden bg-ink px-5 pb-24 pt-10 text-offwhite md:px-12 md:pb-32 md:pt-16">
        <div className="pointer-events-none absolute inset-0 texture-scratch opacity-30" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <p className="bk-intro mb-4 font-sans lg:mb-6 text-[11px] uppercase tracking-[0.45em] text-terracotta md:text-xs">Abra, Sidon — Online booking</p>
            <h2 className="bk-title font-display uppercase leading-[0.85] tracking-tight text-[13vw] lg:text-[6.6vw]">
              <span className="block">
                <SplitWords text="Reserve" />
              </span>
              <span className="block">
                <SplitWords text="your chair" />
                <span className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                  <span className="word inline-block text-terracotta">.</span>
                </span>
              </span>
            </h2>
            <BrushStroke className="bk-intro mt-1 h-4 w-56 text-terracotta md:h-6 md:w-80" />
            <ol className="bk-intro mt-10 hidden space-y-5 lg:block font-sans text-sm text-beige/80 md:text-base">
              {[
                ["01", "Pick your cut, day and time."],
                ["02", "The barber gets your request and confirms it."],
                ["03", "You receive the confirmation on WhatsApp."],
              ].map(([n, t]) => (
                <li key={n} className="flex gap-5">
                  <span className="font-display text-terracotta">{n}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="bk-intro mt-8 hidden max-w-sm font-sans text-xs leading-relaxed lg:block text-beige/60">
              Bookings open from {lead} minutes from now. Times already requested by someone else are not shown.
            </p>
          </div>

          <div className="bk-panel min-w-0 lg:col-span-7">
            <div className="rounded-[28px] border border-offwhite/10 bg-[#1b1714] p-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] md:p-8">
              {booked ? (
                <Confirmation booked={booked} onNew={reset} />
              ) : loadError ? (
                <div className="py-10 text-center font-sans" role="alert">
                  <p className="text-lg text-offwhite">Online booking is not available right now.</p>
                  <p className="mt-2 text-sm text-beige/60">{loadError}</p>
                  <a
                    href={site.socials.find((x) => x.label === "WhatsApp")?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta px-6 text-xs font-bold uppercase tracking-[0.3em] text-ink"
                  >
                    Book on WhatsApp
                  </a>
                </div>
              ) : !services ? (
                <PanelSkeleton />
              ) : (
                <form onSubmit={submit} noValidate>
                  {/* 1. Service */}
                  <Step n="1" title="Choose your cut">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {services.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => setServiceId(s.id)}
                          aria-pressed={serviceId === s.id}
                          className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                            serviceId === s.id ? "border-terracotta bg-terracotta/15" : "border-offwhite/10 hover:border-offwhite/30"
                          }`}
                        >
                          <span>
                            <span className="block font-display text-xl uppercase leading-none tracking-tight">{s.name}</span>
                            <span className="mt-1 block font-sans text-xs text-beige/60">{s.duration} min</span>
                          </span>
                          {s.price && <span className="font-sans text-sm font-semibold text-terracotta">{s.price}</span>}
                        </button>
                      ))}
                    </div>
                  </Step>

                  {/* 2. Day */}
                  <Step n="2" title="Pick a day" dim={!service}>
                    {openDays && (
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
                        {days.map((d, i) => {
                          const l = dayLabel(d.date, i);
                          const on = date === d.date;
                          return (
                            <button
                              type="button"
                              key={d.date}
                              disabled={!d.open}
                              onClick={() => setDate(d.date)}
                              aria-pressed={on}
                              className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border font-sans transition-colors disabled:opacity-25 ${
                                on ? "border-terracotta bg-terracotta text-ink" : "border-offwhite/10 hover:border-offwhite/30"
                              }`}
                            >
                              <span className="text-[11px] uppercase tracking-wider opacity-80">{l.top}</span>
                              <span className="text-lg font-bold leading-tight">{l.bottom}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Step>

                  {/* 3. Time */}
                  <Step n="3" title="Pick a time" dim={!service || !date}>
                    {!service ? (
                      <p className="font-sans text-sm text-beige/60">Choose a service first.</p>
                    ) : slotsLoading || slots === null ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true" aria-label="Loading free times">
                        {Array.from({ length: 8 }, (_, i) => (
                          <span key={i} className="h-11 animate-pulse rounded-xl bg-offwhite/5" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="font-sans text-sm text-beige/60">No free times left on this day — try another day.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setTime(t)}
                            aria-pressed={time === t}
                            className={`h-11 rounded-xl border font-sans text-sm font-semibold transition-colors ${
                              time === t ? "border-terracotta bg-terracotta text-ink" : "border-offwhite/10 hover:border-offwhite/30"
                            }`}
                          >
                            {to12h(t)}
                          </button>
                        ))}
                      </div>
                    )}
                  </Step>

                  {/* 4. Details */}
                  <Step n="4" title="Your details" dim={!time} last>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block font-sans text-xs text-beige/60">Name</span>
                        <input
                          id="bk-name"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                          autoComplete="name"
                          aria-invalid={touched.name && !!nameError}
                          aria-describedby={touched.name && nameError ? "bk-name-err" : undefined}
                          className={`h-12 w-full rounded-xl border bg-ink px-4 font-sans text-base outline-none focus:border-terracotta ${
                            touched.name && nameError ? "border-terracotta" : "border-offwhite/10"
                          }`}
                        />
                        {touched.name && nameError && (
                          <span id="bk-name-err" className="mt-1 block font-sans text-xs text-terracotta">
                            {nameError}
                          </span>
                        )}
                      </label>
                      <label className="block">
                        <span className="mb-1 block font-sans text-xs text-beige/60">WhatsApp number</span>
                        <span
                          className={`flex h-12 items-center rounded-xl border bg-ink focus-within:border-terracotta ${
                            touched.phone && phoneError ? "border-terracotta" : "border-offwhite/10"
                          }`}
                        >
                          <span className="pl-4 pr-2 font-sans text-sm text-beige/60">+961</span>
                          <input
                            required
                            value={phone}
                            id="bk-phone"
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                            aria-invalid={touched.phone && !!phoneError}
                            aria-describedby={touched.phone && phoneError ? "bk-phone-err" : "bk-phone-hint"}
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="70 123 456"
                            className="h-full w-full min-w-0 bg-transparent pr-4 font-sans text-base outline-none"
                          />
                        </span>
                        {touched.phone && phoneError ? (
                          <span id="bk-phone-err" className="mt-1 block font-sans text-xs text-terracotta">
                            {phoneError}
                          </span>
                        ) : (
                          <span id="bk-phone-hint" className="mt-1 block font-sans text-xs text-beige/60">
                            Your confirmation arrives on this number.
                          </span>
                        )}
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-1 block font-sans text-xs text-beige/60">Note (optional)</span>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={300}
                        className="h-12 w-full rounded-xl border border-offwhite/10 bg-ink px-4 font-sans text-base outline-none focus:border-terracotta"
                      />
                    </label>
                    {/* honeypot */}
                    <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                    {error && (
                      <p role="alert" className="mt-4 rounded-xl border border-terracotta/50 bg-terracotta/10 px-4 py-3 font-sans text-sm">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!service || !date || !time || submitting}
                      aria-busy={submitting}
                      className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-terracotta px-6 font-sans text-xs font-bold uppercase tracking-[0.3em] text-ink transition-opacity disabled:opacity-30"
                    >
                      {submitting
                        ? "Sending…"
                        : time && service && date
                          ? `Request ${to12h(time)} · ${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                          : "Request booking"}
                    </button>
                  </Step>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

    </>
  );
}

function Step({ n, title, children, dim, last }: { n: string; title: string; children: React.ReactNode; dim?: boolean; last?: boolean }) {
  return (
    <fieldset className={`min-w-0 ${last ? "" : "mb-7 border-b border-offwhite/10 pb-7"} transition-opacity ${dim ? "opacity-40" : ""}`}>
      <legend className="mb-4 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-beige/70">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-terracotta/60 text-[11px] text-terracotta">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-label="Loading booking">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-offwhite/5" />
      ))}
    </div>
  );
}

function Confirmation({ booked, onNew }: { booked: Booked; onNew: () => void }) {
  const approved = booked.status === "approved";
  const declined = booked.status === "rejected" || booked.status === "cancelled";
  return (
    <div className="py-6 text-center" aria-live="polite">
      <div
        className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl ${
          approved ? "bg-[#4fb477] text-ink" : declined ? "bg-offwhite/10" : "bg-terracotta/15 text-terracotta"
        }`}
      >
        {approved ? <IconCheck /> : declined ? <IconX /> : <IconClock />}
      </div>
      <h3 className="mt-6 font-display text-4xl uppercase tracking-tight md:text-5xl">
        {approved ? "You're booked." : declined ? "Not available." : "Request sent."}
      </h3>
      <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-beige/70 md:text-base">
        {approved
          ? "The barber confirmed your appointment. The confirmation was sent to your WhatsApp."
          : declined
            ? "Sorry, the barber couldn't take this time. Please choose another one."
            : "Waiting for the barber to confirm. You'll get a WhatsApp message as soon as it's approved."}
      </p>
      <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-offwhite/10 p-5 text-left font-sans">
        <Row k="Service" v={booked.service} />
        <Row k="Day" v={booked.dateLabel} />
        <Row k="Time" v={booked.timeLabel} />
        <Row k="Status" v={approved ? "Confirmed" : declined ? "Declined" : "Pending approval"} accent={!declined} />
        <Row k="Ref" v={booked.code} />
      </div>
      <button onClick={onNew} className="mt-8 font-sans text-xs uppercase tracking-[0.3em] text-beige/60 underline-offset-4 hover:text-offwhite hover:underline">
        {declined ? "Pick another time" : "Make another booking"}
      </button>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-offwhite/5 py-2 text-sm last:border-0">
      <span className="text-beige/60">{k}</span>
      <span className={accent ? "font-semibold text-terracotta" : "font-semibold"}>{v}</span>
    </div>
  );
}

const iconProps = { className: "h-7 w-7", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconCheck() {
  return (
    <svg {...iconProps}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
function IconX() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg {...iconProps} className="h-7 w-7 motion-safe:animate-pulse">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
