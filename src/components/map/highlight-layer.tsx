import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { useOsmStore } from '@/stores/osm-store'

/**
 * Layer untuk menampilkan hasil highlight dari AI Query
 */
export function HighlightLayer() {
	const { current: map } = useMap()
	const { highlightedWayIds, dataset } = useOsmStore()
	const sourceRef = useRef<string | null>(null)

	useEffect(() => {
		if (!map || !dataset) return

		const sourceId = 'ai-highlight-source'
		const layerId = 'ai-highlight-layer'

		// Cleanup function
		const cleanup = () => {
			if (map.getLayer(layerId)) {
				map.removeLayer(layerId)
			}
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId)
			}
		}

		// If no highlighted ways, cleanup and return
		if (highlightedWayIds.size === 0) {
			cleanup()
			return
		}

		// Create GeoJSON feature collection
		const features: GeoJSON.Feature[] = []

		// Get OSM data untuk extract geometries
		// Note: Ini simplified version - sebenarnya perlu access ke OSM worker
		// Untuk sekarang, kita akan render sebagai empty source dan
		// biarkan map component yang lain handle actual rendering

		// Remove existing source/layer if any
		cleanup()

		// Add source
		map.addSource(sourceId, {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: features
			}
		})

		// Add highlight layer
		map.addLayer({
			id: layerId,
			type: 'line',
			source: sourceId,
			paint: {
				'line-color': '#fbbf24', // amber-400
				'line-width': 4,
				'line-opacity': 0.9
			}
		})

		sourceRef.current = sourceId

		return cleanup
	}, [map, highlightedWayIds, dataset])

	// Listen untuk zoom event dari AI query
	useEffect(() => {
		if (!map) return

		const handleZoom = (e: Event) => {
			const customEvent = e as CustomEvent
			const bounds = customEvent.detail?.bounds
			if (bounds && Array.isArray(bounds) && bounds.length === 4) {
				map.fitBounds(
					[ [bounds[0], bounds[1]], [bounds[2], bounds[3]] ],
					{ padding: 50, maxZoom: 16, duration: 1000 }
				)
			}
		}

		window.addEventListener('ai-query-zoom', handleZoom)
		return () => window.removeEventListener('ai-query-zoom', handleZoom)
	}, [map])

	return null
}
