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

## Hosting on Hostinger

The site is configured as a **static export** (`output: "export"` in `next.config.ts`) — no Node.js needed.

1. `npm install && npm run build` → everything is written to `out/` (≈1.2 MB, includes `.htaccess`).
2. In hPanel → **Websites → Manage → File Manager**, open the domain's `public_html`.
3. Upload the **contents** of `out/` (not the folder itself) — or upload a zip of them and use *Extract*.
   Make sure the hidden `.htaccess` file is included.
4. Visit the domain. Enable SSL in hPanel → **Security → SSL** if it is not already on.

The site must sit at the root of a domain or subdomain (e.g. `basstcut.com` or `basstcut.yourdomain.com`),
because asset paths start with `/_next/`. If it has to live in a sub-folder, set `basePath: "/folder"` in
`next.config.ts` and rebuild.

To update the site later: edit, `npm run build`, and re-upload `out/`.
