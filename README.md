# BASST CUT — Haircut & Style

One-page cinematic landing site for BASST CUT, Abra, Sidon.
Next.js (App Router) · React · TypeScript · Tailwind CSS 4 · GSAP + ScrollTrigger · MySQL.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Structure

| File | What it does |
| --- | --- |
| `components/Hero.tsx` | 100vh intro: backdrop scale, logo arch draw, letter reveals, pointer + scroll parallax |
| `components/HaircutExperience.tsx` | The pinned, scrubbed haircut scene (timeline map at top of file) |
| `lib/hair.ts` | Canvas hair engine — locks, cut segments, falling physics, clippings. Pure function of timeline time, so scrolling back reverses it exactly |
| `components/Scissors.tsx` | SVG shears; each half rotates around the pivot to open/close |
| `components/About.tsx` | Scrubbed word reveals, shears/clipping parallax, "cut here" line |
| `components/Services.tsx` | Desktop: pinned horizontal track. Mobile/tablet: vertical stack |
| `components/Location.tsx` | Arch "doorway" entrance, stylized map with drawing roads |
| `components/Footer.tsx` | Minimal footer |
| `lib/site.ts` | **Edit me** — social links, WhatsApp number, directions URL, services, prices |
| `lib/gsap.ts` | Plugin registration + shared `matchMedia` queries |

## URLs

| URL | What |
| --- | --- |
| `basstcut.com` | Cinematic landing page (`app/page.tsx`) — "Book" buttons link to /booking/ |
| `basstcut.com/booking` | Booking web app for clients (`app/booking/page.tsx`); `?service=Fade` preselects a service |
| `basstcut.com/admin` | Barber admin web app — React (`app/admin/page.tsx`, `components/admin/`) |

Both /booking and /admin are installable web apps (PWA): `public/manifest.webmanifest` (clients, starts at
/booking/), `public/admin/manifest.json` (barber), service worker `public/sw.js` (never caches /api or /admin),
icons in `public/icons/`. Android/desktop Chrome show an "Install app" button; on iPhone use Safari →
Share → Add to Home Screen.

## Architecture

100% **Next.js + React + TypeScript** — no PHP.

| Part | Where |
| --- | --- |
| Pages (landing, /booking, /admin) | `app/`, `components/` |
| Booking API | `app/api/booking/route.ts` |
| Admin API | `app/api/admin/route.ts` |
| Business logic (slots, conflicts, locking) | `lib/server/booking.ts`, `lib/server/db.ts` |
| WhatsApp (manual / CallMeBot / Cloud API) | `lib/server/whatsapp.ts` |
| Admin login (signed cookie + CSRF) | `lib/server/auth.ts` |
| Beirut time handling (server timezone doesn't matter) | `lib/server/time.ts` |

Data lives in **MySQL**. Tables are created automatically on first request.

### Booking rules
- Earliest bookable time = now + *lead minutes* (default 30), on the time grid (default 30 min):
  opening the page at 2:00 PM → first slot 2:30 PM.
- Pending **and** approved bookings block their time. Every booking write runs under a MySQL lock and
  re-checks availability, so two clients can never get the same or overlapping time (re-checked on approval).
- Every request starts **pending** → the barber approves/declines in /admin → the client gets WhatsApp and the
  client's page flips to "You're booked".
- Services, durations, prices, hours, closed days, rules and message texts are edited in /admin.

### WhatsApp (Admin → Settings)
- *Manual* (default, free): alerts in the admin app; after approving, one tap opens WhatsApp with the message written.
- *CallMeBot* (free): new requests are also sent automatically to the barber's WhatsApp.
- *WhatsApp Cloud API* (Meta): fully automatic messages to barber and clients (needs Meta Business + templates).

## Deploy on Hostinger (Node.js web app from GitHub)

Hostinger's servers can't run Next.js's native compiler, so the app is **built on GitHub** and Hostinger
only runs it:

- Every push to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes a
  ready-to-run copy (Next.js `standalone` server, ~4 MB) to the **`deploy`** branch.
- Hostinger deploys the `deploy` branch: `npm install` (4 runtime packages) → `npm start` (`node server.js`).

Steps:
1. hPanel → **Databases → MySQL** → create a database + user.
2. Node.js web app → **Import from GitHub** → repo `basstcut`, branch **`deploy`**.
3. Settings: Node **20** or **22** · Build command `npm run build` (does nothing) · Start command `npm start`.
4. Environment variables (see `.env.example`): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`, optional `SITE_URL`.
5. Deploy, open `/admin`, log in, set opening hours and the barber WhatsApp number.

To build the deploy copy by hand: `npm run build && node scripts/assemble-deploy.mjs dist-deploy`.

## Local development

```bash
cp .env.example .env.local   # fill in a local MySQL
npm install
npm run dev                  # http://localhost:3000
```

## Replacing placeholder assets

- **Service photos** — put images in `public/services/` and set `image: "/services/fade.jpg"` in `lib/site.ts`.
- **Social links / WhatsApp** — `lib/site.ts` (`wa.me/961XXXXXXXX` and handles are placeholders).
- **Logo** — `public/brand/` (original in `brand-assets/`).

## Motion & performance notes

- Every GSAP setup runs inside `useGSAP` + `gsap.matchMedia()` and is reverted on unmount / breakpoint change.
- Hair is drawn on one canvas (DPR capped); mobile uses fewer locks, strands and clippings.
- `prefers-reduced-motion` → no pinning/scrubbing; the haircut scene renders its finished state.
- /booking and /admin are installable PWAs (`public/manifest.webmanifest`, `public/admin/manifest.json`, `public/sw.js`).
