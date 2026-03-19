import { useEffect, useRef, useCallback, useState } from "react"
import { useMap } from "react-map-gl/maplibre"
import { useUIStore } from "../../stores/ui-store"
import type { MapMouseEvent } from "maplibre-gl"

/**
 * BBoxDrawLayer - Interactive rectangle drawing for selecting area of interest
 * When drawing mode is active, user can click and drag to draw a rectangle
 */
export function BBoxDrawLayer() {
	const map = useMap().current?.getMap()
	const isDrawingMode = useUIStore((s) => s.isDrawingMode)
	const setDrawnBbox = useUIStore((s) => s.setDrawnBbox)
	const setDrawingMode = useUIStore((s) => s.setDrawingMode)

	const isDrawingRef = useRef(false)
	const startPointRef = useRef<{ lng: number; lat: number } | null>(null)
	const sourceId = "bbox-draw-source"
	const layerId = "bbox-draw-layer"
	
	// Track if source/layer is initialized
	const [isInitialized, setIsInitialized] = useState(false)

	// Initialize GeoJSON source and layer - wait for style to load
	useEffect(() => {
		if (!map) return

		const addSourceAndLayer = () => {
			// Add source if not exists
			if (!map.getSource(sourceId)) {
				map.addSource(sourceId, {
					type: "geojson",
					data: {
						type: "Feature",
						geometry: { type: "Polygon", coordinates: [[]] },
						properties: {},
					},
				})
			}

			// Add layer if not exists
			if (!map.getLayer(layerId)) {
				map.addLayer({
					id: layerId,
					type: "fill",
					source: sourceId,
					paint: {
						"fill-color": "#3b82f6",
						"fill-opacity": 0.2,
						"fill-outline-color": "#3b82f6",
					},
				})

				// Add outline layer
				map.addLayer({
					id: `${layerId}-outline`,
					type: "line",
					source: sourceId,
					paint: {
						"line-color": "#3b82f6",
						"line-width": 2,
						"line-dasharray": [2, 2],
					},
				})
			}
			
			setIsInitialized(true)
		}

		// Wait for style to load before adding sources/layers
		if (map.isStyleLoaded()) {
			addSourceAndLayer()
		} else {
			map.once("style.load", addSourceAndLayer)
		}

		return () => {
			// Cleanup - remove listeners only
			map.off("style.load", addSourceAndLayer)
		}
	}, [map])

	// Handle mouse events for drawing
	const handleMouseDown = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !map || !isInitialized) return

			e.preventDefault()
			isDrawingRef.current = true
			startPointRef.current = { lng: e.lngLat.lng, lat: e.lngLat.lat }

			// Change cursor
			map.getCanvas().style.cursor = "crosshair"
		},
		[isDrawingMode, map, isInitialized],
	)

	const handleMouseMove = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !isDrawingRef.current || !map || !startPointRef.current || !isInitialized) return

			const start = startPointRef.current
			const current = { lng: e.lngLat.lng, lat: e.lngLat.lat }

			// Create rectangle polygon
			const coordinates = [
				[start.lng, start.lat],
				[current.lng, start.lat],
				[current.lng, current.lat],
				[start.lng, current.lat],
				[start.lng, start.lat],
			]

			// Update source
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
			if (source) {
				source.setData({
					type: "Feature",
					geometry: { type: "Polygon", coordinates: [coordinates] },
					properties: {},
				})
			}
		},
		[isDrawingMode, map, isInitialized],
	)

	const handleMouseUp = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !isDrawingRef.current || !map || !startPointRef.current || !isInitialized) return

			isDrawingRef.current = false
			const start = startPointRef.current
			const end = { lng: e.lngLat.lng, lat: e.lngLat.lat }

			// Calculate bbox
			const minLon = Math.min(start.lng, end.lng)
			const maxLon = Math.max(start.lng, end.lng)
			const minLat = Math.min(start.lat, end.lat)
			const maxLat = Math.max(start.lat, end.lat)

			// Validate bbox size (prevent accidental tiny selections)
			const areaDegrees = (maxLon - minLon) * (maxLat - minLat)
			if (areaDegrees < 0.000001) {
				// Too small, clear the drawing
				const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
				if (source) {
					source.setData({
						type: "Feature",
						geometry: { type: "Polygon", coordinates: [[]] },
						properties: {},
					})
				}
				setDrawnBbox(null)
			} else {
				// Save bbox
				setDrawnBbox({ minLon, minLat, maxLon, maxLat })
				setDrawingMode(false) // Exit drawing mode
			}

			// Reset cursor
			map.getCanvas().style.cursor = ""
			startPointRef.current = null
		},
		[isDrawingMode, map, setDrawnBbox, setDrawingMode, isInitialized],
	)

	// Register event listeners when drawing mode is active
	useEffect(() => {
		if (!map || !isInitialized) return

		if (isDrawingMode) {
			map.on("mousedown", handleMouseDown)
			map.on("mousemove", handleMouseMove)
			map.on("mouseup", handleMouseUp)
			map.getCanvas().style.cursor = "crosshair"
		} else {
			map.off("mousedown", handleMouseDown)
			map.off("mousemove", handleMouseMove)
			map.off("mouseup", handleMouseUp)
			map.getCanvas().style.cursor = ""
		}

		return () => {
			map.off("mousedown", handleMouseDown)
			map.off("mousemove", handleMouseMove)
			map.off("mouseup", handleMouseUp)
		}
	}, [isDrawingMode, map, handleMouseDown, handleMouseMove, handleMouseUp, isInitialized])

	// Clear drawing when exiting drawing mode without completing
	useEffect(() => {
		if (!isDrawingMode && !useUIStore.getState().drawnBbox && map && isInitialized) {
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
			if (source) {
				source.setData({
					type: "Feature",
					geometry: { type: "Polygon", coordinates: [[]] },
					properties: {},
				})
			}
		}
	}, [isDrawingMode, map, isInitialized])

	return null // This is a logic-only component
}
