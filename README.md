# Hauraki Gulf Wind — at-a-glance wind dashboard

A single-page web dashboard showing **live wind** (speed, gust, direction) at eight
points around the Hauraki Gulf. It's designed to be read **at a glance, from a distance** —
e.g. mounted on a screen at a yacht's helm — so it uses big numbers and colour-coded tiles,
with a **2-hour wind-speed trend graph** behind each tile (Strava-elevation style) so you can
see whether the wind is building or dropping.

The UI is a self-contained `index.html`, with a tiny Cloudflare Pages Function proxy under
`functions/api/` so hosted browsers can retrieve Zephyr data even when Zephyr does not send
browser CORS headers.

---

## What's in this folder

| File | Purpose |
|------|---------|
| `index.html` | The browser app — HTML, CSS and JavaScript in one file. |
| `functions/api/` | Same-origin Cloudflare Pages Function proxy for Zephyr JSON. |
| `netlify/functions/` | Same-origin Netlify Functions proxy for Zephyr JSON. |
| `_headers` | Security headers for the hosted site. |
| `_routes.json` | Limits Function invocation to `/api/*` only. |
| `wrangler.toml` | Cloudflare Pages local/deploy configuration. |
| `netlify.toml` | Netlify redirects, function path and security headers. |
| `README.md`  | This file — how to run and deploy. |
| `AI-CONTEXT.md` | Full project context, design intent, decision history and the reverse-engineered data source — **hand this to an AI assistant** to continue the project. |

---

## Quick start (run it locally)

Because the app now uses a same-origin `/api` proxy, don't double-click `index.html` for a
production-like test. Use Cloudflare's local Pages runner:

```bash
npx wrangler pages dev . --port 8788
# then open http://localhost:8788
```

If you only want to inspect the layout without live data, any local static server is fine:

```bash
cd hauraki-gulf-wind
python3 -m http.server 8137
# then open http://localhost:8137 in your browser
```

You need an internet connection for live data.

---

## Deploy it (put it on a public URL)

## Host it: recommended plan

Use **Cloudflare Pages**. It is the best fit because it serves the static dashboard and the
same-origin proxy from one free project, with HTTPS and edge caching.

1. Put this folder in a GitHub repository.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Import an existing
   Git repository**.
3. Build command: `exit 0`
4. Build output directory: `.`
5. Deploy. Cloudflare will serve the app on `https://<project>.pages.dev`.
6. Open the site and check `/api/stations` returns JSON, then confirm the eight tiles fill.

Why not static-only hosting?

- **GitHub Pages** is free and reliable for static files, but it cannot run the `/api` proxy.
- **Netlify** and **Vercel** can run functions, but this repository is already wired for
  Cloudflare Pages Functions, whose free plan comfortably fits this dashboard. Netlify support
  is also included as a fallback if Cloudflare account verification blocks deployment.
- **Netlify Drop** and other drag-and-drop static hosts are not enough unless you add their
  function equivalent.

### Netlify fallback

If Cloudflare blocks project creation, deploy the same GitHub repo on Netlify:

1. Open <https://app.netlify.com/start>.
2. Choose **Import from Git** and select `Bregiz/hauraki-gulf-wind2`.
3. Build command: `true`
4. Publish directory: `.`
5. Functions directory: `netlify/functions` (Netlify normally reads this from `netlify.toml`).
6. Deploy, then verify `/api/stations` returns JSON and the dashboard fills.

### Security posture

- The browser fetches only same-origin URLs (`/api/stations` and `/api/station-data?id=...`).
- The proxy only fetches hard-coded Zephyr endpoints and only allows the eight known station
  IDs for history, so it is not an open proxy.
- `_headers` sets a restrictive Content Security Policy: app code can connect only to `self`.
- Data is public wind-station JSON; no secrets or API keys are stored in the browser or proxy.
- Responses are cached briefly to reduce load and stay well within free-tier function limits.

---

## How it works

- Wind data comes from **Zephyr** (<https://www.zephyrapp.nz>), a New Zealand live
  wind-station aggregator, via its JSON API at `https://api.zephyrapp.nz`.
- On load — and then every 60 seconds — the page calls:

  ```
  GET /api/stations
  ```

  The Cloudflare Function forwards that request to `https://api.zephyrapp.nz/stations`,
  returning ~480 stations, each with its current readings. The page filters that list down
  to the eight stations it shows, matched by station `_id`.
- The API reports wind in **km/h**; the page converts to **knots** (÷ 1.852).
- For the **2-hour trend graph** behind each tile, the page also calls
  `GET /api/station-data?id={id}` (per station, every 5 minutes). The proxy forwards this to
  Zephyr's history endpoint; the page keeps only the last 2 h.

Useful fields on each station object:

| Field | Meaning |
|-------|---------|
| `currentAverage` | average wind speed (km/h) |
| `currentGust`    | gust speed (km/h) — `null` on some buoys |
| `currentBearing` | wind direction in degrees, the direction it is blowing **from** |
| `lastUpdate`     | ISO timestamp of the reading (drives the per-tile age label) |
| `isOffline`      | station currently offline |
| `location.coordinates` | `[lon, lat]` |

---

## The stations shown

Edit these in the `STATIONS` array near the top of the `<script>` block in `index.html`.

| Tile name | Zephyr `_id` | Notes |
|-----------|--------------|-------|
| Passage Rock      | `6631d5ddcf26372d5b80413b` | |
| Tāmaki Strait     | `68f65b7ce3323e552ce3b2a5` | Stands in for **Bastion Point** (not in Zephyr). Buoy → no gust. |
| Tiritiri Matangi  | `69f7dd013fd033f10b5f8696` | |
| Channel Island    | `6631d5ddcf26372d5b8040a2` | |
| Te Kouma Heads    | `6631d5ddcf26372d5b80414c` | |
| Manukau Head      | `6631d5ddcf26372d5b804176` | |
| Rangitoto Buoy    | `68f65ba0e3323e552ce3b2dc` | Buoy → no gust. |
| Whangaparāoa      | `6631d5ddcf26372d5b8040c0` | |

### To change or add a station
1. Open <https://api.zephyrapp.nz/stations> in a browser (it's plain JSON — use a JSON
   viewer or your browser's search to find a station by `name`).
2. Copy that station's `_id`.
3. Add/edit an entry in the `STATIONS` array in `index.html`:
   ```js
   { id:"PASTE_THE_ID_HERE", name:"Your label" },
   ```
4. Save and reload. The layout auto-flows however many stations you list.

---

## Customising

- **Polling rate:** `setInterval(refreshAll, 60*1000)` — change `60` to taste. Note: most
  of these stations only update upstream every ~10 minutes, so polling faster won't get
  you fresher numbers.
- **Wind-strength colour bands:** `bandKey()` and `bandLabel()` define the knot thresholds
  — Light `< 11`, Moderate `< 21`, Fresh `< 31`, Strong `< 34`, Gale `≥ 34`. The colours
  live as CSS variables (`--calm`, `--mod`, `--fresh`, `--gale`) inside the
  `[data-theme="day"]` / `[data-theme="night"]` blocks.
- **Day / Night themes:** the page auto-picks by time of day and you can toggle with the
  ☀ / 🌙 button (the choice is remembered in `localStorage`). Each theme is just a set of
  CSS-variable values.
- **Fullscreen:** the ⛶ button toggles fullscreen — handy for a mounted/kiosk screen.
- **Trend graph:** the background chart shows the last **2 hours** and refreshes every 5 min.
  Adjust the window in `twoHourPoints()` and the cadence in `setInterval(fetchHistory, …)`;
  styling (line/fill opacity, colour) is in `drawGraph()`.
- **Layout:** a CSS grid that fills the viewport — 4 columns on a wide monitor, 2 on a
  tablet, 1 on a phone. Numbers scale with the screen via CSS `clamp()`.

---

## Known limitations / things to be aware of

- **Unofficial API.** Zephyr's API isn't a documented public product — it could change
  without notice. If readings stop, first check that <https://api.zephyrapp.nz/stations>
  still returns JSON and that the `_id`s above still exist.
- **Browser CORS is not guaranteed.** On 2026-06-26, Zephyr returned valid JSON server-side
  but did not include `Access-Control-Allow-Origin` on the GET response. The Cloudflare proxy
  is therefore part of the hosting plan, not an optional extra.
- **Bastion Point isn't in Zephyr's network**, so the board uses the **Tāmaki Strait Buoy**
  in that slot.
- **Buoy stations** (Tāmaki Strait, Rangitoto) report an average only — **no gust**
  (shown as `G –`) — and update less frequently.
- **Not official Coastguard / MetService data.** These are similar station feeds, but treat
  the dashboard as situational awareness, **not** an official forecast or observation
  source. Always cross-check Coastguard / MetService for any safety-critical decision.

---

## Ideas for continuing

- A **"strongest wind first"** sort toggle (currently a fixed geographic order).
- A **red-tinted night mode** to preserve night vision on passage.
- Cache the last good readings in `localStorage` so the board still shows something if the
  connection drops.

---

*Built as a single static page — no frameworks, no tooling. Open it, edit it, ship it.*
# hauraki-gulf-wind2
