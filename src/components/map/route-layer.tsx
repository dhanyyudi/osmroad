import { useEffect, useMemo, useRef, useCallback } from "react"
import { useMap } from "react-map-gl/maplibre"
import maplibregl from "maplibre-gl"
import { useRoutingStore } from "../../stores/routing-store"

const SOURCE_ID = "osmviz-route"

const LINE_LAYER_IDS = [
	"osmviz-route-line-casing",
	"osmviz-route-line",
	"osmviz-route-line-glow",
	"osmviz-route-snap-lines",
	"osmviz-route-snap-points",
	"osmviz-route-turn-points",
] as const

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

// ── HTML Marker helpers ──

function createMarkerEl(label: string, color: string, isSnappedPoint = false): HTMLDivElement {
	const el = document.createElement("div")
	
	if (isSnappedPoint) {
		// Smaller marker for snapped node
		el.style.cssText = `
			width: 12px; height: 12px; border-radius: 50%;
			background: ${color};
			border: 2px solid white;
			box-shadow: 0 0 4px rgba(0,0,0,0.5);
			cursor: default; pointer-events: none;
		`
	} else {
		// Main marker for click point
		el.style.cssText = `
			width: 32px; height: 32px; border-radius: 50%;
			background: radial-gradient(circle at 35% 35%, ${lighten(color)}, ${color} 60%, ${darken(color)});
			border: 2.5px solid rgba(255,255,255,0.9);
			box-shadow: 0 0 8px 2px ${color}88, 0 2px 8px rgba(0,0,0,0.4);
			display: flex; align-items: center; justify-content: center;
			font: bold 14px/1 system-ui, sans-serif; color: #fff;
			text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			cursor: default; pointer-events: auto;
		`
		el.textContent = label
	}
	return el
}

function lighten(hex: string): string {
	const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 80)
	const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 80)
	const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 80)
	return `rgb(${r},${g},${b})`
}

function darken(hex: string): string {
	const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40)
	const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40)
	const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40)
	return `rgb(${r},${g},${b})`
}

// ── Component ──

export function RouteLayer() {
	const { current: mapRef } = useMap()
	const { fromPoint, toPoint, fromNode, toNode, result } = useRoutingStore()
	
	// Refs for click point markers (A/B)
	const markerA = useRef<maplibregl.Marker | null>(null)
	const markerB = useRef<maplibregl.Marker | null>(null)
	// Refs for snapped node markers (smaller dots)
	const snappedMarkerA = useRef<maplibregl.Marker | null>(null)
	const snappedMarkerB = useRef<maplibregl.Marker | null>(null)

	// GeoJSON for lines and points
	const geojson = useMemo((): GeoJSON.FeatureCollection => {
		const features: GeoJSON.Feature[] = []

		// Snap lines showing connection from click to snapped node
		if (fromPoint && fromNode) {
			features.push({
				type: "Feature",
				properties: { layer: "snap-line", type: "from" },
				geometry: { type: "LineString", coordinates: [fromPoint, fromNode.coordinates] },
			})
			// Snapped node point
			features.push({
				type: "Feature",
				properties: { layer: "snap-point", type: "from" },
				geometry: { type: "Point", coordinates: fromNode.coordinates },
			})
		}
		if (toPoint && toNode) {
			features.push({
				type: "Feature",
				properties: { layer: "snap-line", type: "to" },
				geometry: { type: "LineString", coordinates: [toPoint, toNode.coordinates] },
			})
			// Snapped node point
			features.push({
				type: "Feature",
				properties: { layer: "snap-point", type: "to" },
				geometry: { type: "Point", coordinates: toNode.coordinates },
			})
		}

		// Route line
		if (result?.coordinates && result.coordinates.length >= 2) {
			features.push({
				type: "Feature",
				properties: { layer: "route" },
				geometry: { type: "LineString", coordinates: result.coordinates },
			})
		}

		// Turn points
		if (result?.turnPoints) {
			for (const tp of result.turnPoints) {
				features.push({
					type: "Feature",
					properties: { layer: "turn-point" },
					geometry: { type: "Point", coordinates: tp },
				})
			}
		}

		return { type: "FeatureCollection", features }
	}, [fromPoint, toPoint, fromNode, toNode, result])

	const addLayers = useCallback((map: maplibregl.Map) => {
		try {
			if (map.getSource(SOURCE_ID)) return
			map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC })

			// Casing layer (dark outline)
			map.addLayer({
				id: "osmviz-route-line-casing",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				paint: {
					"line-color": "#0f172a",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 14, 18, 24],
					"line-opacity": 0.9,
				},
				layout: { "line-cap": "round", "line-join": "round" },
			})

			// Main route line - bright cyan
			map.addLayer({
				id: "osmviz-route-line",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				paint: {
					"line-color": "#06b6d4",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 10, 18, 20],
					"line-opacity": 1,
				},
				layout: { "line-cap": "round", "line-join": "round" },
			})

			// Glow layer
			map.addLayer({
				id: "osmviz-route-line-glow",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				paint: {
					"line-color": "#22d3ee",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6, 18, 12],
					"line-opacity": 0.6,
					"line-blur": 4,
				},
				layout: { "line-cap": "round", "line-join": "round" },
			})

			// Direction arrows
			map.addLayer({
				id: "osmviz-route-arrows",
				type: "symbol",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				layout: {
					"symbol-placement": "line",
					"symbol-spacing": 60,
					"icon-image": "arrow",
					"icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 14, 0.6, 18, 0.8],
					"icon-allow-overlap": true,
				},
				paint: {
					"icon-color": "#ffffff",
					"icon-opacity": 0.9,
				},
			})

			// Snap lines - showing click to snapped node
			map.addLayer({
				id: "osmviz-route-snap-lines",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "snap-line"],
				paint: {
					"line-color": [
						"match",
						["get", "type"],
						"from", "#22c55e", // green for start
						"to", "#ef4444",   // red for end
						"#f87171"
					],
					"line-width": 2,
					"line-dasharray": [4, 4],
					"line-opacity": 0.7,
				},
			})

			// Snapped node points
			map.addLayer({
				id: "osmviz-route-snap-points",
				type: "circle",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "snap-point"],
				paint: {
					"circle-color": [
						"match",
						["get", "type"],
						"from", "#22c55e",
						"to", "#ef4444",
						"#ffffff"
					],
					"circle-radius": 6,
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 2,
				},
			})

			// Turn points
			map.addLayer({
				id: "osmviz-route-turn-points",
				type: "circle",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "turn-point"],
				paint: {
					"circle-color": "#ffffff",
					"circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 5, 18, 8],
					"circle-stroke-color": "#06b6d4",
					"circle-stroke-width": 2,
				},
			})

			// Add arrow icon
			const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`
			const img = new Image()
			img.onload = () => {
				if (!map.hasImage("arrow")) {
					map.addImage("arrow", img)
				}
			}
			img.src = "data:image/svg+xml;base64," + btoa(arrowSvg)
		} catch (e) {
			console.error("[RouteLayer] addLayers error:", e)
		}
	}, [])

	// Setup and teardown
	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map) return

		const setup = () => {
			if (map.isStyleLoaded()) addLayers(map)
		}

		setup()
		map.on("style.load", setup)

		return () => {
			map.off("style.load", setup)
			try {
				for (const id of [...LINE_LAYER_IDS, "osmviz-route-arrows"].reverse()) {
					if (map.getLayer(id)) map.removeLayer(id)
				}
				if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
				if (map.hasImage("arrow")) map.removeImage("arrow")
			} catch { /* ignore */ }
		}
	}, [mapRef, addLayers])

	// Update GeoJSON data
	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map || !map.isStyleLoaded()) return

		if (!map.getSource(SOURCE_ID)) addLayers(map)

		const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
		if (src) {
			src.setData(geojson)
			for (const id of [...LINE_LAYER_IDS, "osmviz-route-arrows"]) {
				if (map.getLayer(id)) map.moveLayer(id)
			}
		}
	}, [mapRef, geojson, addLayers])

	// Manage markers
	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map) return

		// Marker A (click point)
		if (fromPoint) {
			if (!markerA.current) {
				markerA.current = new maplibregl.Marker({
					element: createMarkerEl("A", "#22c55e"),
					anchor: "center",
				})
			}
			markerA.current.setLngLat(fromPoint).addTo(map)
		} else {
			markerA.current?.remove()
			markerA.current = null
		}

		// Marker B (click point)
		if (toPoint) {
			if (!markerB.current) {
				markerB.current = new maplibregl.Marker({
					element: createMarkerEl("B", "#ef4444"),
					anchor: "center",
				})
			}
			markerB.current.setLngLat(toPoint).addTo(map)
		} else {
			markerB.current?.remove()
			markerB.current = null
		}

		return () => {
			markerA.current?.remove()
			markerA.current = null
			markerB.current?.remove()
			markerB.current = null
		}
	}, [mapRef, fromPoint, toPoint])

	return null
}
