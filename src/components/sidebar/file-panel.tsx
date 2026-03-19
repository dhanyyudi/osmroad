import { useCallback, useState } from "react"
import { FileDropZone } from "../shared/file-drop-zone"
import { ProgressBar } from "../shared/progress-bar"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"
import { useOsm } from "../../hooks/use-osm"
import { osmXmlToGeoJSON, formatBbox, calculateBboxAreaKm2 } from "../../lib/osm-xml-parser"
import { FileText, MapPin, Route, GitBranch, MapPinned, Download, SquareDashedMousePointer, Loader2, X, Check } from "lucide-react"

// Sample data - Denpasar only (roads/highway only, filtered)
const SAMPLE_FILE = {
	name: "Denpasar, Bali",
	url: "/samples/denpasar.osm.pbf",
	description: "Denpasar roads only (~5 MB)",
	format: "pbf" as const,
}

// Overpass API endpoint
const OVERPASS_API = "https://overpass-api.de/api/interpreter"

// Maximum allowed area (km²) to prevent huge downloads
const MAX_AREA_KM2 = 100

export function FilePanel() {
	const { remote } = useOsm()
	const { dataset, isLoading, progress, error } = useOsmStore()
	const setActiveTab = useUIStore((s) => s.setActiveTab)
	const isDrawingMode = useUIStore((s) => s.isDrawingMode)
	const setDrawingMode = useUIStore((s) => s.setDrawingMode)
	const drawnBbox = useUIStore((s) => s.drawnBbox)
	const clearDrawnBbox = useUIStore((s) => s.clearDrawnBbox)
	
	const [overpassLoading, setOverpassLoading] = useState(false)
	const [downloadSuccess, setDownloadSuccess] = useState(false)

	const handleFile = useCallback(
		async (file: File) => {
			if (!remote) return
			const store = useOsmStore.getState()
			store.setLoading(true)
			store.setError(null)
			try {
				const result = await remote.fromPbf(file, { id: file.name })
				store.setDataset({
					osmId: result.id,
					info: result,
					fileName: file.name,
				})
				store.setLoading(false)
				store.setProgress(null)
				setActiveTab("inspect")
			} catch (err) {
				store.setError(String(err))
			}
		},
		[remote, setActiveTab],
	)

	const loadSample = useCallback(async () => {
		if (!remote) return
		const store = useOsmStore.getState()
		store.setLoading(true)
		store.setError(null)
		try {
			const response = await fetch(SAMPLE_FILE.url)
			if (!response.ok) {
				throw new Error(`Failed to download: ${response.statusText}`)
			}
			const blob = await response.blob()
			const file = new File([blob], "denpasar_sample.osm.pbf", {
				type: "application/octet-stream",
			})
			const result = await remote.fromPbf(file, { id: file.name })
			store.setDataset({
				osmId: result.id,
				info: result,
				fileName: file.name,
			})
			store.setLoading(false)
			store.setProgress(null)
			setActiveTab("inspect")
		} catch (err) {
			store.setError(String(err))
		}
	}, [remote, setActiveTab])

	const startDrawingMode = useCallback(() => {
		clearDrawnBbox()
		setDrawingMode(true)
	}, [clearDrawnBbox, setDrawingMode])

	const cancelDrawing = useCallback(() => {
		setDrawingMode(false)
		clearDrawnBbox()
	}, [setDrawingMode, clearDrawnBbox])

	const downloadFromOverpass = useCallback(async () => {
		if (!remote || !drawnBbox) return

		// Check area size
		const areaKm2 = calculateBboxAreaKm2(
			drawnBbox.minLon,
			drawnBbox.minLat,
			drawnBbox.maxLon,
			drawnBbox.maxLat,
		)

		if (areaKm2 > MAX_AREA_KM2) {
			useOsmStore
				.getState()
				.setError(
					`Area too large (${areaKm2.toFixed(1)} km²). Max allowed: ${MAX_AREA_KM2} km². Please select a smaller area.`,
				)
			return
		}

		setOverpassLoading(true)
		setDownloadSuccess(false)
		const store = useOsmStore.getState()
		store.setLoading(true)
		store.setError(null)

		try {
			// Build Overpass QL query - roads only for efficiency
			const query = `[bbox:${drawnBbox.minLat},${drawnBbox.minLon},${drawnBbox.maxLat},${drawnBbox.maxLon}];
(
  way["highway"];
  node(w);
);
out meta;`

			// Fetch from Overpass API
			const response = await fetch(OVERPASS_API, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `data=${encodeURIComponent(query)}`,
			})

			if (!response.ok) {
				throw new Error(`Overpass API error: ${response.statusText}`)
			}

			const osmXml = await response.text()

			// Parse OSM XML to GeoJSON
			const geojson = osmXmlToGeoJSON(osmXml)

			if (geojson.features.length === 0) {
				throw new Error("No roads found in selected area. Try a larger area.")
			}

			// Load GeoJSON directly using fromGeoJSON
			const fileName = `roads_${drawnBbox.minLon.toFixed(2)}_${drawnBbox.minLat.toFixed(2)}.geojson`
			const result = await remote.fromGeoJSON(
				new File([JSON.stringify(geojson)], fileName, { type: "application/geo+json" }),
				{ id: fileName },
			)

			store.setDataset({
				osmId: result.id,
				info: result,
				fileName: fileName,
			})

			setDownloadSuccess(true)
			setTimeout(() => setDownloadSuccess(false), 3000)

			store.setLoading(false)
			store.setProgress(null)
			setDrawingMode(false)
			clearDrawnBbox()
			setActiveTab("inspect")
		} catch (err) {
			store.setError(String(err))
			setOverpassLoading(false)
			store.setLoading(false)
		}
	}, [remote, drawnBbox, clearDrawnBbox, setDrawingMode, setActiveTab])

	return (
		<div className="flex flex-col gap-4 p-4">
			<h2 className="text-sm font-semibold text-zinc-300">Load OSM PBF</h2>

			<FileDropZone
				accept=".pbf,.osm.pbf"
				label="Drop .pbf file here or click to browse"
				onFile={handleFile}
				disabled={isLoading || !remote}
			/>

			{/* Sample Data Section */}
			<div className="rounded-lg bg-zinc-800/50 p-3">
				<div className="mb-2 flex items-center gap-2">
					<MapPinned className="h-4 w-4 text-blue-400" />
					<span className="text-xs font-medium text-zinc-300">Try Sample Data</span>
				</div>
				<button
					onClick={loadSample}
					disabled={isLoading || !remote}
					className="flex w-full items-center justify-between rounded-md bg-zinc-700/50 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<div>
						<div className="font-medium text-zinc-200">{SAMPLE_FILE.name}</div>
						<div className="text-zinc-500">{SAMPLE_FILE.description}</div>
					</div>
					<Download className="h-3.5 w-3.5 text-zinc-400" />
				</button>
			</div>

			{/* Download from OSM Section */}
			<div className="rounded-lg bg-zinc-800/50 p-3">
				<div className="mb-2 flex items-center gap-2">
					<SquareDashedMousePointer className="h-4 w-4 text-green-400" />
					<span className="text-xs font-medium text-zinc-300">Download from OSM</span>
				</div>
				
				{!isDrawingMode && !drawnBbox && (
					<>
						<p className="mb-2 text-[10px] text-zinc-500">
							Draw a rectangle on the map to select an area
						</p>
						<button
							onClick={startDrawingMode}
							disabled={isLoading || !remote || overpassLoading}
							className="w-full rounded-md bg-green-600/20 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30 disabled:opacity-50"
						>
							Draw Area on Map
						</button>
					</>
				)}

				{isDrawingMode && !drawnBbox && (
					<div className="rounded-md bg-blue-500/10 p-3">
						<div className="flex items-center gap-2 text-blue-400">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-xs font-medium">Drawing mode active...</span>
						</div>
						<p className="mt-1 text-[10px] text-blue-300/70">
							Click and drag on the map to draw a rectangle
						</p>
						<button
							onClick={cancelDrawing}
							className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
						>
							<X className="h-3 w-3" />
							Cancel
						</button>
					</div>
				)}

				{drawnBbox && (
					<div className="space-y-2">
						<div className="rounded-md bg-green-500/10 p-2">
							<div className="flex items-center gap-1.5 text-green-400">
								<Check className="h-3.5 w-3.5" />
								<span className="text-[10px] font-medium">Area selected</span>
							</div>
							<div className="mt-1 text-[10px] text-zinc-400 font-mono">
								{formatBbox(drawnBbox)}
							</div>
							<div className="text-[9px] text-zinc-500">
								Area: ~{calculateBboxAreaKm2(drawnBbox.minLon, drawnBbox.minLat, drawnBbox.maxLon, drawnBbox.maxLat).toFixed(1)} km²
							</div>
						</div>
						
						<div className="flex gap-2">
							<button
								onClick={downloadFromOverpass}
								disabled={overpassLoading}
								className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
							>
								{overpassLoading ? (
									<span className="flex items-center justify-center gap-1">
										<Loader2 className="h-3 w-3 animate-spin" />
										Loading...
									</span>
								) : downloadSuccess ? (
									<span className="flex items-center justify-center gap-1">
										<Check className="h-3 w-3" />
										Loaded!
									</span>
								) : (
									"Download & Load"
								)}
							</button>
							<button
								onClick={cancelDrawing}
								disabled={overpassLoading}
								className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
							>
								Redraw
							</button>
						</div>
					</div>
				)}
			</div>

			{isLoading && progress && (
				<ProgressBar
					progress={0.5}
					label={progress.msg ?? "Loading..."}
				/>
			)}

			{error && (
				<div className="rounded bg-red-900/50 p-2 text-xs text-red-300">
					{error}
				</div>
			)}

			{dataset && (
				<div className="flex flex-col gap-2 rounded-lg bg-zinc-800 p-3">
					<div className="flex items-center gap-2">
						<FileText className="h-4 w-4 text-zinc-400" />
						<span className="text-sm font-medium text-zinc-200 truncate">
							{dataset.fileName}
						</span>
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
						<div className="flex items-center gap-1.5">
							<MapPin className="h-3 w-3" />
							<span>{dataset.info.stats.nodes.toLocaleString()} nodes</span>
						</div>
						<div className="flex items-center gap-1.5">
							<Route className="h-3 w-3" />
							<span>{dataset.info.stats.ways.toLocaleString()} ways</span>
						</div>
						<div className="flex items-center gap-1.5">
							<GitBranch className="h-3 w-3" />
							<span>
								{dataset.info.stats.relations.toLocaleString()} relations
							</span>
						</div>
					</div>
					{dataset.info.bbox && (
						<div className="text-xs text-zinc-500">
							bbox: [{dataset.info.bbox.map((v) => v.toFixed(4)).join(", ")}]
						</div>
					)}
				</div>
			)}
		</div>
	)
}
