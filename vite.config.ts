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
				maximumFileSizeToCacheInBytes: 100 * 1024 * 1024, // 100 MB
				globPatterns: ["**/*.{js,css,html,ico,png,svg,pbf}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "osm-tiles",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
							},
						},
					},
					{
						urlPattern: /\/samples\/.*\.pbf$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "osmroad-samples",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
							},
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
