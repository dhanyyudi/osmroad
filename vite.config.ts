import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			workbox: {
				// Precache the app shell ONLY.
				//
				// This list used to include `pbf` with a 100 MB size ceiling, so
				// the service worker silently downloaded every sample extract
				// (105 MB) into Cache Storage on first visit. Samples now go
				// through runtimeCaching on demand, with a sensible size cap.
				globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
				globIgnores: [
					"**/samples/**",
					"**/*.wasm",
					// DuckDB's worker scripts are ~1.6 MB together and are only
					// fetched when a SQL panel initialises the engine.
					"**/duckdb-*",
				],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				cleanupOutdatedCaches: true,
				runtimeCaching: [
					{
						// Basemap raster tiles.
						urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "osm-tiles",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					{
						urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "carto-tiles",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 7 * 24 * 60 * 60,
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					{
						// Sample extracts, cached only once the user asks for one.
						urlPattern: /\/samples\/.*\.(pbf|geoparquet)$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "osmroad-samples",
							expiration: {
								maxEntries: 8,
								maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
							},
							cacheableResponse: { statuses: [200] },
						},
					},
				],
			},
			includeAssets: ["favicon.svg", "apple-touch-icon.svg"],
			manifest: {
				name: "OSMRoad - OSM Road Network Visualizer",
				short_name: "OSMRoad",
				description: "Browser-based OSM PBF visualizer with routing and AI-powered queries",
				theme_color: "#1a1a2e",
				background_color: "#0a0a0f",
				display: "standalone",
				icons: [
					{
						src: "/favicon.svg",
						sizes: "192x192",
						type: "image/svg+xml",
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	optimizeDeps: {
		exclude: ["@duckdb/duckdb-wasm"],
		esbuildOptions: {
			// Preserve native private class fields (#field) instead of
			// downcompiling them to _field variables, which breaks MapLibre 5.x
			target: "esnext",
		},
	},
	esbuild: {
		target: "esnext",
	},
	build: {
		target: "esnext",
		// maplibre-gl dominates the app's own code; splitting the vendor
		// libraries out means an app-code change only invalidates the small
		// chunk, and the heavy ones parse in parallel rather than in sequence.
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return undefined
					// Leave Vite's asset/worker query modules alone. A `?url`
					// import resolves to the real file path, so force-assigning
					// it to a vendor chunk drags that whole chunk into the static
					// entry graph — which is how DuckDB ended up modulepreloaded
					// on every page load despite being dynamically imported.
					if (id.includes("?")) return undefined
					if (id.includes("maplibre-gl")) return "vendor-maplibre"
					if (id.includes("@duckdb/duckdb-wasm")) return "vendor-duckdb"
					if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
						return "vendor-react"
					}
					if (id.includes("hyparquet")) return "vendor-parquet"
					if (id.includes("jszip") || id.includes("shapefile") || id.includes("togeojson")) {
						return "vendor-converters"
					}
					return undefined
				},
			},
		},
	},
	server: {
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Resource-Policy": "cross-origin",
		},
	},
	worker: {
		format: "es",
	},
})
