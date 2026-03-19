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
You need an `.osm.pbf` file to get started. You have 3 options:

#### Option A: Try Sample Data (Easiest)
Click "Load Sample" in the app to try with **Denpasar, Bali** data (~3 MB).

#### Option B: Download from OSM Directly
Use the **"Download from OSM"** feature in the app:
1. Go to [bboxfinder.com](http://bboxfinder.com/)
2. Draw a rectangle around your area of interest
3. Copy the bbox coordinates (format: `minLon,minLat,maxLon,maxLat`)
4. Paste in RoadLens and click "Download Roads"
5. Convert the downloaded `.osm` file to `.pbf` (see below)

#### Option C: Download Pre-made Extracts
- **Geofabrik** — [download.geofabrik.de](https://download.geofabrik.de/) (country/region extracts)
- **BBBike** — [extract.bbbike.org](https://extract.bbbike.org/) (custom areas)

### 2. Convert OSM XML to PBF (if needed)
If you downloaded data from Overpass API (Option B), you need to convert it:

**Using Osmium (recommended):**
```bash
# Install osmium-tool (macOS)
brew install osmium-tool

# Convert OSM XML to PBF
osmium cat downloaded_file.osm -o output.osm.pbf
```

**Using Osmosis:**
```bash
osmosis --read-xml file="downloaded_file.osm" --write-pbf file="output.osm.pbf"
```

### 3. Load Data
- **Drag & Drop** — Simply drag your `.osm.pbf` file onto the map
- **Click to Browse** — Use the file picker in the sidebar
- **Load Sample** — Try our pre-loaded Denpasar sample

### 4. Explore
- **Pan/Zoom** — Navigate the map to explore your data
- **Click Roads** — View detailed OSM tags in the inspect panel
- **Search** — Find specific locations or tags
- **Toggle Layers** — Show/hide roads, restrictions, speed data

### 5. Analyze
- **Routing** — Click "Set Start" and "Set End" to find routes
- **Filter** — Show only specific road types or access restrictions
- **Edit Tags** — Modify OSM tags directly (changes stay local)

### 6. Export
- **Download PBF** — Export your edited data back to `.osm.pbf` format

## 📦 Sample Data

Don't have an OSM file? Try our sample:

| Area | Size | Description |
|------|------|-------------|
| **Denpasar, Bali** 🇮🇩 | ~3 MB | Urban mix with toll roads, residential, and main highways |

Click **"Load Sample"** in the app or download manually from:
- [Download Denpasar Sample](https://github.com/yourusername/roadlens/raw/main/public/samples/denpasar_sample.osm.pbf) (TODO: update URL)

## 🛠️ Creating Custom Sample Data

Want to create your own sample like Denpasar? Here's how:

### Step 1: Define Bounding Box
1. Go to [bboxfinder.com](http://bboxfinder.com/)
2. Navigate to your desired area
3. Draw a rectangle
4. Copy the bbox string (e.g., `115.205,-8.675,115.230,-8.650`)

### Step 2: Download via Overpass
```bash
# Create query file
 cat > query.overpass << 'EOF'
[bbox:{{bbox}}];
(
  way["highway"];
  node(w);
);
out meta;
EOF

# Download using curl
curl -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "data=$(cat query.overpass | sed "s/{{bbox}}/-8.675,115.205,-8.650,115.230/")" \
  https://overpass-api.de/api/interpreter \
  -o my_area.osm
```

### Step 3: Convert to PBF
```bash
osmium cat my_area.osm -o my_area.osm.pbf
```

### Step 4: Test
Load `my_area.osm.pbf` into RoadLens!

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
- [x] **Sample Data** — Denpasar included
- [x] **Overpass Download** — Download OSM data via bbox query
- [ ] **Direct PBF from Overpass** — Auto-convert OSM XML to PBF
- [ ] **Draw Bbox on Map** — Interactive area selection
- [ ] **More Sample Cities** — Jakarta, Surabaya, Yogyakarta
- [ ] **Changeset Visualization** — Compare two OSM files

## 📄 License

MIT © RoadLens Contributors

---

**Made with ❤️ for the OpenStreetMap community**
