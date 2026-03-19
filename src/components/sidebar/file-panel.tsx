import { useCallback } from "react"
import { FileDropZone } from "../shared/file-drop-zone"
import { ProgressBar } from "../shared/progress-bar"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"
import { useOsm } from "../../hooks/use-osm"
import { FileText, MapPin, Route, GitBranch, MapPinned, Download, ExternalLink } from "lucide-react"

// Sample data - uses local files from public/samples/
const SAMPLE_FILES = [
	{
		name: "Monaco",
		url: "/samples/monaco.osm.pbf",
		description: "Dense urban network (~0.7 MB)",
	},
]

export function FilePanel() {
	const { remote } = useOsm()
	const { dataset, isLoading, progress, error } = useOsmStore()
	const setActiveTab = useUIStore((s) => s.setActiveTab)

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

	const loadSample = useCallback(
		async (sample: (typeof SAMPLE_FILES)[0]) => {
			if (!remote) return
			const store = useOsmStore.getState()
			store.setLoading(true)
			store.setError(null)
			try {
				// Fetch the sample file
				const response = await fetch(sample.url)
				if (!response.ok) {
					throw new Error(`Failed to download: ${response.statusText}`)
				}
				const blob = await response.blob()
				const file = new File([blob], `${sample.name.replace(/,\s*/g, "_").toLowerCase()}.osm.pbf`, {
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
		},
		[remote, setActiveTab],
	)

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
				<div className="flex flex-col gap-2">
					{SAMPLE_FILES.map((sample) => (
						<button
							key={sample.name}
							onClick={() => loadSample(sample)}
							disabled={isLoading || !remote}
							className="flex items-center justify-between rounded-md bg-zinc-700/50 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<div>
								<div className="font-medium text-zinc-200">{sample.name}</div>
								<div className="text-zinc-500">{sample.description}</div>
							</div>
							<Download className="h-3.5 w-3.5 text-zinc-400" />
						</button>
					))}
				</div>
			</div>

			{/* Help Section */}
			{!dataset && !isLoading && (
				<div className="rounded-lg bg-zinc-800/30 p-3 text-xs text-zinc-500">
					<p className="mb-2">
						<strong className="text-zinc-400">Don&apos;t have OSM data?</strong>
					</p>
					<ul className="list-disc space-y-1 pl-4">
						<li>
							Download from{" "}
							<a
								href="https://download.geofabrik.de/"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-0.5 text-blue-400 hover:underline"
							>
								Geofabrik
								<ExternalLink className="h-3 w-3" />
							</a>
							{" "}(country extracts)
						</li>
						<li>
							Custom extract from{" "}
							<a
								href="https://extract.bbbike.org/"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-0.5 text-blue-400 hover:underline"
							>
								BBBike
								<ExternalLink className="h-3 w-3" />
							</a>
						</li>
						<li>Or try the sample data above ☝️</li>
					</ul>
				</div>
			)}

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
