import { useEffect, useMemo, useRef, useCallback } from "react"
import { useMap } from "react-map-gl/maplibre"
import maplibregl from "maplibre-gl"
import { useRoutingStore } from "../../stores/routing-store"

const SOURCE_ID = "osmviz-route"

const LINE_LAYER_IDS = [
	"osmviz-route-line-casing",
	"osmviz-route-line",
	"osmviz-route-snap-lines",
	"osmviz-route-turn-points",
] as const

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

// ── HTML Marker helpers ──

function createMarkerEl(label: string, color: string): HTMLDivElement {
	const el = document.createElement("div")
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
	const markerA = useRef<maplibregl.Marker | null>(null)
	const markerB = useRef<maplibregl.Marker | null>(null)

	// GeoJSON for line/circle layers (no click-point features — markers handle those)
	const geojson = useMemo((): GeoJSON.FeatureCollection => {
		const features: GeoJSON.Feature[] = []

		if (fromPoint && fromNode) {
			features.push({
				type: "Feature",
				properties: { layer: "snap-line" },
				geometry: { type: "LineString", coordinates: [fromPoint, fromNode.coordinates] },
			})
		}
		if (toPoint && toNode) {
			features.push({
				type: "Feature",
				properties: { layer: "snap-line" },
				geometry: { type: "LineString", coordinates: [toPoint, toNode.coordinates] },
			})
		}

		if (result?.coordinates && result.coordinates.length >= 2) {
			features.push({
				type: "Feature",
				properties: { layer: "route" },
				geometry: { type: "LineString", coordinates: result.coordinates },
			})
		}

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

			map.addLayer({
				id: "osmviz-route-line-casing",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				paint: {
					"line-color": "#003366",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 7, 14, 12, 18, 22],
					"line-opacity": 0.6,
				},
				layout: { "line-cap": "round", "line-join": "round" },
			})

			map.addLayer({
				id: "osmviz-route-line",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "route"],
				paint: {
					"line-color": "#4488FF",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 9, 18, 18],
					"line-opacity": 1,
				},
				layout: { "line-cap": "round", "line-join": "round" },
			})

			map.addLayer({
				id: "osmviz-route-snap-lines",
				type: "line",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "snap-line"],
				paint: {
					"line-color": "#FF4444",
					"line-width": 2,
					"line-dasharray": [2, 2],
					"line-opacity": 0.8,
				},
			})

			map.addLayer({
				id: "osmviz-route-turn-points",
				type: "circle",
				source: SOURCE_ID,
				filter: ["==", ["get", "layer"], "turn-point"],
				paint: {
					"circle-color": "white",
					"circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 4, 18, 6],
					"circle-stroke-color": "#4488FF",
					"circle-stroke-width": 1.5,
				},
			})
		} catch (e) {
			console.error("[RouteLayer] addLayers error:", e)
		}
	}, [])

	// Setup and teardown GeoJSON source/layers
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
				for (const id of [...LINE_LAYER_IDS].reverse()) {
					if (map.getLayer(id)) map.removeLayer(id)
				}
				if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
			} catch { /* ignore */ }
		}
	}, [mapRef, addLayers])

	// Update GeoJSON data and keep layers on top
	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map || !map.isStyleLoaded()) return

		if (!map.getSource(SOURCE_ID)) addLayers(map)

		const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
		if (src) {
			src.setData(geojson)
			for (const id of LINE_LAYER_IDS) {
				if (map.getLayer(id)) map.moveLayer(id)
			}
		}
	}, [mapRef, geojson, addLayers])

	// Manage A/B markers with HTML elements
	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map) return

		// Marker A (start — green)
		if (fromPoint) {
			if (!markerA.current) {
				markerA.current = new maplibregl.Marker({
					element: createMarkerEl("A", "#22CC44"),
					anchor: "center",
				})
			}
			markerA.current.setLngLat(fromPoint).addTo(map)
		} else {
			markerA.current?.remove()
			markerA.current = null
		}

		// Marker B (end — red)
		if (toPoint) {
			if (!markerB.current) {
				markerB.current = new maplibregl.Marker({
					element: createMarkerEl("B", "#EE3344"),
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
