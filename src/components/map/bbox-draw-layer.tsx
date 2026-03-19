import { useEffect, useRef, useCallback } from "react"
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

	// Initialize GeoJSON source and layer
	useEffect(() => {
		if (!map) return

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

		return () => {
			// Cleanup handled by map unmount
		}
	}, [map])

	// Handle mouse events for drawing
	const handleMouseDown = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !map) return

			e.preventDefault()
			isDrawingRef.current = true
			startPointRef.current = { lng: e.lngLat.lng, lat: e.lngLat.lat }

			// Change cursor
			map.getCanvas().style.cursor = "crosshair"
		},
		[isDrawingMode, map],
	)

	const handleMouseMove = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !isDrawingRef.current || !map || !startPointRef.current) return

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
		[isDrawingMode, map],
	)

	const handleMouseUp = useCallback(
		(e: MapMouseEvent) => {
			if (!isDrawingMode || !isDrawingRef.current || !map || !startPointRef.current) return

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
		[isDrawingMode, map, setDrawnBbox, setDrawingMode],
	)

	// Register event listeners when drawing mode is active
	useEffect(() => {
		if (!map) return

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
	}, [isDrawingMode, map, handleMouseDown, handleMouseMove, handleMouseUp])

	// Clear drawing when exiting drawing mode without completing
	useEffect(() => {
		if (!isDrawingMode && !useUIStore.getState().drawnBbox && map) {
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
			if (source) {
				source.setData({
					type: "Feature",
					geometry: { type: "Polygon", coordinates: [[]] },
					properties: {},
				})
			}
		}
	}, [isDrawingMode, map])

	return null // This is a logic-only component
}
