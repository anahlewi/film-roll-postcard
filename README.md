# Film Roll Postcard

Load a roll of photos onto a 35mm contact strip and send it to one person.
They get a private link, open the canister, and wind through the frames —
click a frame number, drag the strip, or use the arrow keys — with a Super-8
stutter and a synthesized shutter click.

## Pages

| Route       | What it is                                                             |
| ----------- | ---------------------------------------------------------------------- |
| `/`         | Load a roll: to / from / note, 1–36 photos, reorder, get a link         |
| `/r/<slug>` | The recipient's side: sealed canister → **Open** → the strip + note     |
| `/r/<slug>#delete=<token>` | The sender's take-back link — deletes the roll and photos |
| `/demo`     | A sample roll, for working on the strip without the API                 |

## Stack

| Concern  | Choice                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Build    | Vite + TypeScript, no UI framework                                      |
| Motion   | GSAP (`Draggable` + `InertiaPlugin` drag-to-fling, snap to frame)       |
| API      | Vercel functions in `api/`                                              |
| Data     | Supabase — `rolls` table + `rolls` storage bucket                       |

## How a roll gets made

```
browser ──► POST /api/rolls                  ─► rolls row, status: pending
        ──► PUT signed upload URL            ─► straight to Supabase Storage
        ──► POST /api/rolls/<slug>/publish   ─► status: live
recipient ► GET /api/rolls/<slug>
sender ───► DELETE /api/rolls/<slug>  (Bearer <delete token>)
```

- Photos are resized to 1800px and re-encoded **in the browser**, which strips
  EXIF — GPS included — before anything is uploaded.
- The browser never holds a Supabase key. RLS is on with no policies; only the
  functions (service-role key) touch the database. The bucket can't be listed.
- Links are 10 random characters. The delete token is stored only as a
  SHA-256 hash; the sender keeps it in their link and `localStorage`.
- Uploaded photos are cached for an hour, so a taken-back roll's images stop
  serving soon after.

## Set up

1. **Supabase** → SQL Editor → run `supabase/migrations/001_rolls.sql`.
2. `cp .env.example .env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. **Vercel** → Project → Settings → Environment Variables: the same two.

```bash
npm install
npm run dev:full
```

`dev:full` is `vercel dev` — Vite **and** `/api`. Plain `npm run dev` is
front-end only (the maker loads, but can't develop a roll; `/demo` works).

Check the whole pipeline against the real project (creates a roll, uploads,
publishes, reads, deletes — leaves nothing behind):

```bash
npx tsx --env-file=.env scripts/smoke-test.ts
```

## Where the pieces live

```
src/
  main.ts           routes: / · /r/<slug> · /demo
  maker.ts          / — form, contact sheet, upload, share link
  viewer.ts         /r/<slug> — canister → strip; #delete= take-back screen
  film-strip.ts     FilmStrip — DOM, selection, transport, ARIA, URL hash
  edge-print.ts     rebate markings (tick, barcode, ISO, maker, arrow)
  audio.ts          synthesized SLR shutter (Web Audio, no files)
  process-image.ts  in-browser resize + EXIF strip
  api.ts            fetch client for /api
  content.ts        the /demo sample roll
  tokens.css        design tokens — palette, film geometry, type
  styles.css        the strip
  pages.css         maker + canister pages
api/
  _lib/server.ts    service-role client, slugs, tokens
  rolls/…           create · get · publish · delete
supabase/migrations/  schema + bucket
scripts/smoke-test.ts
```

## Design

One committed look: a bare strip on black, one pixel font (Silkscreen), and
the edge-print orange as the only accent.

## Accessibility

- Roving `tabindex` on frame numbers, `aria-current` on the active frame
- `aria-live` status announces the frame and visible range
- `prefers-reduced-motion` → instant cut, no blur, no weave
- The shutter is never the only feedback; mute persists in `localStorage`
- `#f=12` in the URL opens at that frame

## Next

- Link previews: an OG image per roll (first 4 frames + "for Maya")
- Rate-limit `POST /api/rolls` and add a report button
- Daily sweep of `pending` rolls that never got published
- Terms / privacy page
- Reply with a roll of your own
