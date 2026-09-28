# How OSMRoad Works

> Technical explanation of the browser-based OSM visualizer architecture

---

## The Big Picture

OSMRoad opens OSM PBF files (potentially gigabytes of road data) **directly in your browser** — no server, no backend. Everything runs client-side using Web Workers, WebAssembly, and GPU rendering.

---

## 1. Loading Massive Data Files

### The Problem

OSM PBF files range from 50MB (city) to 5GB+ (country). Browsers struggle with large in-memory datasets.

### Solution: Streaming + Spatial Indexing

#### Web Workers (background threads)

All heavy lifting runs in a dedicated Web Worker (`osm.worker.ts`) via **Comlink** RPC. The main thread stays responsive while the worker:
- Parses the PBF file
- Builds spatial indices
- Generates vector tiles
- Processes queries

#### Streaming Parser

Uses **osmix** to parse PBF in chunks rather than loading the entire file first:

```
Traditional:  Download → Load all → Parse → Display
OSMRoad:      Download → Parse chunk → Display → Parse more…
```

#### Spatial Index (R-tree)

osmix builds an R-tree index for fast spatial lookups. Finding roads in a viewport takes milliseconds instead of scanning millions of records.

#### Vector Tiles (show only what's visible)

The custom `@osmix/vector` protocol generates vector tiles on-demand from the worker. MapLibre only requests tiles for the current viewport and zoom level — rendering stays fast regardless of total file size.

#### Smart Render Strategy

`file-size-detector.ts` picks a render mode based on node count:

| File Size | Strategy |
|-----------|---------|
| < 500K nodes | Full vector at all zoom levels |
| 500K – 2M nodes | Hybrid: raster 0–8, vector 8+ |
| 2M – 10M nodes | Raster 0–10, vector 10+ |
| > 10M nodes (country) | Raster 0–11, vector 12+ |

Max zoom is capped for large files to prevent tile overload.

#### Memory Management

- **Memory monitor** displays live usage and warns at >80%
- Files >50K roads skip DuckDB sync (prevents memory spike)
- LRU tile cache in worker (512 entries max)
- Worker streaming queries process roads in 10K batches

---

## 2. AI-Powered Natural Language Queries

### Architecture

```
User query
    │
    ▼
POST /api/ai/query (Cloudflare Worker → SumoPod → Workers AI)
    │ fails (offline, 503, rate-limit)
    ▼
Local NL2SQL parser (offline, rule-based)
    │
    ▼
File size check
    ├── < 50K roads → DuckDB-wasm SQL
    └── > 50K roads → Worker streaming (10K/batch)
    │
    ▼
Results + highlight on map
```

### AI Provider Path

`/api/ai/query` is a route in the edge Worker (`worker/index.ts`), paired with the
prompt in `worker/nl2sql.ts`. It:

1. Receives the user's natural language question
2. Checks `Origin` against `ALLOWED_ORIGINS` and applies a best-effort
   per-isolate rate limit
3. Builds a prompt with the `roads` schema context and a few-shot example block
4. Tries each configured provider in order, stopping at the first non-empty answer:
   - **SumoPod** (`AI_API_KEY` set) — one `fetch` to
     `$AI_BASE_URL/chat/completions`, the OpenAI-compatible shape. No SDK: it
     would be bundle weight in the Worker for a single request.
   - **Workers AI** (`env.AI.run`) — the binding, always available.
5. Cleans the response (strips markdown fences, keeps the first statement) and
   returns `{ sql, success: true, source, model }`, where `source` names the
   provider that actually answered

If neither provider produces usable SQL the Worker substitutes a deterministic
answer for a few very common questions (`source: "heuristic"`), and failing that
returns 503 so the browser's offline parser takes over.

The SumoPod key is the only credential. It is a Worker secret, set with
`npx wrangler secret put AI_API_KEY`, and it appears nowhere in this repository —
`wrangler.jsonc` declares only the variable names. `worker-configuration.d.ts` is
generated with `--env-file .dev.vars.example` so tsc sees `AI_API_KEY: string`
without a `secrets.required` gate (which would hard-block deploys while the key
is still optional).

### Local Parser Fallback

`local-nl2sql.ts` handles common query patterns offline when the API is unavailable:

| Query | Generated SQL |
|-------|--------------|
| "Berapa jalan tol?" | `SELECT COUNT(*) FROM roads WHERE highway = 'motorway'` |
| "Show primary roads" | `SELECT * FROM roads WHERE highway = 'primary'` |
| "Total road length" | `SELECT SUM(length_meters) FROM roads` |
| "Average residential length" | `SELECT AVG(length_meters) FROM roads WHERE highway = 'residential'` |

Supports COUNT, SELECT, AGGREGATE, GROUP — English and Indonesian.

### Road Type Mapping (Bilingual)

| User Term | OSM Value |
|-----------|---------|
| "jalan tol" / "motorway" | `motorway` |
| "jalan utama" / "primary road" | `primary` |
| "jalan perumahan" / "residential" | `residential` |
| "jalan setapak" / "footpath" | `footway` |

### Map Highlighting

Results from SELECT queries use MapLibre **feature state** (not layer recreation):

```javascript
map.setFeatureState({ source, sourceLayer, id: zigzag(wayId) }, { highlighted: true })
```

Style expression checks the state:
```javascript
"line-color": ["case", ["boolean", ["feature-state", "highlighted"], false], "#fbbf24", roadColorExpr]
```

Benefits: 60fps, instant toggle, no re-render.

---

## 3. Routing

Uses **osmix built-in routing** (Dijkstra's algorithm):

1. User clicks start/end points on the map
2. `findNearestRoutableNode()` snaps click to nearest routable node (within 200m radius)
3. `route(osmId, fromNodeIndex, toNodeIndex)` runs Dijkstra on the road graph
4. Result: coordinate array + segments (name, highway type, distance, time)
5. Map flies to route bounds

The graph is built from OSM way topology during file loading. Only nodes connected by `highway` ways are included. One-way streets are respected.

---

## 4. Mobile UI

### Layout

```
Desktop:                     Mobile:
┌─────────┬──────────────┐   ┌────────────────┐
│ Sidebar │              │   │   Map (full)   │
│ (icon   │   MapViewer  │   │                │
│ rail +  │              │   │  [≡] [search ]  │
│ panel)  │              │   │         [Dark▼] │
└─────────┴──────────────┘   │        [+][-]  │
                              │        [⊙][≡] │
                              └────────────────┘
                              BottomSheet (slide up)
```

### Responsive Detection

`use-media-query.ts` provides hooks:
- `useIsMobile()` — viewport < 768px
- `useIsTablet()` — 768–1024px
- `useIsDesktop()` — > 1024px

### Bottom Sheet

`bottom-sheet.tsx` — iOS-style draggable sheet with:
- Snap points: 40%, 70%, 92% of screen height
- Touch drag handling (delta Y calculation)
- Nearest snap point detection on release
- Backdrop tap to dismiss
- Initial snap at 40% (map still visible)

### Auto-Open on Feature Click

`mobilePanelOpen` state lives in `ui-store`. When user taps a road or node:
1. `map-viewer.tsx` calls `setActiveTab("inspect")` + `setMobilePanelOpen(true)`
2. Bottom sheet opens automatically at 40% height
3. User can drag up to see more detail

No need to open the hamburger menu first.

### Geocoding Search Bar (Mobile)

On mobile, search bar is positioned `top-3 left-16 right-3` to avoid overlapping the hamburger button (which is at `top-4 left-4`, 40px wide).

### Basemap Switcher (Mobile)

On mobile: compact button (icon + label, `w-auto`) at `top-16 right-3`.
On desktop: full `w-96` panel.
Dropdown anchors right-aligned to avoid overflow.

### Mobile Controls

Floating panel at bottom-right (inside `<Map>` context, required for `useMap()`):
- **Zoom +/-** — stacked buttons
- **Locate** — geolocation via `navigator.geolocation`
- **Layers** — bottom sheet modal with toggle for roads/nodes/restrictions/access

---

## 5. Tag Editing

1. User clicks road/node → entity selected in `osm-store`
2. Edit panel shows current tags as editable key-value pairs
3. Changes stored as diffs in memory (original data untouched)
4. On export: osmix merges original + diffs → writes new PBF

---

## 6. Overpass API

1. User enters draw mode (BBoxDrawLayer)
2. Draws rectangle on map → `drawnBbox` stored in `ui-store`
3. The **bounding box** is POSTed to our own Worker at `/api/overpass`
4. The Worker builds the query, tries mirrors in order, and returns OSM XML
5. Response parsed by `osm-xml-parser.ts` → GeoJSON → loaded on map

### Why it goes through the Worker

The browser used to call `overpass-api.de` directly, which failed for two
independent reasons:

- **CORS.** The page is cross-origin isolated (`COEP: require-corp`), so a
  response needs the right CORS headers. Measured from a real client,
  `overpass-api.de` answers `406 Not Acceptable` — even for `/api/status` with no
  query — and a 406 carries no `Access-Control-Allow-Origin`. The browser can
  only report that as an opaque network failure.
- **No fallback.** One endpoint, one chance.

Routing through the Worker also means the request leaves from Cloudflare's
network rather than the user's, which can succeed where the client's own network
is refused. Verified: a client that gets `406` from Overpass directly receives
3.4 MB of road data through the proxy.

The Worker:

- accepts **only a bounding box**, never a query, so it cannot be used as a
  general-purpose Overpass gateway
- enforces a **50 km²** area cap server-side (the UI shows the same limit)
- tries `overpass-api.de`, then `overpass.kumi.systems`, then
  `overpass.private.coffee`, 45s each
- detects Overpass errors that arrive as **HTTP 200 with a `<remark>`** and
  reports what Overpass actually said, instead of surfacing them as
  "No roads found in selected area"
- caches successful responses at the edge for 30 minutes, keyed by query hash
- reports every mirror's failure, so an outage reads as
  `overpass-api.de: HTTP 406; kumi.systems: timed out after 45s` rather than
  "it did not work"

`[out:xml]` is deliberate: the browser already has a working OSM XML parser, and
switching format would be a larger change than this fix needs.

---

## 7. DuckDB-wasm Queries

For small files (<50K roads), OSM data is synced to DuckDB:

```sql
CREATE TABLE roads (
  id BIGINT,
  name VARCHAR,
  highway VARCHAR,
  length_meters DOUBLE,
  tags JSON
);
```

Large files skip the sync entirely and use the worker's streaming query path, so
DuckDB is only ever started for datasets where a SQL engine actually pays off.

DuckDB-wasm is **loaded on demand**. `use-duckdb.ts` statically imports only the
asset URL strings; the library itself and its 32.7 MiB wasm module are resolved
inside `initDuckDB()`, which runs when an AI Query or Speed panel mounts. A
visitor who only opens a PBF file never downloads any of it.

Only the `eh` bundle is shipped. The `mvp` fallback would add ~39 MB to every
deploy for browsers that fail the exception-handling check in
`browser-support.ts` anyway, and `selectBundle()` is skipped in favour of naming
the bundle directly.

The wasm module cannot be a static asset — 32.7 MiB against Cloudflare's 25 MiB
per-asset limit — so the Worker serves it from R2 at `/duckdb/duckdb-eh.wasm`.
It is stored **uncompressed**: pre-compressing it and declaring
`Content-Encoding` either through `_headers` or manually produced a double-encoded
body that `WebAssembly.instantiateStreaming` cannot read. Cloudflare's own content
negotiation compresses it in transit instead.

---

## 8. PWA & Caching

`vite-plugin-pwa` + Workbox:
- App shell precached (~2.3 MB: JS, CSS, HTML, icons)
- OSM and Carto raster tiles cached 7 days, on demand
- Sample extracts cached 30 days, on demand
- Service worker skipped in dev mode (enabled after build only)

The precache list deliberately excludes `*.pbf`, `*.wasm` and the DuckDB worker
scripts. An earlier `globPatterns` of `**/*.{js,css,html,ico,png,svg,pbf}` with a
100 MB size ceiling meant every first-time visitor silently downloaded all
105 MB of sample extracts into Cache Storage in the background.

---

## 9. Edge Deployment

One Cloudflare Worker serves everything:

```
Request
   │
   ├─ /api/ai/query        → Worker: SumoPod / Workers AI NL2SQL
   ├─ /api/overpass        → Worker: Overpass proxy (mirror fallback + edge cache)
   ├─ /api/health          → Worker: binding check
   ├─ /samples/*           → Worker: R2, streamed, supports Range
   ├─ /duckdb/*            → Worker: R2, DuckDB wasm
   └─ everything else      → static-asset layer (./dist)
                             not_found_handling = "single-page-application"
```

`assets.run_worker_first` is limited to those three prefixes, so a page load
never pays for a Worker invocation.

Binary assets live in R2 rather than in the bundle:

| Why | Detail |
|-----|--------|
| Asset size limit | 25 MiB per static asset; Taipei is 75 MB, DuckDB wasm 32.7 MiB |
| Deploy weight | `./dist` is ~3 MB instead of ~184 MB |
| Change cadence | Samples and wasm change rarely; the app deploys often |

COOP/COEP are set in `public/_headers`, which applies to static-asset responses.
Anything the Worker answers sets its own headers in code — `_headers` rules do
not apply to Worker-generated responses.

---

## Key Technical Constraints

| Constraint | Reason |
|-----------|--------|
| `target: "esnext"` in Vite | MapLibre 5.x uses native private class fields (`#field`) — must not be transpiled |
| COOP/COEP headers | Required for transferable `ReadableStream` (streaming PBF load). DuckDB's `eh` bundle is single-threaded and does not itself need `SharedArrayBuffer` |
| MapLibre 5.x uses native API | `react-map-gl <Source>/<Layer>` incompatible with MapLibre 5 for GeoJSON — use `map.addSource()/addLayer()` directly |
| `MobileControls` inside `<Map>` | `useMap()` hook requires a MapLibre `<Map>` ancestor in the React tree |
| osmix patches | `postinstall` script patches osmix's vector tile relation handling |
| No `osmix` import on the main thread | `osmix`'s entry point re-exports every `@osmix/*` package; `use-osm.ts` declares the worker surface structurally and imports only types |
| GeoParquet `bbox` column is mandatory | `@osmix/geoparquet` always requests it and hyparquet throws on a missing requested column, even though GeoParquet 1.1 does not require it |

---

## File Structure

```
src/
├── components/
│   ├── app.tsx                    # Root — desktop/mobile layout switch
│   ├── map/
│   │   ├── map-viewer.tsx         # MapLibre map, layer composition, click handlers
│   │   ├── road-layer.tsx         # Road rendering (color/width by type, oneway, icons)
│   │   ├── basemap-switcher.tsx   # Basemap selection (mobile compact / desktop full)
│   │   ├── geocoding-overlay.tsx  # Search bar (Nominatim + lat,lon input)
│   │   ├── mobile-controls.tsx    # Zoom, locate, layers toggle (mobile only)
│   │   ├── cursor-coordinates.tsx # Real-time lat/lon display
│   │   ├── memory-monitor.tsx     # Memory usage warning
│   │   ├── vector-tiles-progress.tsx
│   │   ├── access-layer.tsx       # access=no visualization
│   │   ├── restriction-layer.tsx  # turn restriction visualization
│   │   ├── speed-layer.tsx        # CSV speed overlay
│   │   ├── route-layer.tsx        # Routing result path
│   │   ├── search-highlight-layer.tsx
│   │   └── bbox-draw-layer.tsx    # Overpass area drawing
│   ├── sidebar/
│   │   ├── sidebar.tsx            # Desktop icon-rail + mobile bottom sheet
│   │   ├── file-panel.tsx         # Upload, samples, Overpass
│   │   ├── ai-query-panel.tsx     # AI chat UI
│   │   ├── inspect-panel.tsx      # Tags, coordinate, Street View
│   │   ├── edit-panel.tsx         # Tag editing
│   │   ├── routing-panel.tsx      # Route from/to
│   │   ├── search-panel.tsx       # ID/tag search
│   │   ├── layers-panel.tsx
│   │   ├── speed-panel.tsx
│   │   └── export-panel.tsx
│   ├── ui/
│   │   └── bottom-sheet.tsx       # Draggable mobile panel (snap 40/70/92%)
│   └── ai-query/                  # Chat message, input, SQL preview components
├── hooks/
│   ├── use-media-query.ts         # Responsive breakpoints
│   ├── use-osm.ts                 # Worker init, streaming load, progress + ETA
│   ├── use-unload-dataset.ts      # Release a dataset and everything derived from it
│   ├── use-ai-query.ts            # AI query orchestration
│   ├── use-osm-duckdb-sync.ts     # OSM → DuckDB sync
│   ├── use-ai-map-highlight.ts    # Highlight + zoom
│   ├── use-render-strategy.ts     # File size → render mode
│   └── use-tile-loading.ts        # Tile progress
├── stores/
│   ├── osm-store.ts               # Dataset, selected entity, highlightedWayIds
│   ├── ui-store.ts                # Tabs, layers, basemap, mobilePanelOpen, drawing mode
│   ├── ai-query-store.ts          # Chat messages, SQL, history (localStorage)
│   ├── routing-store.ts           # Route from/to/result
│   ├── search-store.ts            # Search highlights
│   └── speed-store.ts             # Speed profile data
├── services/ai/
│   ├── edge-ai.ts                 # POST /api/ai/query + local fallback
│   ├── local-nl2sql.ts            # Offline NL2SQL parser
│   ├── prompt-builder.ts          # Few-shot prompt engineering
│   └── guardrails.ts              # Input validation
├── workers/
│   ├── osm.worker.ts              # OsmixWorker + LRU tile cache + query methods
│   ├── duckdb.worker.ts           # DuckDB-wasm init
│   └── query-processor.ts         # Streaming batch processor (10K/batch)
└── lib/
    ├── osmix-vector-protocol.ts   # @osmix/vector tile protocol
    ├── osmix-raster-protocol.ts   # Raster fallback protocol
    ├── geoparquet-encode.ts       # OSM features → GeoParquet (shared with Node)
    ├── format-converter.ts        # GPX/KML/KMZ/shapefile → GeoJSON (lazy parsers)
    ├── road-style.ts              # MapLibre style expressions
    ├── file-size-detector.ts      # Render strategy selection
    ├── map-utils.ts               # Coordinate format, Street View URL
    ├── storage.ts                 # IndexedDB dataset caching
    └── osm-xml-parser.ts          # OSM XML → GeoJSON (Overpass response)

worker/
├── index.ts                       # Edge Worker: /api/*, /samples/*, /duckdb/*
└── nl2sql.ts                      # Prompt, SQL cleanup, heuristic fallback

scripts/
├── pbf-to-geoparquet.mjs          # CLI: .osm.pbf → .geoparquet
├── prepare-duckdb-wasm.mjs        # Stage the wasm for the dev server
└── upload-assets.mjs              # Push samples + wasm to R2

patches/
└── fix-vt-relation-exclusion.js   # postinstall patch for osmix
```

---

## Query Architecture Decision Tree

```
User Query
    ↓
┌──────────────────────────┐
│ SumoPod → Workers AI     │── fails ──┐
│ POST /api/ai/query       │           ▼
└──────────────────────────┘  ┌──────────────────┐
         ↓ SQL                │ Local NL2SQL     │
         ↓                    │ (offline parser) │
┌─────────────────────┐       └──────────────────┘
│ File size?          │           ↓ SQL
└──────────┬──────────┘           ↓
  < 50K    │    > 50K         (same path)
    ↓      │      ↓
┌───────┐  │  ┌──────────────────┐
│DuckDB │  │  │ Worker streaming │
│ SQL   │  │  │ (10K batches)    │
└───────┘  │  └──────────────────┘
    ↓      │      ↓
 Results ──┴── Results
               ↓
    Highlight amber on map + auto-zoom
```
