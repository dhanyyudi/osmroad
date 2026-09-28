import { useCallback, useState } from "react"
import { useOsm } from "./use-osm"
import { useOsmStore } from "../stores/osm-store"
import { useRoutingStore } from "../stores/routing-store"
import { useSearchStore } from "../stores/search-store"
import { useSpeedStore } from "../stores/speed-store"
import { clearOsmixVectorMinZoom } from "../lib/osmix-vector-protocol"
import { dropRoadsTable } from "./use-duckdb"

export interface UnloadDatasetResult {
	unload: () => Promise<void>
	isUnloading: boolean
	error: string | null
}

/**
 * Release the loaded OSM dataset so a different file can be opened.
 *
 * The worker keeps one Osm index per dataset id, and the map, the vector-tile
 * protocol and several zustand stores all hold state derived from it. Unloading
 * has to undo every one of those, or the next file inherits stale data:
 *
 *   - the worker's Osm index plus its tile and roads caches
 *   - the vector-tile protocol's per-dataset min-zoom entry
 *   - the DuckDB `roads` table used by AI query
 *   - selection, highlights, routing, search and speed overlays
 *
 * MapLibre layers are not touched here: MapViewer renders RoadLayer only while a
 * dataset exists, and RoadLayer already removes its own layers and source on
 * unmount.
 */
export function useUnloadDataset(): UnloadDatasetResult {
	const { remote } = useOsm()
	const [isUnloading, setIsUnloading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const unload = useCallback(async () => {
		const dataset = useOsmStore.getState().dataset
		if (!dataset) return

		setIsUnloading(true)
		setError(null)
		try {
			// Free the worker's copy. A failure here still has to leave the UI
			// usable, so the store reset happens regardless (below).
			if (remote) {
				try {
					await remote.deleteDataset(dataset.osmId)
				} catch (err) {
					console.error("[unload] Worker could not release the dataset:", err)
				}
			}

			clearOsmixVectorMinZoom(dataset.osmId)
			await dropRoadsTable()

			// Reset stores last, so the UI never shows an empty panel while the
			// worker still holds the old data.
			useOsmStore.getState().resetDataset()
			useRoutingStore.getState().reset()
			useSearchStore.getState().clearHighlights()
			useSpeedStore.getState().reset()
		} catch (err) {
			console.error("[unload] Failed:", err)
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setIsUnloading(false)
		}
	}, [remote])

	return { unload, isUnloading, error }
}
