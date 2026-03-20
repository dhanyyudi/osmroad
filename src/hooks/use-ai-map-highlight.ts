import { useCallback } from 'react'
import { useOsmStore } from '@/stores/osm-store'
import { getOsmRemote } from './use-osm'
import type { QueryResults } from '@/stores/ai-query-store'

/**
 * Hook untuk highlight hasil AI Query di map dan zoom ke bounds
 */
export function useAIMapHighlight() {
	const { dataset, setHighlightedWayIds } = useOsmStore()

	const highlightAndZoom = useCallback(async (
		results: QueryResults,
		queryType: 'count' | 'aggregate' | 'select' | 'group'
	) => {
		// Skip untuk count/aggregate queries (tidak ada geometry)
		if (queryType === 'count' || queryType === 'aggregate' || queryType === 'group') {
			return
		}

		if (!results.allData || results.allData.length === 0) {
			setHighlightedWayIds(new Set())
			return
		}

		if (!dataset) return

		const remote = getOsmRemote()
		if (!remote) return

		try {
			const worker = remote.getWorker()

			// Extract road IDs dari hasil
			const roadIds = results.allData
				.map((row: any) => row.id)
				.filter((id: number) => id != null)

			if (roadIds.length === 0) {
				setHighlightedWayIds(new Set())
				return
			}

			// Set highlighted way IDs untuk ditampilkan di map
			setHighlightedWayIds(new Set(roadIds))

			// Get geometries untuk calculate bounds
			const geometries = await worker.getWayGeometries(dataset.osmId, roadIds)

			if (geometries.length === 0) return

			// Calculate bounds dari semua coordinates
			let minLon = Infinity, minLat = Infinity
			let maxLon = -Infinity, maxLat = -Infinity

			geometries.forEach((g: any) => {
				g.coords.forEach(([lon, lat]: [number, number]) => {
					minLon = Math.min(minLon, lon)
					minLat = Math.min(minLat, lat)
					maxLon = Math.max(maxLon, lon)
					maxLat = Math.max(maxLat, lat)
				})
			})

			// Validate bounds
			if (minLon === Infinity || minLat === Infinity) return

			// Dispatch custom event untuk map zoom
			const event = new CustomEvent('ai-query-zoom', {
				detail: {
					bounds: [minLon, minLat, maxLon, maxLat],
					roadIds: roadIds
				}
			})
			window.dispatchEvent(event)

		} catch (err) {
			console.error('[useAIMapHighlight] Failed:', err)
		}
	}, [dataset, setHighlightedWayIds])

	const clearHighlight = useCallback(() => {
		setHighlightedWayIds(new Set())
	}, [setHighlightedWayIds])

	return { highlightAndZoom, clearHighlight }
}
