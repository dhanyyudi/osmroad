import { useEffect, useState } from "react"
import { useOsmStore } from "../../stores/osm-store"
import { Loader2 } from "lucide-react"

/**
 * Progress indicator for vector tiles generation.
 * Shows after a dataset is loaded and stays visible while tiles are being generated.
 */
export function VectorTilesProgress() {
	const dataset = useOsmStore((s) => s.dataset)
	const vectorTilesLoading = useOsmStore((s) => s.vectorTilesLoading)
	const setVectorTilesLoading = useOsmStore((s) => s.setVectorTilesLoading)
	const [progress, setProgress] = useState(0)
	const [message, setMessage] = useState("Initializing...")

	useEffect(() => {
		if (!dataset || !vectorTilesLoading) return

		// Simulate progress for vector tile generation
		const stages = [
			{ percent: 10, message: "Building spatial index...", delay: 500 },
			{ percent: 25, message: "Generating vector tiles...", delay: 1000 },
			{ percent: 50, message: "Encoding tile data...", delay: 1500 },
			{ percent: 75, message: "Optimizing tiles...", delay: 2000 },
			{ percent: 90, message: "Almost ready...", delay: 2500 },
			{ percent: 100, message: "Complete!", delay: 3000 },
		]

		const timeouts: ReturnType<typeof setTimeout>[] = []

		stages.forEach((stage) => {
			const timeout = setTimeout(() => {
				setProgress(stage.percent)
				setMessage(stage.message)
				
				if (stage.percent === 100) {
					// Hide after completion
					setTimeout(() => {
						setVectorTilesLoading(false)
					}, 500)
				}
			}, stage.delay)
			timeouts.push(timeout)
		})

		return () => {
			timeouts.forEach(clearTimeout)
		}
	}, [dataset, vectorTilesLoading, setVectorTilesLoading])

	if (!vectorTilesLoading || !dataset) return null

	return (
		<div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-80">
			<div className="rounded-lg border border-blue-500/30 bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-xl">
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
						<span className="text-sm font-medium text-zinc-200">{message}</span>
					</div>
					<span className="text-xs text-zinc-500">{progress}%</span>
				</div>
				
				<div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
					<div
						className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
				
				<div className="mt-1.5 text-[10px] text-zinc-500">
					Generating tiles for {dataset.fileName}
				</div>
			</div>
		</div>
	)
}
