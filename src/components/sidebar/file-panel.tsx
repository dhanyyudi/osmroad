import { useCallback, useState, useEffect } from "react"
import { FileDropZone } from "../shared/file-drop-zone"
import { ProgressBar } from "../shared/progress-bar"
import { ReloadDialog } from "../shared/reload-dialog"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"
import { useOsm } from "../../hooks/use-osm"
import { osmXmlToGeoJSON, formatBbox, calculateBboxAreaKm2 } from "../../lib/osm-xml-parser"
import { 
	saveDatasetMetadata, 
	getLastDataset,
	type CachedDataset 
} from "../../lib/storage"
import { FileText, MapPin, Route, GitBranch, MapPinned, SquareDashedMousePointer, Loader2, X, Check, Zap, ArrowRight, Lock, ChevronDown } from "lucide-react"

// Sample datasets - Multiple regions for capacity demonstration
interface SampleFile {
	name: string
	url: string
	description: string
	format: "pbf"
	region: string
	flag: string
	size: string
	downloadedOn: string
}

const SAMPLE_FILES: SampleFile[] = [
	{
		name: "Bali Island",
		url: "/samples/bali-island-roads.osm.pbf",
		description: "Complete Bali road network",
		format: "pbf",
		region: "indonesia",
		flag: "ID",
		size: "~14 MB",
		downloadedOn: "23 March 2026",
	},
	{
		name: "Singapore",
		url: "/samples/singapore-roads.osm.pbf",
		description: "Singapore full road network",
		format: "pbf",
		region: "singapore",
		flag: "SG",
		size: "~14 MB",
		downloadedOn: "23 March 2026",
	},
	{
		name: "Chinese Taipei",
		url: "/samples/chinese-taipei-roads.osm.pbf",
		description: "Taipei city roads",
		format: "pbf",
		region: "taiwan",
		flag: "TW",
		size: "~71 MB",
		downloadedOn: "23 March 2026",
	},
]

// Overpass API endpoint
const OVERPASS_API = "https://overpass-api.de/api/interpreter"

// Maximum allowed area (km) to prevent timeout
const MAX_AREA_KM2 = 10
const OVERPASS_TIMEOUT_MS = 90000 // 90 seconds

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
	const [showAllSamples, setShowAllSamples] = useState(false)
	const [loadingSample, setLoadingSample] = useState<string | null>(null)
	
	// Reload dialog state
	const [showReloadDialog, setShowReloadDialog] = useState(false)
	const [cachedDataset, setCachedDataset] = useState<CachedDataset | null>(null)
	const [pendingSampleFile, setPendingSampleFile] = useState<SampleFile | null>(null)

	// Check for cached data on mount
	useEffect(() => {
		const checkCachedData = async () => {
			if (dataset) return // Don't show if already loaded
			
			const lastDataset = await getLastDataset()
			if (lastDataset) {
				// Check if it's a sample file
				const matchingSample = SAMPLE_FILES.find(s => 
					lastDataset.fileUrl?.includes(s.url) || 
					lastDataset.fileName.includes(s.region)
				)
				
				if (matchingSample) {
					setCachedDataset(lastDataset)
					setPendingSampleFile(matchingSample)
					setShowReloadDialog(true)
				}
			}
		}
		
		checkCachedData()
	}, [dataset])
	
	// Save dataset metadata when loaded
	useEffect(() => {
		if (dataset) {
			saveDatasetMetadata({
				id: dataset.osmId,
				fileName: dataset.fileName,
				cachedAt: Date.now(),
				fileSize: 0, // Will be updated if available
				stats: dataset.info.stats,
				bbox: dataset.info.bbox,
			})
		}
	}, [dataset])

	const handleFile = useCallback(
		async (file: File) => {
			if (!remote) return
			if (useOsmStore.getState().dataset) {
				console.log("[FilePanel] Upload blocked: file already loaded")
				return
			}
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

	const loadSample = useCallback(async (sampleFile: SampleFile) => {
		if (!remote) return
		if (useOsmStore.getState().dataset) {
			console.log("[FilePanel] Sample load blocked: file already loaded")
			return
		}
		setLoadingSample(sampleFile.name)
		const store = useOsmStore.getState()
		store.setLoading(true)
		store.setError(null)
		try {
			const response = await fetch(sampleFile.url)
			if (!response.ok) {
				throw new Error(`Failed to download: ${response.statusText}`)
			}
			const blob = await response.blob()
			const fileName = sampleFile.url.split('/').pop() || `${sampleFile.region}_sample.osm.pbf`
			const file = new File([blob], fileName, {
				type: "application/octet-stream",
			})
			const result = await remote.fromPbf(file, { id: fileName })
			store.setDataset({
				osmId: result.id,
				info: result,
				fileName: fileName,
			})
			store.setLoading(false)
			store.setProgress(null)
			setActiveTab("inspect")
		} catch (err) {
			store.setError(String(err))
		} finally {
			setLoadingSample(null)
		}
	}, [remote, setActiveTab])

	const startDrawingMode = useCallback(() => {
		if (useOsmStore.getState().dataset) {
			console.log("[FilePanel] Drawing mode blocked: file already loaded")
			return
		}
		clearDrawnBbox()
		setDrawingMode(true)
	}, [clearDrawnBbox, setDrawingMode])

	const cancelDrawing = useCallback(() => {
		setDrawingMode(false)
		clearDrawnBbox()
	}, [setDrawingMode, clearDrawnBbox])

	const downloadFromOverpass = useCallback(async () => {
		if (!remote || !drawnBbox) return

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
					`Area too large (${areaKm2.toFixed(1)} km). Max allowed: ${MAX_AREA_KM2} km. Please draw a smaller area (about 2-5 km works best).`,
				)
			return
		}

		setOverpassLoading(true)
		setDownloadSuccess(false)
		const store = useOsmStore.getState()
		store.setLoading(true)
		store.setError(null)

		try {
			const query = `[bbox:${drawnBbox.minLat},${drawnBbox.minLon},${drawnBbox.maxLat},${drawnBbox.maxLon}];
way["highway"];
out geom;`

			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS)
			
			const response = await fetch(OVERPASS_API, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `data=${encodeURIComponent(query)}`,
				signal: controller.signal,
			})
			
			clearTimeout(timeoutId)

			if (!response.ok) {
				if (response.status === 504) {
					throw new Error("Overpass API timeout. Area too large or too complex. Try a smaller area (2-3 km).")
				}
				throw new Error(`Overpass API error: ${response.statusText}`)
			}

			const osmXml = await response.text()
			const geojson = osmXmlToGeoJSON(osmXml)

			if (geojson.features.length === 0) {
				throw new Error("No roads found in selected area. Try a larger area.")
			}

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
			if (err instanceof Error && err.name === "AbortError") {
				store.setError("Request timed out. Area may be too large or network is slow. Try a smaller area.")
			} else {
				store.setError(String(err))
			}
			setOverpassLoading(false)
			store.setLoading(false)
		}
	}, [remote, drawnBbox, clearDrawnBbox, setDrawingMode, setActiveTab])

	const isLocked = !!dataset
	const displayedSamples = showAllSamples ? SAMPLE_FILES : SAMPLE_FILES.slice(0, 1)

	return (
		<div className="flex flex-col gap-4 p-4">
			<h2 className="text-sm font-semibold text-zinc-300">Load OSM PBF</h2>

			{isLocked && (
				<div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-3">
					<div className="flex items-center gap-2 text-amber-400">
						<Lock className="h-4 w-4" />
						<span className="text-xs font-medium">Upload Locked</span>
					</div>
					<p className="mt-1 text-[10px] text-amber-300/70">
						File already loaded. Refresh page to load a new file.
					</p>
				</div>
			)}

			<FileDropZone
				accept=".pbf,.osm.pbf"
				label={isLocked ? "File already loaded" : "Drop .pbf file here or click to browse"}
				onFile={handleFile}
				disabled={isLoading || !remote || isLocked}
			/>

			{/* Sample Data Section - Multiple Regions */}
			<div className={`relative overflow-hidden rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-900/30 via-zinc-800/50 to-zinc-800/50 p-3 ${isLocked ? 'opacity-50' : ''}`}>
				<div className="absolute right-2 top-2">
					<span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
						<Zap className="h-3 w-3" />
						Quick Start
					</span>
				</div>
				
				<div className="mb-3 flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
						<MapPinned className="h-4 w-4 text-blue-400" />
					</div>
					<div>
						<span className="text-xs font-semibold text-zinc-200">Sample Datasets</span>
						<p className="text-[10px] text-zinc-500">Load pre-filtered road networks</p>
					</div>
				</div>
				
				<div className="space-y-2">
					{displayedSamples.map((sample) => (
						<button
							key={sample.region}
							onClick={() => loadSample(sample)}
							disabled={isLoading || !remote || isLocked || loadingSample === sample.name}
							className="group flex w-full items-center justify-between rounded-lg bg-blue-600/20 px-3 py-2.5 text-left text-xs transition-all hover:bg-blue-600/30 hover:shadow-lg hover:shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
						>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors shrink-0">
										<span className="text-[10px] font-bold">{sample.flag}</span>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<div className="font-medium text-blue-300 group-hover:text-blue-200 transition-colors">{sample.name}</div>
											<span className="inline-flex items-center rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] text-zinc-400 shrink-0">
												{sample.downloadedOn}
											</span>
										</div>
										<div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
											<span>{sample.size}</span>
											<span className="text-zinc-600">•</span>
											<span className="text-zinc-400 truncate">{sample.description}</span>
										</div>
									</div>
								</div>
							{loadingSample === sample.name ? (
								<Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
							) : (
								<ArrowRight className="h-4 w-4 text-blue-400 transition-transform group-hover:translate-x-0.5" />
							)}
						</button>
					))}
				</div>

				{SAMPLE_FILES.length > 1 && (
					<button
						onClick={() => setShowAllSamples(!showAllSamples)}
						className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						<span>{showAllSamples ? "Show less" : `Show ${SAMPLE_FILES.length - 1} more datasets`}</span>
						<ChevronDown className={`h-3 w-3 transition-transform ${showAllSamples ? 'rotate-180' : ''}`} />
					</button>
				)}
			</div>

			{/* Download from OSM Section */}
			<div className={`rounded-lg bg-zinc-800/50 p-3 ${isLocked ? 'opacity-50' : ''}`}>
				<div className="mb-2 flex items-center gap-2">
					<SquareDashedMousePointer className="h-4 w-4 text-green-400" />
					<span className="text-xs font-medium text-zinc-300">Download from OSM</span>
				</div>
				
				{!isDrawingMode && !drawnBbox && (
					<>
						<p className="mb-2 text-[10px] text-zinc-500">
							Draw a rectangle on the map (max {MAX_AREA_KM2} km, ~2-5 km works best)
						</p>
						<button
							onClick={startDrawingMode}
							disabled={isLoading || !remote || overpassLoading || isLocked}
							className="w-full rounded-md bg-green-600/20 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30 disabled:opacity-50"
						>
							{isLocked ? "File already loaded" : "Draw Area on Map"}
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
							Click and drag on the map. Tip: Smaller areas (~2-3 km) load faster.
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
						{(() => {
							const areaKm2 = calculateBboxAreaKm2(drawnBbox.minLon, drawnBbox.minLat, drawnBbox.maxLon, drawnBbox.maxLat)
							const isTooLarge = areaKm2 > MAX_AREA_KM2
							return (
								<div className={`rounded-md p-2 ${isTooLarge ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
									<div className={`flex items-center gap-1.5 ${isTooLarge ? 'text-red-400' : 'text-green-400'}`}>
										{isTooLarge ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
										<span className="text-[10px] font-medium">
											{isTooLarge ? 'Area too large!' : 'Area selected'}
										</span>
									</div>
									<div className="mt-1 text-[10px] text-zinc-400 font-mono">
										{formatBbox(drawnBbox)}
									</div>
									<div className={`text-[9px] ${isTooLarge ? 'text-red-400' : 'text-zinc-500'}`}>
										Area: ~{areaKm2.toFixed(1)} km {isTooLarge && `(max ${MAX_AREA_KM2} km)`}
									</div>
								</div>
							)
						})()}
						
						{(() => {
							const areaKm2 = calculateBboxAreaKm2(drawnBbox.minLon, drawnBbox.minLat, drawnBbox.maxLon, drawnBbox.maxLat)
							const isTooLarge = areaKm2 > MAX_AREA_KM2
							return (
								<div className="flex gap-2">
									<button
										onClick={downloadFromOverpass}
										disabled={overpassLoading || isTooLarge || isLocked}
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
										) : isLocked ? (
											"File already loaded"
										) : isTooLarge ? (
											"Area Too Large"
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
							)
						})()}
					</div>
				)}
			</div>

			{isLoading && progress && (
				<ProgressBar progress={progress} />
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

			{/* Reload Dialog */}
			<ReloadDialog
				isOpen={showReloadDialog}
				cachedDataset={cachedDataset}
				onClose={() => {
					setShowReloadDialog(false)
					setPendingSampleFile(null)
				}}
				onReload={() => {
					setShowReloadDialog(false)
					if (pendingSampleFile) {
						loadSample(pendingSampleFile)
					}
				}}
				onLoadNew={() => {
					setShowReloadDialog(false)
					setCachedDataset(null)
					// Don't load anything, let user choose
				}}
			/>
		</div>
	)
}
