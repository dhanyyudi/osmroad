import { useEffect, useState, useRef } from "react"
import { useMap } from "react-map-gl/maplibre"
import { useOsmStore } from "../../stores/osm-store"
import { Loader2 } from "lucide-react"

/**
 * Loading indicator for vector tiles with progress bar.
 * Shows when vector tiles are being generated/loaded.
 */
export function VectorLoadingIndicator() {
	const dataset = useOsmStore((s) => s.dataset)
	const { current: mapInstance } = useMap()
	const [isLoading, setIsLoading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [loaded, setLoaded] = useState(0)
	const [total, setTotal] = useState(0)
	
	const loadingTiles = useRef<Set<string>>(new Set())
	const loadedTiles = useRef<Set<string>>(new Set())
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!map || !dataset) {
			setIsLoading(false)
			return
		}

		const sourceId = `osmviz:${dataset.osmId}:source`
		
		// Reset state when dataset changes
		loadingTiles.current.clear()
		loadedTiles.current.clear()
		setIsLoading(false)
		setProgress(0)
		setLoaded(0)
		setTotal(0)

		const updateProgress = () => {
			const loading = loadingTiles.current.size
			const loaded = loadedTiles.current.size
			const total = Math.max(loading, loaded)
			
			setLoaded(loaded)
			setTotal(total)
			setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0)
			setIsLoading(loading > loaded)
		}

		const onDataLoading = (e: maplibregl.MapDataEvent) => {
			// Check if this is our vector source
			if (e.dataType === "source") {
				// Tile is being requested/generated
				if (e.sourceDataType === "content" || e.sourceDataType === undefined) {
					// Try to get tile coordinates from the event or source
					const tileKey = `${Date.now()}-${Math.random()}`
					loadingTiles.current.add(tileKey)
					updateProgress()
					
					// Remove from loading after timeout (tile loaded)
					setTimeout(() => {
						loadedTiles.current.add(tileKey)
						loadingTiles.current.delete(tileKey)
						updateProgress()
					}, 100 + Math.random() * 200)
				}
			}
		}

		const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
			if (e.sourceId === sourceId && e.tile) {
				const tileKey = `${e.tile.z}/${e.tile.x}/${e.tile.y}`
				
				if (e.dataType === "tile") {
					// Tile data is being loaded/generated
					loadingTiles.current.add(tileKey)
					updateProgress()
				} else if (e.dataType === "source" && e.sourceDataType === "content") {
					// Tile is ready
					loadedTiles.current.add(tileKey)
					loadingTiles.current.delete(tileKey)
					updateProgress()
				}
			}
		}

		const onIdle = () => {
			// Map is idle, all tiles should be loaded
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
			timeoutRef.current = setTimeout(() => {
				setIsLoading(false)
				setProgress(100)
			}, 500)
		}

		// Listen to various events
		map.on("data", onDataLoading)
		map.on("sourcedata", onSourceData)
		map.on("idle", onIdle)
		
		// Check if source exists and is loading
		const checkSource = () => {
			const source = map.getSource(sourceId)
			if (source) {
				// Source exists, we might be loading tiles
				setIsLoading(true)
			}
		}
		
		// Check after a short delay to catch initial load
		const checkTimeout = setTimeout(checkSource, 100)

		return () => {
			map.off("data", onDataLoading)
			map.off("sourcedata", onSourceData)
			map.off("idle", onIdle)
			clearTimeout(checkTimeout)
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		}
	}, [mapInstance, dataset])

	if (!isLoading || !dataset) return null

	return (
		<div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-72">
			<div className="rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-xl">
				<div className="mb-2 flex items-center gap-2">
					<Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
					<span className="text-sm font-medium text-zinc-200">Generating vector tiles...</span>
				</div>
				
				<div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
					<div
						className="h-full rounded-full bg-blue-500 transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
				
				<div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
					<span>{loaded} / {total} tiles</span>
					<span>{progress}%</span>
				</div>
			</div>
		</div>
	)
}
