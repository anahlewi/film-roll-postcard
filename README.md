# Roll 24

A 35mm contact-strip interactive piece. Twenty-odd exposures on a translucent
strip; click a frame number (or drag the strip, or use the arrow keys) and the
roll advances with a Super-8 stutter and a synthesized shutter click.

Graduated from the single-file prototype in [`prototype/roll-24.html`](prototype/roll-24.html).

## Stack

| Concern    | Choice                                                              |
| ---------- | ----------------------------------------------------------------- |
| Build      | Vite + TypeScript, no UI framework — it's one page                 |
| Motion     | GSAP (`gsap.quickTo` transport + `Draggable` / `InertiaPlugin` fling) |
| Content    | Sanity — baked to JSON at build time (`scripts/fetch-content.ts`)  |
| Images     | Sanity CDN transforms, AVIF `srcset`, LQIP blur-up, gate ±2 lazy   |

## Shared rolls (Supabase + Vercel)

`/` lets anyone load a roll (1–36 photos, a "to", optional "from" and note) and
get a private link, `/r/<slug>`. The recipient sees a sealed canister, taps
**Open**, and gets the strip. `/demo` still shows the seed/Sanity roll.

```
browser ──► /api/rolls            (Vercel fn, service-role key) ─► rolls table: pending
        ──► PUT signed upload URL  (straight to Supabase Storage, bucket `rolls`)
        ──► /api/rolls/<slug>/publish                              ─► status: live
recipient ► /api/rolls/<slug>      (GET)       sender ► #delete=<token> ► DELETE
```

- Photos are resized to 1800px and re-encoded in the browser, which strips EXIF data (GPS included).
- The browser never gets a Supabase key. RLS is on with no policies, and the bucket can't be listed.
- The take-back token is stored only as a SHA-256 hash. It lives in the sender's link and in their `localStorage`.

Setup:

1. Supabase → SQL Editor → run `supabase/migrations/001_rolls.sql`.
2. Vercel → Project → Settings → Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   For local dev, put the same two in `.env`.
3. `npm run dev:full` (= `vercel dev`) runs Vite **and** `/api`. Plain `npm run dev` is front-end only.

## Run it

```bash
npm install
npm run dev
```

With no CMS configured it boots on a **seed roll** of 24 blank frames, so the
transport, sound and a11y all work immediately.

## Wire up the CMS

```bash
cd studio
npm install
npx sanity init          # creates a project + fills studio/.env
npm run dev              # http://localhost:3333 — create a Roll, add frames
```

Then back in the project root, bake that roll into the app:

```bash
cp .env.example .env     # fill in SANITY_PROJECT_ID + ROLL
npm run content          # writes src/content.generated.json
npm run dev
```

`npm run build` runs the bake automatically (`prebuild`) and falls back to the
seed roll if the env isn't set.

## Where the pieces live

```
src/
  film-strip.ts   FilmStrip class — DOM, selection state, transport, ARIA, URL hash
  edge-print.ts   rebate markings (half-frame tick, barcode, ISO, maker, arrow) from metadata
  audio.ts        synthesized SLR shutter (Web Audio, no files)
  image.ts        Sanity CDN srcset / transform helpers
  content.ts      loads content.generated.json, else the seed roll (/demo)
  maker.ts        / — load a roll: form, contact sheet, upload, share link
  viewer.ts       /r/<slug> — canister → strip; #delete= take-back screen
  process-image.ts  in-browser resize + EXIF strip
  api.ts          fetch client for /api
api/
  _lib/server.ts  service-role client, slugs, tokens
  rolls/…         create · get · publish · delete
  tokens.css      design tokens — palette, film geometry, type
  styles.css      component styles
scripts/
  fetch-content.ts   GROQ query -> src/content.generated.json
studio/           standalone Sanity Studio (its own package.json)
```

## Behaviour carried over from the prototype

- 4 frames in the gate; selection clamps so frame 24 can't scroll past the edge
- Roving `tabindex` on the numbers, `aria-current` on the active frame
- `aria-live` status region announces the frame and visible range
- `prefers-reduced-motion` → instant cut, no blur, no weave
- Shutter is never the only feedback; mute state persists in `localStorage`
- `#f=12` in the URL is read on load and kept in sync (shareable, no history spam)

## New in the real version

- **Drag the strip** to scrub; release to fling with inertia and snap to a frame
- **Velocity-linked motion blur** — tracked off per-frame travel distance
- Real images with responsive `srcset`, AVIF, blur-up placeholders, lazy windows
- Frame numbers preload their image target; only the gate ±2 are fetched

## Ideas parked for later

- **Link previews**: an OG image per roll (first 4 frames + "for Maya") via `@vercel/og`
- Rate-limit `POST /api/rolls` (Vercel KV / Upstash) + report button
- Cron to sweep `pending` rolls older than a day (and their storage folders)
- Reply with a roll of your own

- WebGL grain / light-leak / gate-weave pass (GSAP animates shader uniforms fine)
- `View Transitions` for the 4-frame window cross-fade
- Playwright: keyboard nav, reduced-motion, mute persistence
- Lighthouse CLS budget — image dimensions are already fixed
