import { useEffect, useRef } from "react"
import { useMap } from "react-map-gl/maplibre"
import { osmixIdToRasterTileUrl } from "../../lib/osmix-raster-protocol"
import { RASTER_MAX_ZOOM, RASTER_OPACITY } from "../../constants"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"

interface RasterLayerProps {
	osmId: string
}

/** Layer IDs for cleanup */
function allRasterLayerIds(osmId: string) {
	return [`osmviz:${osmId}:raster`]
}

/**
 * Raster preview layer for low-zoom overview.
 * Shows a rasterized image of OSM data for zoom levels where vector tiles
 * would be too heavy to generate (large area coverage).
 * 
 * This layer only shows at zoom 0-8. At zoom 9+, it automatically hides
 * and vector tiles take over for interactive features.
 */
export function RasterLayer({ osmId }: RasterLayerProps) {
	const roadsVisible = useUIStore((s) => s.layers.roads)
	const dataset = useOsmStore((s) => s.dataset)
	const { current: mapInstance } = useMap()

	const sourceId = `osmviz:${osmId}:raster-source`
	const bounds = dataset?.info.bbox as [number, number, number, number] | undefined

	const createdRef = useRef(false)

	// ── STRUCTURAL EFFECT: create raster source + layer ──
	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!map) return

		const create = () => {
			// Clean up any existing
			for (const id of allRasterLayerIds(osmId)) {
				try { if (map.getLayer(id)) map.removeLayer(id) } catch { /* */ }
			}
			try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch { /* */ }

			// Add raster source - only generate tiles for zoom 0-8
			map.addSource(sourceId, {
				type: "raster",
				tiles: [osmixIdToRasterTileUrl(osmId)],
				bounds,
				minzoom: 0,
				maxzoom: RASTER_MAX_ZOOM,  // Only load tiles up to zoom 8
				tileSize: 256,
			})

			// Add raster layer at the bottom of all OSM layers
			// This ensures vector layers will render on top when they appear
			map.addLayer({
				id: `osmviz:${osmId}:raster`,
				type: "raster",
				source: sourceId,
				minzoom: 0,
				maxzoom: RASTER_MAX_ZOOM, // Only visible up to zoom 8
				paint: {
					"raster-opacity": roadsVisible ? RASTER_OPACITY : 0,
					"raster-fade-duration": 200,
				},
			})

			createdRef.current = true
		}

		// Create now if style is loaded, or wait for it
		if (map.isStyleLoaded()) {
			create()
		} else {
			map.once("style.load", create)
		}

		// Re-create after basemap switch
		const onStyleLoad = () => {
			createdRef.current = false
			create()
		}
		map.on("style.load", onStyleLoad)

		return () => {
			map.off("style.load", onStyleLoad)
			// Remove on unmount
			for (const id of allRasterLayerIds(osmId)) {
				try { if (map.getLayer(id)) map.removeLayer(id) } catch { /* */ }
			}
			try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch { /* */ }
			createdRef.current = false
		}
	}, [mapInstance, osmId, sourceId, bounds])

	// ── REACTIVE EFFECT: update visibility ──
	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!map || !createdRef.current) return

		try {
			if (map.getLayer(`osmviz:${osmId}:raster`)) {
				map.setPaintProperty(
					`osmviz:${osmId}:raster`,
					"raster-opacity",
					roadsVisible ? RASTER_OPACITY : 0
				)
			}
		} catch { /* layer may not exist yet */ }
	}, [mapInstance, osmId, roadsVisible])

	// Component renders nothing — all rendering is via native MapLibre API
	return null
}
