# AI Handoff — Hauraki Gulf Wind Dashboard

> **Read me first if you are an AI assistant picking up this project.**
> This document gives you the complete context, design intent, decision history, and the
> reverse-engineered data source so you can continue work without re-discovering anything.
> The companion `README.md` is the human-facing run/deploy guide; this file is the deeper
> "why". Last updated: **2026-06-26**.

---

## 1. What this project is

A single-page web dashboard that shows **live wind** (speed, gust, direction) at **eight
points around the Hauraki Gulf, New Zealand**. The owner is a yachtie who normally reads
this kind of data from the NZ **Coastguard app**; this is a self-built replacement they can
mount on a screen.

**Primary use context (drives every design decision): a display glanced at from a distance,
on a yacht — bright sun, motion, quick looks.** Optimise for legibility-at-a-distance and
"colour as signal", not for dense information.

The UI lives in **one file: `index.html`** — plain HTML + CSS + vanilla JS. Hosted data
requests go through a tiny Cloudflare Pages Function under `functions/api/` because Zephyr's
GET responses currently do not include browser CORS headers. Keep the UI dependency-free;
the proxy should stay small and defensive.

---

## 2. Current state (what's done and working)

- 8 station tiles, live data, auto-refresh every 60 s, with a "● LIVE / synced Xs ago" header.
- **Heat-map tiles**: each tile is tinted by wind-strength band so the whole board reads at a
  glance — calm=green, moderate=blue, fresh=amber, strong/gale=red.
- **2-hour trend graph behind every tile** (Strava-elevation style): a smooth, auto-scaled
  filled-area chart of the last 2 h of wind speed, colour-matched to the band, sitting behind
  the numbers so you can spot whether wind is building or dropping. Refreshes every 5 min.
- **Big, screen-scaling numbers** (CSS `clamp()`): wind speed (hero, band-coloured), gust
  (`G NN`), large direction arrow + cardinal + degrees.
- **Day / Night themes** (CSS-variable swap), auto-picked by time of day, toggled with the
  ☀/🌙 button, remembered in `localStorage`.
- **Fullscreen (⛶) button** for kiosk/mounted use; **↻** manual refresh.
- **Responsive kiosk layout** filling the viewport: 4 columns (monitor) / 2 (tablet) /
  1 (phone).
- Browser app now calls same-origin `/api/...` endpoints, which Cloudflare Pages Functions
  proxy to Zephyr. This avoids CORS failures and lets the hosted app use a restrictive CSP.

It is **ready to deploy to Cloudflare Pages** (see README).

---

## 3. Data source — Zephyr (the important part)

Wind comes from **Zephyr** (https://www.zephyrapp.nz), a NZ live wind-station aggregator
(built for paragliding) with an **undocumented but open** JSON API.

- **Upstream base URL:** `https://api.zephyrapp.nz`
- **Browser base URL:** `/api`
- **Main call used:** `GET /stations` — returns an array of **~480 stations**, each already
  carrying its *current* reading. The page fetches this once per cycle and filters to our 8
  by `_id`. (A `?_=<timestamp>` cache-buster is appended.)
- **Units are km/h.** The page converts to **knots** by `÷ 1.852` (constant `KMH_TO_KN`).
- **CORS is not reliable/open on GET responses.** On 2026-06-26, `curl -H 'Origin:
  https://example.com' https://api.zephyrapp.nz/stations` returned JSON but no
  `Access-Control-Allow-Origin` header. The browser therefore calls Cloudflare's same-origin
  proxy at `/api`, and the proxy fetches Zephyr server-side.

### Station object shape (fields that matter)
```jsonc
{
  "_id": "6631d5ddcf26372d5b80413b",
  "name": "Passage Rock",
  "currentAverage": 26.0,     // km/h, average wind  (null on some buoys)
  "currentGust": 30.0,        // km/h, gust          (null on some buoys)
  "currentBearing": 180,      // degrees, direction wind is FROM (null possible)
  "currentTemperature": null,
  "lastUpdate": "2026-06-26T08:40:02Z",
  "location": { "type": "Point", "coordinates": [175.117, -36.847] }, // [lon, lat]
  "isOffline": false,
  "isError": false,           // SEE NOTE below — often true even when data is fine
  "type": "metservice"        // source feed: metservice | holfuy | harvest | tempest | windy | windguru | ac (buoys) | cp ...
}
```

### History endpoint — `GET /stations/{id}/data` (USED for the 2-hour trend graphs)
Returns an array of ~145 readings covering the **last 24 h**, **newest-first**, at ~10-min
spacing. Each item: `{ time (ISO), windAverage, windGust, windBearing, temperature, _id }`.
**Wind values are km/h here too** (same `÷1.852` to knots). The app filters to the last 2 h,
sorts ascending by `time`, and draws the background area graph. Buoys report fewer points.

### Proxy files
- `functions/api/stations.js` forwards `GET /api/stations` to Zephyr's station list and
  caches briefly.
- `functions/api/station-data.js` forwards `GET /api/station-data?id=...`, but only for the
  eight whitelisted station IDs. This prevents the deployment becoming a generic open proxy.
- `functions/api/stations/[id]/data.js` is the older path-style history route and is retained
  for compatibility.
- `netlify/functions/stations.mjs` and `netlify/functions/station-data.mjs` provide the same
  proxy behavior for Netlify. `netlify.toml` rewrites `/api/...` to those functions, so
  `index.html` does not need host-specific code.
- `_routes.json` limits Pages Function invocation to `/api/*` so ordinary static asset
  requests do not consume function quota.
- `_headers` locks the browser down with CSP (`connect-src 'self'`), framing protection,
  no-sniff, referrer policy and permissions policy.

### Other endpoints discovered (available, not currently used)
- `GET /stations/{id}` — single station
- `GET /stations/data?time=<ISO>` — all stations' data at a time
- `GET /elevation?lat=&lon=`
- `GET /sites`, `/webcams`, `/soundings`, `/landings`, `/donations` — other layers

### ⚠️ Gotchas with Zephyr data
- **`isError: true` does NOT mean "no data".** Many healthy MetService-fed stations carry
  `isError: true` while still returning valid current values. Don't hide a station just
  because of this flag. Use `isOffline` and `lastUpdate` age to judge freshness instead.
- **Buoy stations** (`type: "ac"`, e.g. Tāmaki Strait Buoy, Rangitoto Buoy) report an
  **average only — no gust** (`currentGust` is null), and update less often (~25 min vs
  ~5–10 min for MetService).
- **Unofficial API:** could change without notice. If the board goes blank, first check that
  `https://api.zephyrapp.nz/stations` still returns JSON and the `_id`s below still exist.

---

## 4. The 8 stations on the board

Defined in the `STATIONS` array at the top of the `<script>` in `index.html`.

| Tile name | Zephyr `_id` | Notes |
|-----------|--------------|-------|
| Passage Rock      | `6631d5ddcf26372d5b80413b` | |
| Tāmaki Strait     | `68f65b7ce3323e552ce3b2a5` | **Stands in for Bastion Point** (not in Zephyr). Buoy → no gust. |
| Tiritiri Matangi  | `69f7dd013fd033f10b5f8696` | |
| Channel Island    | `6631d5ddcf26372d5b8040a2` | |
| Te Kouma Heads    | `6631d5ddcf26372d5b80414c` | |
| Manukau Head      | `6631d5ddcf26372d5b804176` | |
| Rangitoto Buoy    | `68f65ba0e3323e552ce3b2dc` | Buoy → no gust. |
| Whangaparāoa      | `6631d5ddcf26372d5b8040c0` | |

The owner's original wishlist was: Passage Rock, Bastion Point, Tiritiri Matangi, Channel
Rock/Island, Te Kouma Harbour, Manukau Harbour. **Bastion Point is not in Zephyr's network**,
so the owner chose **Tāmaki Strait Buoy** as the inner-Waitematā stand-in. Rangitoto Buoy and
Whangaparāoa were added at the owner's request.

To change/add stations: open `https://api.zephyrapp.nz/stations`, find the station by `name`,
copy its `_id`, add `{ id:"…", name:"…" }` to `STATIONS`, reload. Layout auto-flows.

---

## 5. Code map (`index.html`)

**`<style>`**
- Theme tokens under `[data-theme="day"]` and `[data-theme="night"]` (CSS variables for
  bg/text/muted/line and the four band colours `--calm --mod --fresh --gale`).
- Tiles tint themselves with `color-mix(in srgb, var(--c) 9%, var(--tile-bg))`, where `--c`
  is set per-tile by `[data-band="calm|mod|fresh|gale"]`. **Changing theme recolours
  everything automatically — no JS re-render needed.**
- Responsive grid (`main`) fills the viewport; `clamp()` scales all type.

**`<script>`** (top → bottom)
- `STATIONS` — the 8 `{id,name}` entries. **Edit here to change stations.**
- `API_BASE` — currently `/api`; keep this same-origin for hosted deployments.
- Helpers: `KMH_TO_KN`, `DIRS`/`compass()`, `bandKey()` (knots→band), `bandLabel()`
  (knots→label), `ageText()` (relative obs age).
- Build phase: one skeleton `<section class="tile">` per station appended to `#grid`.
- `fetchAll()` — `GET /api/stations`, returns a `{_id: station}` map.
- `renderStation(el, st)` — converts km/h→kn, picks hero (avg, falling back to gust), sets
  `data-band`, the age label, the speed+gust block, and the direction arrow (rotated to
  `bearing+180` so it points **downwind**) + cardinal + band pill.
- **History graphs**: `twoHourPoints()` (filter+convert+sort), `smoothLine()`
  (Catmull-Rom→Bézier for the Strava-style curve), `drawGraph(i, pts)` (builds the inline SVG
  area+line into the tile's `.graph` layer, auto-scaling y per tile), and `fetchHistory()`
  (fetches all 8 `/api/station-data?id=...` in parallel, every 5 min). The `.graph` div is an
  absolutely-positioned `z-index:0` layer; tile content sits at `z-index:1`. Graph colour uses
  `var(--c)`, so it recolours automatically with theme/band — no redraw needed for those.
- `updateClock()` / `refreshAll()` — the poll loop and the "synced … ago" / stale logic.
- Theme + kiosk wiring: `setTheme()` (+ localStorage + auto-by-hour), fullscreen, refresh.
- Timers: `refreshAll` every 60 s, `updateClock` every 1 s, plus a refresh on tab re-focus.

---

## 6. Decision log (so you don't re-litigate these)

- **Data source = Zephyr.** The first prototype used **Open-Meteo** (free, no key, open CORS)
  but that is **modelled** wind, not real station obs. The owner pointed us at zephyrapp.nz
  and we switched to its **real anemometer** data. *Rejected alternatives:* **MetService
  1-Minute Observations API** (genuine obs but needs an emailed auth token + a proxy — too
  much friction) and **PredictWind** (has stations here but data is locked behind its
  app/login). The owner's original source, **Coastguard Nowcasting**, has no open web API
  (it's VHF broadcast + text "A" to WIND 9463).
- **Bastion Point → Tāmaki Strait Buoy** (owner's explicit choice among offered options).
- **Card order: fixed/geographic.** The owner **declined** live "sort by strongest" — keep it
  stable unless they ask.
- **Units: knots** (boating convention).
- **UX: full kiosk redesign** for the yacht-helm context — heat-map tiles, huge numbers,
  day/night, fullscreen. This replaced an earlier plain-card layout.

---

## 7. Known limitations

- Unofficial Zephyr API (may change).
- Buoys report no gust and update slowly (see §3 gotchas).
- Upstream cadence is ~10 min for MetService-type stations, so sub-minute "real-time" isn't
  achievable from this source — polling faster won't help.
- **Not official Coastguard/MetService data.** Situational awareness only — the owner should
  cross-check official sources for safety-critical calls. Preserve this framing in the UI.

---

## 8. Suggested next steps (owner-floated, not yet built)

- **Sort toggle** — optional "strongest wind first" mode (default stays fixed order).
- **Red-tinted night mode** — to preserve night vision on passage.
- **Offline cache** — stash last-good readings in `localStorage` so the board shows something
  when the connection drops; show an explicit "stale" state.

---

## 9. How to run / verify / deploy

- **Run with live data:** `npx wrangler pages dev . --port 8788` then open
  `http://localhost:8788`.
- **Verify quickly:** `/api/stations` should return a large JSON array, and the 8 tiles
  should populate within ~2 s. No console errors expected.
- **Deploy:** Cloudflare Pages. Build command `exit 0`, build output directory `.`.
  HTTPS is provided by Cloudflare. If Cloudflare account verification blocks project creation,
  use Netlify with build command `true`, publish directory `.`, and functions directory
  `netlify/functions`.

---

*If you change behaviour, please keep this file and `README.md` in sync with reality.*
