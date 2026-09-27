# OSMRoad

**Browser-based OSM Road Network Visualizer — Visualize, inspect, and analyze OpenStreetMap road networks**

Load `.osm.pbf` files directly in your browser. The parsing, indexing and rendering all happen client-side in Web Workers and WebAssembly — the edge Worker only serves the app shell, the sample extracts and one AI endpoint.

Visit **[osmroad.gislabs.workers.dev](https://osmroad.gislabs.workers.dev)** to try it now.

![OSMRoad Demo](https://github.com/user-attachments/assets/a836701b-3234-41b0-b67a-c2d8a7e89abc)

---

## Features

### Core Map

- **PBF File Loading** — Drag & drop `.osm.pbf` files, parsed entirely client-side via Web Workers
- **Streaming Load** — Large extracts are streamed into the worker as a transferable `ReadableStream`, so the main thread never materialises the whole file
- **GeoParquet Support** — Open and export `.geoparquet` alongside PBF (see [Formats](#formats))
- **Road Visualization** — Color-coded highway classification (motorway → track) with oneway arrows and dashed lines
- **Node Markers** — Traffic signals, stop signs, barriers, crossings with icons
- **7 Basemaps** — Dark Matter, Positron, Voyager, OSM Standard, Dark, Light, No Basemap (auto light/dark theme)
- **Cursor Coordinates** — Real-time lat/lon at bottom-left as you move the cursor
- **Geocoding Search** — Search places via Nominatim or enter `lat,lon` directly to fly to location
- **Street View** — Click any road/node → Inspect panel → "Open Street View" opens Google Maps in new tab

### Analysis

- **AI Query Assistant** — Ask questions in natural language (English/Indonesian). Runs on SumoPod (OpenAI-compatible) with a Workers AI fallback, and a fully offline local parser behind both
- **Turn-by-Turn Routing** — Click two points to route; shows distance, time, and road segments
- **Entity Search** — Search by ID (`way/123`, `node/456`) or tag value (`highway=primary`)
- **Access Restrictions Layer** — Visualize `motor_vehicle=no`, `access=no`, barriers
- **Speed Data Overlay** — Load CSV speed data for traffic analysis
- **Overpass API** — Draw bbox on map and fetch live OSM data from Overpass API

### Editing & Export

- **Tag Editing** — Edit OSM tags for nodes and ways directly in the browser
- **PBF Export** — Download edited data back to `.osm.pbf`, full dataset or roads-only
- **GeoParquet Export** — Convert a loaded dataset to columnar GeoParquet in-browser
- **Layer Toggle** — Show/hide roads, nodes, restrictions, access layers

### Performance & Memory

- **Smart Render Strategy** — Automatically selects full-vector / hybrid / raster render mode based on file size
- **Lazy Subsystems** — DuckDB-wasm and the KML/KMZ/shapefile parsers load only when a feature needs them
- **Memory Monitor** — Live memory usage with warnings at >80%
- **Large File Support** — Files with 24M+ nodes handled via raster preview + vector tiles at high zoom

### Mobile

- **Responsive Layout** — Full-screen map on mobile with floating controls
- **Bottom Sheet** — Draggable iOS-style panel (snap at 40%, 70%, 92%)
- **Tap to Inspect** — Tap a road → Inspect panel opens automatically
- **Mobile Controls** — Zoom +/-, geolocation, layers toggle at bottom-right

---

## Quick Start

### Online

Visit **[osmroad.gislabs.workers.dev](https://osmroad.gislabs.workers.dev)**

### Local Development

```bash
npm install
npm run dev          # Vite only — http://localhost:5173
```

`npm run dev` serves the frontend alone: no Worker, no R2 samples, no AI route. The app falls back to its offline NL2SQL parser, and you can drop in any local file.

To run the whole stack locally, including the API route and R2-backed samples:

```bash
npm run cf-dev       # builds, then wrangler dev — http://localhost:8787
```

---

## How to Use

### Loading OSM Data

Three ways to load data:

1. **Upload PBF** — Drag & drop `.osm.pbf` onto the map, or use the File panel
2. **Sample Data** — Load built-in samples: Bali (~14 MB), Singapore (~14 MB), Chinese Taipei (~71 MB), plus a GeoParquet build of Bali (~25 MB)
3. **Overpass API** — Draw a bounding box on the map → fetch live data from OSM

> Samples are streamed from R2 by the Worker, not bundled as static assets.
> Cloudflare caps a single static asset at 25 MiB and the Taipei extract alone is 75 MB.

### AI Query Assistant

1. Load OSM data and wait for it to be ready
2. Click the **Sparkles (AI)** icon in the sidebar
3. Ask in English or Indonesian:
   - `"How many motorways?"` / `"Berapa jalan tol?"`
   - `"Show primary roads longer than 5km"`
   - `"Total panjang semua jalan"`
4. SELECT results are highlighted amber on the map with auto-zoom

### Inspecting Roads & Nodes

- **Desktop**: Click any road or node → Inspect panel opens in sidebar
- **Mobile**: Tap any road or node → bottom sheet opens automatically at 40% height
- Panel shows: type, ID, all OSM tags, coordinate (with copy), Street View button

### Routing

1. Open the **Route** panel
2. Click "Set Start" then click a point on the map
3. Click "Set End" then click another point
4. Route renders with distance and estimated time

---

## Formats

| Format | Open | Export | Notes |
|--------|:----:|:------:|-------|
| `.osm.pbf` | ✅ | ✅ | Primary format. Smallest for road extracts; supports streaming load |
| `.geoparquet` | ✅ | ✅ | Columnar, WKB geometry, OSM tags as JSON |
| `.osm` (XML) | ✅ | — | Parsed via DOMParser |
| `.geojson` | ✅ | — | |
| `.gpx` / `.kml` / `.kmz` | ✅ | — | Parser loaded on demand |
| `.zip` (shapefile) | ✅ | — | Parser loaded on demand |

### A note on GeoParquet size

GeoParquet is offered as an **interchange** format, not as a compaction win. Measured on the Bali sample (a road-only extract):

| | .osm.pbf | .geoparquet |
|---|---|---|
| File size | 14.3 MB | 25.5 MB |
| Load time | 1016 ms | 1430 ms |
| Heap at load | +34 MB | +666 MB |

PBF delta-encodes coordinates and stores each node once, referenced by every way that uses it. GeoParquet's WKB geometry repeats full float64 coordinates per feature and carries no node table. If your source is a **full** OSM extract rather than a roads-only one, converting to GeoParquet is a large win, because everything that is not a road is dropped at conversion time. Use it to move data between this app, QGIS, GeoPandas and DuckDB — not to shrink a file you already filtered.

### Converting from the command line

```bash
# Roads only (default)
node scripts/pbf-to-geoparquet.mjs indonesia-latest.osm.pbf

# Every way plus tagged nodes
node scripts/pbf-to-geoparquet.mjs indonesia-latest.osm.pbf out.geoparquet --all
```

Requires Node 23+ for native TypeScript type-stripping, because the script imports the same encoder the browser worker uses (`src/lib/geoparquet-encode.ts`).

---

## AI Query Details

The AI assistant degrades through three levels:

```
User query
    ↓
POST /api/ai/query  (Cloudflare Worker)
    ├── SumoPod        OpenAI-compatible, used when AI_API_KEY is set
    └── Workers AI     binding, used when the key is unset or SumoPod fails
    ↓ no provider produced usable SQL (offline / 503 / rate-limited)
Local NL2SQL parser (offline, in the browser)
    ↓
Execute on:
  Small files (<50K roads)  → DuckDB-wasm
  Large files (>50K roads)  → Worker streaming (10K batches)
    ↓
Highlight results on map
```

Supported query types: COUNT, SELECT, AGGREGATE, GROUP BY — in English and Indonesian.

`POST /api/ai/query` accepts `{ "prompt": "..." }` and returns:

```json
{ "sql": "SELECT ...", "success": true, "source": "sumopod", "model": "gpt-4o-mini" }
```

`source` is `sumopod`, `workers-ai`, or `heuristic` (the Worker's own deterministic fallback for a few very common questions). On failure it returns a non-2xx status with `{ "success": false, "error": "..." }` and the client falls back to its local parser.

### Configuring the AI backend

SumoPod is the preferred backend. It speaks the OpenAI chat-completions API, so no SDK is involved — the Worker makes one `fetch` to `$AI_BASE_URL/chat/completions`.

```bash
npx wrangler secret put AI_API_KEY     # your SumoPod key, never written to a file
```

Without that secret the endpoint falls back to the Workers AI binding, so the feature works out of the box and a provider outage degrades instead of breaking. Three tunables live in `wrangler.jsonc`:

| Var | Purpose |
|-----|---------|
| `AI_BASE_URL` | Provider base URL (`https://ai.sumopod.com/v1`) |
| `AI_MODEL` | SumoPod model id — change this to switch models, no code change |
| `AI_FALLBACK_MODEL` | Workers AI model used when SumoPod is unavailable |

> **This endpoint is public and, with a provider key set, spends real money.**
> `ALLOWED_ORIGINS` rejects requests whose `Origin` is not the app itself, which
> stops a random web page from calling it — but `Origin` is trivial to forge from
> a non-browser client, so it is a brake, not a security boundary. The in-isolate
> rate limit is best-effort only (isolates are ephemeral and per-colo). If you
> expose this beyond yourself, add a **Cloudflare Rate Limiting rule** on
> `/api/ai/query` and set a budget cap in the SumoPod dashboard.


---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Tailwind CSS v4 |
| Map | MapLibre GL JS 5.x |
| State | Zustand |
| Build | Vite 6 |
| OSM parsing | osmix + Comlink (Web Workers) |
| GeoParquet | hyparquet (read, via osmix) + hyparquet-writer (write) |
| SQL queries | DuckDB-wasm (loaded on demand) |
| AI / NL2SQL | SumoPod (OpenAI-compatible) → Workers AI → offline parser |
| Deployment | Cloudflare Workers + Static Assets, R2 for large binaries |
| PWA | vite-plugin-pwa + Workbox |

---

## Deployment

Everything ships as one Cloudflare Worker: the Worker script handles `/api/*`, `/samples/*` and `/duckdb/*`, and everything else is served from the Vite build in `./dist` by the static-asset layer.

```bash
npm run cf-typegen      # regenerate binding types after editing wrangler.jsonc
npm run build           # → ./dist (~3 MB)
npm run deploy          # build + wrangler deploy
```

Large binaries live in R2 and are **not** part of a deploy. Upload them once, or again whenever `./samples` changes:

```bash
npm run assets:upload   # ./samples/* + the DuckDB wasm module
```

Bindings (see `wrangler.jsonc`):

| Binding | Resource | Purpose |
|---------|----------|---------|
| `ASSETS` | Static assets (`./dist`) | App shell |
| `STORAGE` | R2 bucket `osmroad-samples` | Sample extracts + DuckDB wasm |
| `AI` | Workers AI | NL2SQL fallback backend |
| `AI_API_KEY` | Worker secret | SumoPod key (optional; unset = Workers AI only) |

CI: `.github/workflows/deploy.yml` typechecks and builds on every PR, and deploys on push to `main` using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

---

## License

MIT © OSMRoad Contributors
