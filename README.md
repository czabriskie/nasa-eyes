# NASA Eyes

A small, dependency-free website for exploring NASA's EPIC imagery (Earth from
the DSCOVR satellite at the L1 Lagrange point). Built to make NASA's irregular
day-to-day coverage obvious *before* you go looking for a specific date.

## What it does

- **Calendar view** — month grid where days with imagery are highlighted and
  days NASA didn't capture are grayed out.
- **Day view** — click any available day to watch all of that day's images play
  as an Earth-rotation animation, with play/pause, scrub, frame-step, and FPS
  control.
- **Range view** — pick a window (default 14 days, max 30) and scroll/scrub
  through every frame as a horizontal filmstrip of thumbnails.
- **Compare view** — pick two dates and step through them side-by-side, matched
  by index or by closest time of day.

Every view has a shareable hash URL.

## Quick start

This is a static site — no build, no install.

```bash
cd nasa-eyes
python3 -m http.server 8000
# open http://localhost:8000/
```

`file://` won't work because the modules use `fetch`, which most browsers
disallow from `file://` origins. Any static server works.

## URLs

- `#/` — calendar (this month, `natural` collection)
- `#/cal/{collection}/{YYYY-MM}` — specific month
- `#/day/{collection}/{YYYY-MM-DD}` — animated day view
- `#/range/{collection}/{start}/{end}` — filmstrip
- `#/compare/{collection}/{a}/{b}` — side-by-side

Collections: `natural`, `enhanced`, `aerosol`, `cloud`.

## Architecture

```
index.html         · entry + view container
styles.css         · everything visual; CSS-only starfield
js/
  app.js           · hash router → view modules
  api.js           · NASA EPIC API wrapper
  state.js         · localStorage availability cache (6h TTL)
  ui.js            · small DOM helpers
  calendar.js      · month grid
  day.js           · animation player
  range.js         · filmstrip + scrubber
  compare.js       · two-date side-by-side
```

JSON metadata is fetched from `api.nasa.gov/EPIC/api/*` (mirrored EPIC data
with CORS on every collection). Images themselves still load from
`epic.gsfc.nasa.gov/archive/...` via `<img>` tags. No backend, no proxy.

The free `DEMO_KEY` allows 30 requests/hour per IP — fine for casual use
since the availability list is cached in localStorage for 6 hours per
collection. If you hit a rate limit, grab a personal key from
[api.nasa.gov](https://api.nasa.gov) and set it:

```js
localStorage.setItem("nasa-eyes:apiKey", "YOUR_KEY_HERE");
```

## Deploying

Push to GitHub and enable Pages (Settings → Pages → main / root). The site
will be live at `https://<user>.github.io/nasa-eyes/`.

## Credit

All imagery and JSON metadata come from [NASA's EPIC API](https://epic.gsfc.nasa.gov/).
This project is an independent viewer; it is not affiliated with NASA.

## License

MIT — see `LICENSE`.
