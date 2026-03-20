# OSMRoad 🗺️

**Browser-based OSM Road Network Visualizer — Visualize, inspect, and analyze OpenStreetMap road networks**

Load `.osm.pbf` files directly in your browser to visualize, inspect, and analyze OpenStreetMap road networks. No server required — everything runs client-side using Web Workers and WebAssembly.

## 🎬 Demo

<video src="https://github.com/user-attachments/assets/4003286d-0a92-4d5c-8e08-1163a5bd989b" loop muted playsinline width="100%"></video>

**Quick demo:** Upload video directly to GitHub issue/comment and copy the generated URL above.

Or visit **[osmroad.vercel.app](https://osmroad.vercel.app)** to try it now!

<details>
<summary>📋 Demo Features</summary>

- Loading Denpasar, Bali sample data (~5MB)
- Interactive road visualization with color-coded highways
- AI-powered natural language queries
- Drawing area on map and downloading from Overpass API
- Routing between two points with turn-by-turn directions

</details>

## 🌟 Features

### Core

- **📁 PBF File Loading** — Drag & drop `.osm.pbf` files, parsed entirely client-side via Web Workers
- **🛣️ Road Visualization** — Color-coded highway classification (motorway, trunk, primary, secondary, etc.) with oneway arrows
- **🔍 Interactive Inspection** — Click any road to view detailed OSM tags, coordinates, and Street View link
- **🚦 Node Markers** — Traffic signals, stop signs, barriers, crossings with intuitive icons
- **📍 Cursor Coordinates** — Real-time lat/lon display as you move your cursor over the map

### Analysis

- **🧭 Routing** — Click-to-route with turn-by-turn directions, distance, and estimated time
- **🔎 Search** — Geocoding via Nominatim and entity search within loaded data
- **🚫 Access Restrictions** — Visualize motor_vehicle=no, access=no, and barriers
- **⚡ Speed Data** — CSV speed overlay support for traffic analysis
- **🤖 AI Query Assistant** — Ask questions in natural language (English/Indonesian) to query road data

### AI-Powered Queries (NEW!)

Ask questions about your OSM data in natural language:
- "How many motorways?" / "Berapa jalan tol?"
- "Show primary roads longer than 5km"
- "Find roads without names"
- "Average length of residential roads"

The AI converts your question to SQL, executes it on DuckDB, and **highlights results on the map with auto-zoom**.

### Data

- **✏️ Tag Editing** — Edit OSM tags directly in the browser
- **📤 Export** — Download edited data back to PBF format
- **🗺️ Multiple Basemaps** — Dark Matter, Positron, Voyager, OSM Standard, and more
- **🌎 Street View Integration** — Click "Open Street View" in inspect panel to view location in Google Maps

## 🚀 Quick Start

### Online (Recommended)

Visit **[osmroad.vercel.app](https://osmroad.vercel.app)** and start visualizing immediately!

### Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and drop an `.osm.pbf` file onto the map.

## 📖 How to Use

### Loading OSM Data

OSMRoad provides **3 ways** to load OSM data:

1. **Upload Your Own PBF File** — Drag & drop your `.osm.pbf` file onto the map
2. **Load Sample Data** — Click "Load Sample" for Denpasar, Bali data (~5 MB)
3. **Download from OSM** — Draw area on map, fetch from Overpass API

### Using AI Query Assistant

1. Load OSM data (sample or your own)
2. Wait for "Syncing data to AI..." to complete
3. Click the **✨ Sparkles** icon in the left sidebar (AI Query tab)
4. Type your question in English or Indonesian:
   - "How many primary roads?"
   - "Berapa jalan tol?"
   - "Show residential roads"
5. Results are highlighted on the map in **amber/yellow** with auto-zoom

### Inspecting Roads

1. Click any road on the map
2. View in the Inspect panel:
   - Road type, name, and OSM tags
   - **Coordinate** (lat/lon) with copy button
   - **"Open Street View"** button to view in Google Maps

## 🛠️ Tech Stack

- **[osmix](https://github.com/conveyal/osmix)** — OSM PBF parsing, spatial indexing, and routing (MIT)
- **[MapLibre GL JS](https://maplibre.org/)** — Map rendering with vector tiles
- **[React](https://react.dev/)** — UI framework
- **[Vite](https://vite.dev/)** — Build tool
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[DuckDB-wasm](https://duckdb.org/)** — In-browser SQL queries
- **[Comlink](https://github.com/GoogleChromeLabs/comlink)** — Web Worker communication
- **[Google Vertex AI](https://cloud.google.com/vertex-ai)** — Gemini model for NL2SQL

## 📝 License

MIT © OSMRoad Contributors
