import { useState, useEffect, useCallback, useRef } from "react"
import { useMap } from "react-map-gl/maplibre"

interface TileLoadingState {
	isLoading: boolean
	loaded: number
	total: number
	progress: number
}

export function useTileLoading() {
	const { current: mapRef } = useMap()
	const [state, setState] = useState<TileLoadingState>({
		isLoading: false,
		loaded: 0,
		total: 0,
		progress: 0,
	})
	
	const tileStats = useRef({ loaded: 0, loading: 0 })
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)

	const reset = useCallback(() => {
		tileStats.current = { loaded: 0, loading: 0 }
		setState({ isLoading: false, loaded: 0, total: 0, progress: 0 })
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
	}, [])

	useEffect(() => {
		const map = mapRef?.getMap()
		if (!map) return

		const handleDataLoading = (e: maplibregl.MapDataEvent) => {
			if (e.dataType === "source" && e.sourceDataType === "content") {
				tileStats.current.loading++
				const total = tileStats.current.loading
				const loaded = tileStats.current.loaded
				setState({
					isLoading: true,
					loaded,
					total,
					progress: total > 0 ? (loaded / total) * 100 : 0,
				})
			}
		}

		const handleDataLoad = (e: maplibregl.MapDataEvent) => {
			if (e.dataType === "source" && e.sourceDataType === "content") {
				tileStats.current.loaded++
				const total = tileStats.current.loading
				const loaded = tileStats.current.loaded
				
				setState({
					isLoading: loaded < total,
					loaded,
					total,
					progress: total > 0 ? (loaded / total) * 100 : 0,
				})

				// Auto-reset after all tiles loaded
				if (timeoutRef.current) clearTimeout(timeoutRef.current)
				timeoutRef.current = setTimeout(() => {
					if (tileStats.current.loaded >= tileStats.current.loading) {
						setState(prev => ({ ...prev, isLoading: false }))
					}
				}, 500)
			}
		}

		const handleIdle = () => {
			setState(prev => ({ ...prev, isLoading: false }))
		}

		map.on("data", handleDataLoading)
		map.on("data", handleDataLoad)
		map.on("idle", handleIdle)

		return () => {
			map.off("data", handleDataLoading)
			map.off("data", handleDataLoad)
			map.off("idle", handleIdle)
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		}
	}, [mapRef])

	return { ...state, reset }
}
