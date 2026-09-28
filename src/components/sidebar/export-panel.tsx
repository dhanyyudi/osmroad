import { useCallback, useState } from "react"
import { useOsmStore } from "../../stores/osm-store"
import { useOsm } from "../../hooks/use-osm"
import { isOsmBackedFormat, OSM_BACKED_FORMAT_LABEL } from "../../lib/format-converter"
import { Download, FileText, Route, Loader2, Check, Table2, Info } from "lucide-react"

type ExportState = "idle" | "exporting" | "done" | "error"

function triggerDownload(data: Uint8Array, filename: string, mimeType: string) {
	const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

const mib = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10

/** Strip a recognised geodata suffix so exports get a clean base name. */
function baseNameFor(fileName: string): string {
	return fileName
		.replace(/\.(?:osm\.)?pbf$/i, "")
		.replace(/\.(?:geo)?parquet$/i, "")
		.replace(/\.osm$/i, "")
}

export function ExportPanel() {
	const { remote } = useOsm()
	const dataset = useOsmStore((s) => s.dataset)
	const [fullState, setFullState] = useState<ExportState>("idle")
	const [roadsState, setRoadsState] = useState<ExportState>("idle")
	const [roadsFileSizeMb, setRoadsFileSizeMb] = useState<number | null>(null)
	const [parquetState, setParquetState] = useState<ExportState>("idle")
	const [parquetInfo, setParquetInfo] = useState<{ sizeMb: number; rows: number } | null>(null)

	const exportPbf = useCallback(async () => {
		if (!remote || !dataset) return
		setFullState("exporting")
		try {
			const data = await remote.toPbfData(dataset.osmId)
			triggerDownload(
				new Uint8Array(data),
				`${baseNameFor(dataset.fileName)}-modified.osm.pbf`,
				"application/octet-stream",
			)
			setFullState("done")
			setTimeout(() => setFullState("idle"), 2500)
		} catch (err) {
			console.error("Export failed:", err)
			setFullState("error")
			setTimeout(() => setFullState("idle"), 3000)
		}
	}, [remote, dataset])

	const exportRoadsPbf = useCallback(async () => {
		if (!remote || !dataset) return
		setRoadsState("exporting")
		setRoadsFileSizeMb(null)
		try {
			const data = await remote.exportRoadsPbf(dataset.osmId)
			if (!data || data.byteLength === 0) {
				throw new Error("No highway ways found in this dataset")
			}
			triggerDownload(
				data,
				`${baseNameFor(dataset.fileName)}-roads-only.osm.pbf`,
				"application/octet-stream",
			)
			setRoadsFileSizeMb(mib(data.byteLength))
			setRoadsState("done")
			setTimeout(() => {
				setRoadsState("idle")
				setRoadsFileSizeMb(null)
			}, 3000)
		} catch (err) {
			console.error("Roads export failed:", err)
			setRoadsState("error")
			setTimeout(() => setRoadsState("idle"), 3000)
		}
	}, [remote, dataset])

	const exportGeoParquet = useCallback(async () => {
		if (!remote || !dataset) return
		setParquetState("exporting")
		setParquetInfo(null)
		try {
			const result = await remote.exportGeoParquet(dataset.osmId, { roadsOnly: true })
			if (!result || result.rowCount === 0) {
				throw new Error("No features with geometry to export")
			}
			triggerDownload(
				result.bytes,
				`${baseNameFor(dataset.fileName)}.geoparquet`,
				"application/vnd.apache.parquet",
			)
			setParquetInfo({ sizeMb: mib(result.bytes.byteLength), rows: result.rowCount })
			setParquetState("done")
			setTimeout(() => {
				setParquetState("idle")
				setParquetInfo(null)
			}, 4000)
		} catch (err) {
			console.error("GeoParquet export failed:", err)
			setParquetState("error")
			setTimeout(() => setParquetState("idle"), 3000)
		}
	}, [remote, dataset])

	if (!dataset) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500">
				<FileText className="h-8 w-8" />
				<span className="text-sm">Load a file first</span>
			</div>
		)
	}

	// Roads-only export rebuilds an Osm from the highway ways and writes PBF, so
	// it works for any OSM-backed dataset, GeoParquet included.
	const canExportRoads = isOsmBackedFormat(dataset.format)

	return (
		<div className="flex flex-col gap-4 p-4">
			<h2 className="text-sm font-semibold text-zinc-300">Export</h2>

			{/* Full dataset export */}
			<div className="rounded-lg bg-zinc-800/50 p-3 space-y-2">
				<div className="flex items-center gap-2">
					<FileText className="h-4 w-4 text-zinc-400" />
					<span className="text-xs font-medium text-zinc-300">Full Dataset</span>
				</div>
				<p className="text-[10px] text-zinc-500">
					Export all loaded data as-is, including any tag edits.
				</p>
				<button
					onClick={exportPbf}
					disabled={fullState === "exporting"}
					className="flex w-full items-center justify-center gap-2 rounded bg-blue-600/80 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
				>
					{fullState === "exporting" ? (
						<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting...</>
					) : fullState === "done" ? (
						<><Check className="h-3.5 w-3.5" /> Downloaded!</>
					) : fullState === "error" ? (
						"Export failed"
					) : (
						<><Download className="h-3.5 w-3.5" /> Download .osm.pbf</>
					)}
				</button>
			</div>

			{/* Roads-only export — any OSM-backed dataset */}
			{canExportRoads ? (
				<div className="rounded-lg bg-zinc-800/50 p-3 space-y-2">
					<div className="flex items-center gap-2">
						<Route className="h-4 w-4 text-green-400" />
						<span className="text-xs font-medium text-zinc-300">Roads Only</span>
						<span className="ml-auto rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium text-green-400 font-mono">
							highway=*
						</span>
					</div>
					<p className="text-[10px] text-zinc-500">
						Export a filtered PBF with only <span className="text-zinc-400">highway=*</span> ways and their referenced nodes — useful for reducing file size or routing tools.
					</p>
					<div className="rounded bg-zinc-700/40 px-2.5 py-2 text-[10px] text-zinc-400 space-y-1">
						<div className="flex justify-between">
							<span>Source</span>
							<span className="font-mono text-zinc-300 truncate max-w-35">{dataset.fileName}</span>
						</div>
						<div className="flex justify-between">
							<span>Total ways</span>
							<span className="font-mono text-zinc-300">{dataset.info.stats.ways.toLocaleString()}</span>
						</div>
						<div className="flex justify-between">
							<span>Total nodes</span>
							<span className="font-mono text-zinc-300">{dataset.info.stats.nodes.toLocaleString()}</span>
						</div>
					</div>
					<button
						onClick={exportRoadsPbf}
						disabled={roadsState === "exporting"}
						className="flex w-full items-center justify-center gap-2 rounded bg-green-700/80 px-3 py-2 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
					>
						{roadsState === "exporting" ? (
							<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Filtering & exporting...</>
						) : roadsState === "done" ? (
							<><Check className="h-3.5 w-3.5" /> Downloaded!{roadsFileSizeMb !== null && ` (${roadsFileSizeMb} MB)`}</>
						) : roadsState === "error" ? (
							"Failed — no highway ways found"
						) : (
							<><Download className="h-3.5 w-3.5" /> Download roads-only .osm.pbf</>
						)}
					</button>
				</div>
			) : (
				<p className="text-[10px] text-zinc-600 text-center px-2">
					Roads-only export needs an OSM-backed dataset ({OSM_BACKED_FORMAT_LABEL}).
				</p>
			)}

			{/* GeoParquet conversion */}
			<div className="rounded-lg bg-zinc-800/50 p-3 space-y-2">
				<div className="flex items-center gap-2">
					<Table2 className="h-4 w-4 text-amber-400" />
					<span className="text-xs font-medium text-zinc-300">Convert to GeoParquet</span>
				</div>
				<p className="text-[10px] text-zinc-500">
					Columnar, WKB-encoded geometry with OSM tags as JSON. Readable by
					QGIS, GeoPandas, DuckDB and this app's own GeoParquet loader.
				</p>
				<div className="flex items-start gap-1.5 rounded bg-amber-500/10 px-2.5 py-2">
					<Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
					<p className="text-[10px] leading-relaxed text-amber-300/80">
						Note: geometry is stored per feature with no node table, so for an
						extract that is already filtered down to roads a PBF is usually the
						smaller of the two. The win is portability, not size.
					</p>
				</div>
				<button
					onClick={exportGeoParquet}
					disabled={parquetState === "exporting"}
					className="flex w-full items-center justify-center gap-2 rounded bg-amber-700/80 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
				>
					{parquetState === "exporting" ? (
						<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Encoding...</>
					) : parquetState === "done" ? (
						<>
							<Check className="h-3.5 w-3.5" /> Downloaded!
							{parquetInfo && ` (${parquetInfo.sizeMb} MB, ${parquetInfo.rows.toLocaleString()} rows)`}
						</>
					) : parquetState === "error" ? (
						"Failed — no geometry to export"
					) : (
						<><Download className="h-3.5 w-3.5" /> Download .geoparquet</>
					)}
				</button>
			</div>
		</div>
	)
}
