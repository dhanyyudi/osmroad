# RoadLens 🗺️

**Browser-based OSM Road Network Visualizer**

Load `.osm.pbf` files directly in your browser to visualize, inspect, and analyze OpenStreetMap road networks. No server required — everything runs client-side using Web Workers and WebAssembly.

![RoadLens Screenshot](https://via.placeholder.com/800x400/1f2937/ffffff?text=RoadLens+Screenshot)

## 🌟 Features

### Core
- **📁 PBF File Loading** — Drag & drop `.osm.pbf` files, parsed entirely client-side via Web Workers
- **🛣️ Road Visualization** — Color-coded highway classification (motorway, trunk, primary, secondary, etc.) with oneway arrows
- **🔍 Interactive Inspection** — Click any road to view detailed OSM tags and properties
- **🚦 Node Markers** — Traffic signals, stop signs, barriers, crossings with intuitive icons

### Analysis
- **🧭 Routing** — Click-to-route with turn-by-turn directions, distance, and estimated time
- **🔎 Search** — Geocoding via Nominatim and entity search within loaded data
- **🚫 Access Restrictions** — Visualize motor_vehicle=no, access=no, and barriers
- **⚡ Speed Data** — CSV speed overlay support for traffic analysis

### Data
- **✏️ Tag Editing** — Edit OSM tags directly in the browser
- **📤 Export** — Download edited data back to PBF format
- **🗺️ Multiple Basemaps** — Dark Matter, Positron, Voyager, OSM Standard, and more

## 🚀 Quick Start

### Online (Recommended)
Visit **[roadlens.vercel.app](https://roadlens.vercel.app)** (deploy URL) and start visualizing immediately!

### Local Development
```bash
npm install
npm run dev
```

Open `http://localhost:5173` and drop an `.osm.pbf` file onto the map.

## 📖 How to Use

### 1. Get OSM Data
You need an `.osm.pbf` file to get started. You can:

- **Download from Geofabrik** — [download.geofabrik.de](https://download.geofabrik.de/) (country/region extracts)
- **Download from BBBike** — [extract.bbbike.org](https://extract.bbbike.org/) (custom areas)
- **Use Overpass API** — Export Query → Download OSM data
- **Use Sample Data** — Click "Load Sample" to try with Denpasar or Monaco

### 2. Load Data
- **Drag & Drop** — Simply drag your `.osm.pbf` file onto the map
- **Click to Browse** — Use the file picker in the sidebar
- **Load Sample** — Try our pre-loaded samples (Denpasar, Monaco)

### 3. Explore
- **Pan/Zoom** — Navigate the map to explore your data
- **Click Roads** — View detailed OSM tags in the inspect panel
- **Search** — Find specific locations or tags
- **Toggle Layers** — Show/hide roads, restrictions, speed data

### 4. Analyze
- **Routing** — Click "Set Start" and "Set End" to find routes
- **Filter** — Show only specific road types or access restrictions
- **Edit Tags** — Modify OSM tags directly (changes stay local)

### 5. Export
- **Download PBF** — Export your edited data back to `.osm.pbf` format

## 📦 Sample Data

Don't have an OSM file? Try our samples:

| Area | Size | Description |
|------|------|-------------|
| **Denpasar, Bali** 🇮🇩 | ~3 MB | Urban mix with toll roads, residential, and main highways |
| **Monaco** 🇲🇨 | ~1 MB | Dense urban network, perfect for quick testing |

Click "Load Sample" in the app or download directly:
- [Denpasar Sample](https://example.com/denpasar.osm.pbf) (TODO: update URL)
- [Monaco Sample](https://example.com/monaco.osm.pbf) (TODO: update URL)

## 🛠️ Tech Stack

- **[osmix](https://github.com/conveyal/osmix)** — OSM PBF parsing, spatial indexing, and routing (MIT)
- **[MapLibre GL JS](https://maplibre.org/)** — Map rendering with vector tiles
- **[React](https://react.dev/)** — UI framework
- **[Vite](https://vite.dev/)** — Build tool
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[DuckDB-wasm](https://duckdb.org/)** — In-browser SQL queries
- **[Comlink](https://github.com/GoogleChromeLabs/comlink)** — Web Worker communication

## 🚧 Roadmap

- [x] OSM PBF file loading & visualization
- [x] Road network rendering with classification
- [x] Interactive routing with directions
- [x] Tag inspection and editing
- [x] Export to PBF
- [ ] **Overpass API Integration** — Download OSM data directly via bbox query
- [ ] **More Sample Cities** — Jakarta, Surabaya, Yogyakarta
- [ ] **Changeset Visualization** — Compare two OSM files
- [ ] **Performance Metrics** — Road density, connectivity analysis

## 🔮 Overpass API Integration (Coming Soon)

We're working on a feature to download OSM data directly:

```
1. Draw AOI (Area of Interest) on map
2. Auto-generate Overpass QL query
3. Fetch roads within bbox
4. Visualize instantly
5. Edit & export to PBF
```

**Example Query:**
```overpass
[out:json][bbox:-8.7,115.2,-8.6,115.3];
way[highway](bbox);
out geom;
```

## 📄 License

MIT © RoadLens Contributors

---

**Made with ❤️ for the OpenStreetMap community**
