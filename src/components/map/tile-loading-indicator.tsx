import { useEffect, useState } from "react"
import { useMap } from "react-map-gl/maplibre"
import { useOsmStore } from "../../stores/osm-store"
import { Loader2 } from "lucide-react"

/**
 * Simple loading indicator that shows when the map is processing data.
 * This catches vector tile generation and other loading states.
 */
export function TileLoadingIndicator() {
	const dataset = useOsmStore((s) => s.dataset)
	const { current: mapInstance } = useMap()
	const [isLoading, setIsLoading] = useState(false)
	const [message, setMessage] = useState("")

	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!map || !dataset) return

		let loadingCount = 0
		let timeout: ReturnType<typeof setTimeout> | null = null

		const onDataLoading = () => {
			loadingCount++
			setIsLoading(true)
			setMessage("Loading data...")
			
			if (timeout) clearTimeout(timeout)
		}

		const onDataLoad = () => {
			loadingCount = Math.max(0, loadingCount - 1)
			
			if (timeout) clearTimeout(timeout)
			timeout = setTimeout(() => {
				if (loadingCount === 0) {
					setIsLoading(false)
				}
			}, 300)
		}

		const onZoomStart = () => {
			setIsLoading(true)
			setMessage("Loading tiles...")
		}

		const onZoomEnd = () => {
			if (timeout) clearTimeout(timeout)
			timeout = setTimeout(() => {
				setIsLoading(false)
			}, 500)
		}

		// Listen to data events
		map.on("dataloading", onDataLoading)
		map.on("data", onDataLoad)
		map.on("zoomstart", onZoomStart)
		map.on("zoomend", onZoomEnd)

		return () => {
			map.off("dataloading", onDataLoading)
			map.off("data", onDataLoad)
			map.off("zoomstart", onZoomStart)
			map.off("zoomend", onZoomEnd)
			if (timeout) clearTimeout(timeout)
		}
	}, [mapInstance, dataset])

	if (!isLoading || !dataset) return null

	return (
		<div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30">
			<div className="rounded-lg border border-blue-500/30 bg-blue-900/90 backdrop-blur px-4 py-2 shadow-xl flex items-center gap-2">
				<Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
				<span className="text-sm font-medium text-blue-100">{message}</span>
			</div>
		</div>
	)
}
