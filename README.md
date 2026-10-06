# BASST CUT — Haircut & Style

One-page cinematic landing site for BASST CUT, Abra, Sidon.
Next.js (App Router) · React · TypeScript · Tailwind CSS 4 · GSAP + ScrollTrigger.

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

## Replacing placeholder assets

- **Logo** — `components/Logo.tsx` is an SVG stand-in. Replace its contents with the official logo
  (keep the `logo-arch` / `logo-glyph` classes to keep the intro animation), or render `<Image src="/brand/logo.svg" />`.
- **Service photos** — drop images in `public/services/` and set `image: "/services/fade.jpg"` on a service in
  `lib/site.ts`. They render with `next/image` inside the same arch frame and parallax wrapper.
- **Hero photo** — swap `<HeroBackdrop />` in `components/Hero.tsx` for `<Image fill priority className="object-cover" … />`.
- **Social links / WhatsApp** — placeholders in `lib/site.ts` (`wa.me/961XXXXXXXX`, handles) must be updated.

## Motion & performance notes

- Every GSAP setup runs inside `useGSAP` + `gsap.matchMedia()` and is reverted on unmount / breakpoint change.
- Hair is drawn on a single canvas (DPR capped at 2, 1.5 on mobile); mobile uses fewer locks, strands and clippings.
- Only `transform` / `opacity` are animated on DOM elements.
- `prefers-reduced-motion: reduce` → no pinning or scrubbing; the haircut scene renders its finished state
  (clean fringe, brand revealed, shears at rest) and services become a static grid.
- The haircut scene rebuilds only on real width changes on touch devices, so mobile address-bar
  show/hide never re-lays out the pin.

## URLs

| URL | What |
| --- | --- |
| `basstcut.com` | Cinematic landing page (`app/page.tsx`) — "Book" buttons link to /booking/ |
| `basstcut.com/booking` | Booking web app for clients (`app/booking/page.tsx`); `?service=Fade` preselects a service |
| `basstcut.com/admin` | Barber admin web app (`public/admin/index.php`) |

Both /booking and /admin are installable web apps (PWA): `public/manifest.webmanifest` (clients, starts at
/booking/), `public/admin/manifest.json` (barber), service worker `public/sw.js` (never caches /api or /admin),
icons in `public/icons/`. Android/desktop Chrome show an "Install app" button; on iPhone use Safari →
Share → Add to Home Screen.

## Online booking (PHP + MySQL)

The booking page (`components/Booking.tsx`) is backed by a small PHP API that ships inside the static export:

| Path | What it is |
| --- | --- |
| `public/api/booking.php` | Public API: services, free time slots, create request, request status |
| `public/api/admin.php` | Barber API (login, approve / decline / cancel, block time, services, settings) |
| `public/api/_lib.php` | Shared logic: slots, conflicts, locking, WhatsApp drivers (never served directly) |
| `public/admin/index.php` | Barber panel at **/admin/** — also the one-time setup wizard |

**Rules**
- Earliest bookable time = now + *lead minutes* (default 30), on the time grid (default 30 min).
  Opening the page at 2:00 PM → first slot 2:30 PM.
- Pending **and** approved bookings block their time; booking writes are serialized with a database lock,
  so two clients can never get the same or overlapping time (checked again on approval).
- Every request starts as **pending** → the barber approves or declines in /admin/ → the client is notified
  on WhatsApp. The client's page updates live to "You're booked".
- Services, durations, prices, opening hours, closed days, rules and message texts are edited in /admin/.
  Prices also appear on the landing page services.

**WhatsApp** (Settings → WhatsApp notifications)
- *Manual* (default, free): the admin panel beeps / shows a notification for new requests (keep it open or
  add it to the home screen); after approving, one tap opens WhatsApp with the confirmation pre-written.
- *CallMeBot* (free): additionally sends every new request automatically to the barber's WhatsApp.
- *WhatsApp Cloud API* (Meta): fully automatic messages to barber and clients. Needs a Meta Business account,
  a phone number registered on the Cloud API and approved message templates.

**Setup on Hostinger (once)**
1. hPanel → Databases → create a MySQL database + user.
2. Upload the site, open `https://your-domain/admin/` and fill in the setup form.
   The config is saved *outside* `public_html` (`../basst-cut-config.php`), so re-uploading the site never
   erases it.
3. Log in → Settings: opening hours, barber WhatsApp number, notification method. Services & prices tab: edit.

## Hosting on Hostinger

The site is configured as a **static export** (`output: "export"` in `next.config.ts`) — no Node.js needed.

1. `npm install && npm run build` → everything is written to `out/` (includes `.htaccess`, `api/` and `admin/`).
2. In hPanel → **Websites → Manage → File Manager**, open the domain's `public_html`.
3. Upload the **contents** of `out/` (not the folder itself) — or upload a zip of them and use *Extract*.
   Make sure the hidden `.htaccess` file is included.
4. Visit the domain. Enable SSL in hPanel → **Security → SSL** if it is not already on.

The site must sit at the root of a domain or subdomain (e.g. `basstcut.com` or `basstcut.yourdomain.com`),
because asset paths start with `/_next/`. If it has to live in a sub-folder, set `basePath: "/folder"` in
`next.config.ts` and rebuild.

To update the site later: edit, `npm run build`, and re-upload `out/`.
