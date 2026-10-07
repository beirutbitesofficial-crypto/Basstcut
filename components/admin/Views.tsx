"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type AdminBooking, type AdminService, type Notice, type Settings } from "@/lib/adminApi";
import { Button, Card, Field, inputCls, Pill, SectionTitle, useToast } from "./ui";

/* ======================= shared: bookings loader + actions ======================= */

function useBookings(refreshKey: number) {
  const [list, setList] = useState<AdminBooking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    adminApi<{ bookings: AdminBooking[] }>("bookings", undefined, "&days=21")
      .then((d) => alive && (setList(d.bookings), setErr(null)))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return { list, err };
}

function useBookingAction(onChanged: () => void) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const run = async (act: "approve" | "reject" | "cancel", b: AdminBooking) => {
    if (act === "reject" && !confirm(`Decline ${b.name}'s request?`)) return;
    if (act === "cancel" && !confirm(b.kind === "block" ? "Remove this blocked time?" : `Cancel ${b.name}'s booking? The time becomes free again.`)) return;
    setBusyId(b.id);
    try {
      const d = await adminApi<{ notice: Notice }>(act, { id: b.id });
      const n = d.notice;
      const done = act === "approve" ? "Approved." : act === "reject" ? "Declined." : "Cancelled.";
      if (n?.sent) toast(`${done} Client notified on WhatsApp.`);
      else if (n?.wa_link)
        toast(
          <span className="flex flex-wrap items-center gap-3">
            {done}
            <a href={n.wa_link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-terracotta px-3 py-2 text-ink">
              Send WhatsApp to client
            </a>
          </span>,
          true
        );
      else toast(done);
      onChanged();
    } catch (e) {
      toast((e as Error).message);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };
  return { run, busyId };
}

function Contact({ b }: { b: AdminBooking }) {
  if (!b.phone) return null;
  return (
    <p className="mt-1 font-sans text-sm">
      <a href={b.chat ?? "#"} target="_blank" rel="noopener noreferrer" className="text-terracotta underline-offset-2 hover:underline">
        +{b.phone} · WhatsApp
      </a>
      <span className="text-beige/40"> · </span>
      <a href={`tel:+${b.phone}`} className="text-terracotta underline-offset-2 hover:underline">
        Call
      </a>
    </p>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-12 text-center font-sans text-beige/60">{children}</p>;
const Loading = () => <p className="py-12 text-center font-sans text-beige/60">Loading…</p>;
const ErrorBox = ({ msg }: { msg: string }) => (
  <p role="alert" className="rounded-xl border border-terracotta/50 bg-terracotta/10 px-4 py-3 font-sans text-sm">{msg}</p>
);

/* ======================= Requests ======================= */

export function RequestsView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { list, err } = useBookings(refreshKey);
  const { run, busyId } = useBookingAction(onChanged);
  if (err) return <ErrorBox msg={err} />;
  if (!list) return <Loading />;
  const pending = list.filter((b) => b.status === "pending");
  return (
    <>
      <SectionTitle>Waiting for you ({pending.length})</SectionTitle>
      {pending.length === 0 ? (
        <Empty>No pending requests. New ones appear here automatically.</Empty>
      ) : (
        <div className="space-y-3">
          {pending.map((b) => (
            <Card key={b.id} className="border-terracotta/50">
              <div className="flex items-center gap-2">
                <Pill tone="pending">Pending</Pill>
                <span className="font-sans text-xs text-beige/60">{b.code}</span>
              </div>
              <p className="mt-3 font-sans text-xl font-extrabold">
                {b.dateLabel} · {b.timeLabel}
              </p>
              <p className="mt-1 font-sans">
                <b>{b.name}</b> — {b.service}{" "}
                <span className="text-beige/60">
                  ({b.duration} min{b.price ? ` · ${b.price}` : ""})
                </span>
              </p>
              <Contact b={b} />
              {b.note && <p className="mt-2 font-sans text-sm text-beige/70">“{b.note}”</p>}
              <div className="mt-4 flex gap-2">
                <Button variant="ok" disabled={busyId === b.id} onClick={() => run("approve", b)}>
                  Approve
                </Button>
                <Button disabled={busyId === b.id} onClick={() => run("reject", b)}>
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ======================= Schedule ======================= */

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ScheduleView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const { list, err } = useBookings(refreshKey);
  const { run, busyId } = useBookingAction(onChanged);
  const [block, setBlock] = useState({ date: todayISO(), time: "13:00", minutes: 60, label: "Break" });
  const [blocking, setBlocking] = useState(false);

  const active = (list ?? []).filter((b) => b.status === "approved" || b.status === "pending");
  const byDay = active.reduce<Record<string, AdminBooking[]>>((acc, b) => {
    (acc[b.start.slice(0, 10)] ||= []).push(b);
    return acc;
  }, {});

  return (
    <>
      <SectionTitle>Block time</SectionTitle>
      <Card>
        <p className="font-sans text-sm text-beige/70">Breaks, walk-ins, days off — clients can&apos;t book blocked time.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Date"><input type="date" className={inputCls} value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} /></Field>
          <Field label="From"><input type="time" step={300} className={inputCls} value={block.time} onChange={(e) => setBlock({ ...block, time: e.target.value })} /></Field>
          <Field label="Minutes"><input type="number" min={5} step={5} className={inputCls} value={block.minutes} onChange={(e) => setBlock({ ...block, minutes: +e.target.value })} /></Field>
          <Field label="Label"><input className={inputCls} value={block.label} onChange={(e) => setBlock({ ...block, label: e.target.value })} /></Field>
        </div>
        <Button
          variant="primary"
          className="mt-4"
          disabled={blocking}
          onClick={async () => {
            setBlocking(true);
            try {
              await adminApi("block", block);
              toast("Time blocked");
              onChanged();
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBlocking(false);
            }
          }}
        >
          Block
        </Button>
      </Card>

      <SectionTitle>Next 3 weeks</SectionTitle>
      {err ? (
        <ErrorBox msg={err} />
      ) : !list ? (
        <Loading />
      ) : Object.keys(byDay).length === 0 ? (
        <Empty>Nothing booked in the next 3 weeks.</Empty>
      ) : (
        Object.entries(byDay).map(([day, items]) => (
          <div key={day} className="mb-6">
            <h3 className="mb-1 font-sans font-extrabold text-beige">{items[0].dateLabel}</h3>
            <ul>
              {items.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 border-t border-offwhite/10 py-3">
                  <span className="w-32 font-sans text-sm font-bold">{b.timeLabel}</span>
                  <span className="min-w-0 flex-1 font-sans">
                    <Pill tone={b.kind === "block" ? "block" : b.status === "pending" ? "pending" : "approved"}>
                      {b.kind === "block" ? "Blocked" : b.status}
                    </Pill>{" "}
                    <b>{b.name}</b> {b.kind === "booking" && <span className="text-sm text-beige/60">{b.service}</span>}
                    <Contact b={b} />
                  </span>
                  <span className="flex gap-2">
                    {b.status === "pending" && (
                      <Button size="sm" variant="ok" disabled={busyId === b.id} onClick={() => run("approve", b)}>
                        Approve
                      </Button>
                    )}
                    <Button size="sm" disabled={busyId === b.id} onClick={() => run("cancel", b)}>
                      {b.kind === "block" ? "Remove" : "Cancel"}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </>
  );
}

/* ======================= Services & prices ======================= */

export function ServicesView() {
  const toast = useToast();
  const [list, setList] = useState<AdminService[] | null>(null);
  const load = useCallback(() => {
    adminApi<{ services: AdminService[] }>("services").then((d) => setList(d.services)).catch((e) => toast(e.message));
  }, [toast]);
  useEffect(load, [load]);
  if (!list) return <Loading />;

  const blank: AdminService = { id: null, name: "", duration: 30, price: "", active: true, sort: list.length };
  return (
    <>
      <SectionTitle>Services &amp; prices</SectionTitle>
      <p className="mb-4 font-sans text-sm text-beige/70">
        The duration decides how long the chair is blocked. Prices show in the booking app and on the website.
      </p>
      <div className="space-y-3">
        {list.map((s) => (
          <ServiceRow key={s.id} initial={s} onSaved={load} />
        ))}
      </div>
      <SectionTitle>Add a service</SectionTitle>
      <ServiceRow key={`new-${list.length}`} initial={blank} onSaved={load} />
    </>
  );
}

function ServiceRow({ initial, onSaved }: { initial: AdminService; onSaved: () => void }) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  return (
    <Card>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Field label="Service"><input className={inputCls} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Fade" /></Field>
        <Field label="Minutes"><input type="number" min={5} step={5} className={inputCls} value={s.duration} onChange={(e) => setS({ ...s, duration: +e.target.value })} /></Field>
        <Field label="Price"><input className={inputCls} value={s.price ?? ""} onChange={(e) => setS({ ...s, price: e.target.value })} placeholder="$10" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#EF6240]" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} />
          Visible to clients
        </label>
        <span className="flex-1" />
        <label className="flex items-center gap-2 font-sans text-xs text-beige/70">
          Order
          <input type="number" className={`${inputCls} !h-10 !w-16`} value={s.sort} onChange={(e) => setS({ ...s, sort: +e.target.value })} />
        </label>
        <Button
          size="sm"
          variant="primary"
          disabled={busy || (!dirty && s.id !== null)}
          onClick={async () => {
            setBusy(true);
            try {
              await adminApi("service_save", s);
              toast(s.id ? "Saved" : "Service added");
              onSaved();
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {s.id ? "Save" : "Add"}
        </Button>
        {s.id !== null && (
          <Button
            size="sm"
            onClick={async () => {
              if (!confirm(`Delete “${initial.name}”?`)) return;
              await adminApi("service_delete", { id: s.id }).catch((e) => toast(e.message));
              onSaved();
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ======================= Settings ======================= */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SettingsView() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [closed, setClosed] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    adminApi<{ settings: Settings }>("settings")
      .then((d) => {
        setS(d.settings);
        setClosed((d.settings.closed_dates || []).join(", "));
      })
      .catch((e) => toast(e.message));
  }, [toast]);

  if (!s) return <Loading />;
  const up = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const day = (i: number) => (s.hours[String(i)] || [])[0];
  const setDay = (i: number, range: [string, string] | null) => up("hours", { ...s.hours, [String(i)]: range ? [range] : [] });

  const save = async () => {
    setSaving(true);
    try {
      const closed_dates = closed.split(",").map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
      await adminApi("settings_save", { settings: { ...s, closed_dates } });
      toast("Settings saved");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionTitle>Opening hours</SectionTitle>
      <Card>
        <div className="space-y-2">
          {DAYS.map((d, idx) => {
            const i = idx + 1;
            const r = day(i);
            return (
              <div key={d} className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                <b className="font-sans text-sm">{d}</b>
                <input
                  type="time"
                  step={300}
                  aria-label={`${d} opens`}
                  className={`${inputCls} !px-2 text-sm`}
                  disabled={!r}
                  value={r ? r[0] : "10:00"}
                  onChange={(e) => setDay(i, [e.target.value, r ? r[1] : "21:00"])}
                />
                <input
                  type="time"
                  step={300}
                  aria-label={`${d} closes`}
                  className={`${inputCls} !px-2 text-sm`}
                  disabled={!r}
                  value={r ? (r[1] === "24:00" ? "23:59" : r[1]) : "21:00"}
                  onChange={(e) => setDay(i, [r ? r[0] : "10:00", e.target.value === "23:59" ? "24:00" : e.target.value])}
                />
                <label className="flex min-h-11 items-center gap-1.5 font-sans text-xs">
                  <input type="checkbox" className="h-5 w-5 accent-[#EF6240]" checked={!r} onChange={(e) => setDay(i, e.target.checked ? null : ["10:00", "21:00"])} />
                  Off
                </label>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Field label="Closed dates (holidays), comma separated YYYY-MM-DD">
            <input className={inputCls} value={closed} onChange={(e) => setClosed(e.target.value)} placeholder="2026-12-25, 2027-01-01" />
          </Field>
        </div>
      </Card>

      <SectionTitle>Booking rules</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Earliest booking (minutes from now)"><input type="number" className={inputCls} value={s.lead_minutes} onChange={(e) => up("lead_minutes", +e.target.value)} /></Field>
          <Field label="Time grid (minutes)">
            <select className={inputCls} value={s.slot_step} onChange={(e) => up("slot_step", +e.target.value)}>
              {[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Days ahead clients can book"><input type="number" className={inputCls} value={s.days_ahead} onChange={(e) => up("days_ahead", +e.target.value)} /></Field>
        </div>
        <p className="mt-3 font-sans text-sm text-beige/60">
          With 30 minutes, a client opening the page at 2:00 PM can book 2:30 PM at the earliest. Pending and approved bookings
          both block their time — no double bookings.
        </p>
      </Card>

      <SectionTitle>WhatsApp notifications</SectionTitle>
      <Card>
        <div className="space-y-3">
          <Field label="Barber WhatsApp number (receives new requests)">
            <input className={inputCls} inputMode="tel" value={s.barber_whatsapp} onChange={(e) => up("barber_whatsapp", e.target.value)} />
          </Field>
          <Field label="Sending method">
            <select className={inputCls} value={s.notify_driver} onChange={(e) => up("notify_driver", e.target.value as Settings["notify_driver"])}>
              <option value="manual">Manual — alerts here, one tap to WhatsApp the client (free)</option>
              <option value="callmebot">CallMeBot — automatic WhatsApp to the barber (free)</option>
              <option value="cloud">WhatsApp Cloud API (Meta) — fully automatic</option>
            </select>
          </Field>
          {s.notify_driver === "callmebot" && (
            <Field
              label="CallMeBot API key"
              hint="From the barber's phone, send “I allow callmebot to send me messages” to the CallMeBot number listed on callmebot.com to receive the key."
            >
              <input className={inputCls} value={s.callmebot_apikey} onChange={(e) => up("callmebot_apikey", e.target.value)} />
            </Field>
          )}
          {s.notify_driver === "cloud" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Access token"><input className={inputCls} value={s.cloud_token} onChange={(e) => up("cloud_token", e.target.value)} /></Field>
                <Field label="Phone number ID"><input className={inputCls} value={s.cloud_phone_id} onChange={(e) => up("cloud_phone_id", e.target.value)} /></Field>
                <Field label="Template: new request → barber"><input className={inputCls} value={s.cloud_tpl_barber} onChange={(e) => up("cloud_tpl_barber", e.target.value)} placeholder="optional" /></Field>
                <Field label="Template: approved → client"><input className={inputCls} value={s.cloud_tpl_approved} onChange={(e) => up("cloud_tpl_approved", e.target.value)} placeholder="booking_confirmed" /></Field>
                <Field label="Template: declined → client"><input className={inputCls} value={s.cloud_tpl_rejected} onChange={(e) => up("cloud_tpl_rejected", e.target.value)} placeholder="optional" /></Field>
                <Field label="Template language"><input className={inputCls} value={s.cloud_lang} onChange={(e) => up("cloud_lang", e.target.value)} /></Field>
              </div>
              <p className="font-sans text-sm text-beige/60">
                Messages to clients outside a 24h chat window must use approved templates. Variables in order: name, service, date,
                time (barber template: name, phone, service, date, time).
              </p>
            </>
          )}
          <Button
            size="sm"
            onClick={async () => {
              try {
                const d = await adminApi<{ result: { sent: boolean; error?: string } }>("test_notify", {});
                toast(d.result.sent ? "Test sent" : `Not sent: ${d.result.error}`);
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Send test to barber
          </Button>
        </div>
      </Card>

      <SectionTitle>Message texts</SectionTitle>
      <Card>
        <p className="mb-3 font-sans text-sm text-beige/60">Placeholders: {"{name} {phone} {service} {date} {time} {code} {admin_url} {site_url}"}</p>
        <div className="space-y-3">
          {(
            [
              ["msg_barber", "New request → barber"],
              ["msg_approved", "Approved → client"],
              ["msg_rejected", "Declined / cancelled → client"],
              ["msg_received", "Request received → client (Cloud API only)"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <textarea className={`${inputCls} !h-24 py-2`} value={s[k]} onChange={(e) => up(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 mt-6">
        <Button variant="primary" className="w-full shadow-2xl" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <SectionTitle>Admin password</SectionTitle>
      <Card>
        <div className="flex gap-2">
          <input type="password" className={inputCls} placeholder="New password (min 8)" value={newPw} onChange={(e) => setNewPw(e.target.value)} aria-label="New password" />
          <Button
            onClick={async () => {
              try {
                await adminApi("password", { password: newPw });
                toast("Password changed");
                setNewPw("");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Change
          </Button>
        </div>
      </Card>
    </>
  );
}
