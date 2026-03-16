import { useCallback, useState } from "react"
import { FileDropZone } from "../shared/file-drop-zone"
import { ProgressBar } from "../shared/progress-bar"
import { useSpeedStore } from "../../stores/speed-store"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"
import { useDuckDB } from "../../hooks/use-duckdb"
import { useOsm } from "../../hooks/use-osm"
import { speedColorStops } from "../../lib/speed-style"
import { Gauge, Database, Clock, Search, Loader2 } from "lucide-react"

interface SpeedRow {
	wayId: number
	timeband: number
	speed: number
	multiplier: number
}

export function SpeedPanel() {
	const { duckdb, error: duckdbError } = useDuckDB()
	const { remote } = useOsm()
	const { isLoaded, fileName, stats, isLoading, timebands, selectedTimeband } =
		useSpeedStore()
	const toggleLayer = useUIStore((s) => s.toggleLayer)
	const [loadError, setLoadError] = useState<string | null>(null)

	// Speed search
	const [searchQuery, setSearchQuery] = useState("")
	const [searchResults, setSearchResults] = useState<SpeedRow[]>([])
	const [searchLoading, setSearchLoading] = useState(false)

	const handleFile = useCallback(
		async (file: File) => {
			if (!duckdb) return
			const store = useSpeedStore.getState()
			store.setLoading(true)
			setLoadError(null)
			try {
				const buffer = await file.arrayBuffer()
				await duckdb.loadSpeedmapCSV(buffer, file.name)
				const duckStats = await duckdb.getStats()
				if (duckStats) store.setLoaded(file.name, duckStats)
				const bands = await duckdb.getTimebands()
				store.setTimebands(bands)

				// Load speed data for all highway ways in the OSM dataset
				const osmStore = useOsmStore.getState()
				if (osmStore.dataset && remote) {
					const wayIds = await remote
						.getWorker()
						.getHighwayWayIds(osmStore.dataset.osmId)
					if (wayIds.length > 0) {
						// Fetch speed data in batches
						const speedMap = new Map<
							number,
							Array<{
								wayId: number
								timeband: number
								speed: number
								multiplier: number
							}>
						>()
						const BATCH = 5000
						for (let i = 0; i < wayIds.length; i += BATCH) {
							const batch = wayIds.slice(i, i + BATCH)
							const records = await duckdb.getSpeedForWays(batch)
							for (const rec of records) {
								const absId = Math.abs(rec.wayId)
								if (!speedMap.has(absId)) {
									speedMap.set(absId, [])
								}
								speedMap.get(absId)!.push(rec)
							}
						}
						store.setSpeedData(speedMap)
					}
				}

				const uiState = useUIStore.getState()
				if (!uiState.layers.speed) toggleLayer("speed")
			} catch (err) {
				console.error("Failed to load speedmap:", err)
				setLoadError(String(err))
				store.setLoading(false)
			}
		},
		[duckdb, toggleLayer],
	)

	const handleSpeedSearch = useCallback(async () => {
		if (!duckdb || !searchQuery.trim()) return
		setSearchLoading(true)
		try {
			const wayId = parseInt(searchQuery.trim())
			if (!isNaN(wayId)) {
				const results = await duckdb.getSpeedForWays([wayId])
				setSearchResults(results)
			}
		} catch (err) {
			console.error("Speed search error:", err)
		} finally {
			setSearchLoading(false)
		}
	}, [duckdb, searchQuery])

	const colors = stats ? speedColorStops(stats.minSpeed, stats.maxSpeed) : null

	return (
		<div className="flex flex-col gap-3 p-3">
			<FileDropZone
				accept=".csv"
				label="Drop speedmap .csv file here"
				onFile={handleFile}
				disabled={isLoading || !duckdb}
			/>

			{isLoading && (
				<ProgressBar progress={0.5} label="Loading CSV into DuckDB..." />
			)}

			{(duckdbError || loadError) && (
				<div className="rounded bg-red-900/50 p-2 text-xs text-red-300">
					{duckdbError ?? loadError}
				</div>
			)}

			{isLoaded && stats && (
				<div className="flex flex-col gap-3">
					{/* Stats */}
					<div className="rounded-lg bg-zinc-800 p-2.5">
						<div className="flex items-center gap-2 mb-2">
							<Database className="h-3.5 w-3.5 text-zinc-400" />
							<span className="text-xs text-zinc-200 truncate">
								{fileName}
							</span>
						</div>
						<div className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-400">
							<div>{stats.totalRows.toLocaleString()} rows</div>
							<div>{stats.uniqueWays.toLocaleString()} ways</div>
							<div className="flex items-center gap-1">
								<Gauge className="h-3 w-3" />
								{stats.minSpeed.toFixed(1)} - {stats.maxSpeed.toFixed(1)} km/h
							</div>
							<div>avg: {stats.avgSpeed.toFixed(1)} km/h</div>
						</div>
					</div>

					{/* Timebands */}
					{timebands.length > 0 && (
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
								<Clock className="h-3 w-3" />
								<span>Timeband</span>
							</div>
							<div className="flex flex-wrap gap-1">
								<button
									onClick={() =>
										useSpeedStore.getState().setSelectedTimeband(null)
									}
									className={`rounded px-2 py-0.5 text-[11px] ${
										selectedTimeband === null
											? "bg-blue-600 text-white"
											: "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
									}`}
								>
									All
								</button>
								{timebands.map((tb) => (
									<button
										key={tb}
										onClick={() =>
											useSpeedStore.getState().setSelectedTimeband(tb)
										}
										className={`rounded px-2 py-0.5 text-[11px] ${
											selectedTimeband === tb
												? "bg-blue-600 text-white"
												: "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
										}`}
									>
										{tb}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Legend */}
					{colors && (
						<div className="flex flex-col gap-1">
							<span className="text-[11px] text-zinc-400">Speed Legend</span>
							<div className="flex h-3 rounded overflow-hidden">
								{colors.map((stop, i) => (
									<div
										key={i}
										className="flex-1"
										style={{ backgroundColor: stop.color }}
									/>
								))}
							</div>
							<div className="flex justify-between text-[10px] text-zinc-500">
								<span>{stats.minSpeed.toFixed(1)}</span>
								<span>{stats.maxSpeed.toFixed(1)} km/h</span>
							</div>
						</div>
					)}

					{/* Speed search by way ID */}
					<div className="border-t border-zinc-800 pt-3">
						<div className="text-[11px] text-zinc-400 mb-1.5">
							Search speed by Way ID
						</div>
						<div className="flex gap-1.5">
							<input
								className="flex-1 rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 border border-zinc-700 placeholder:text-zinc-500"
								placeholder="Way ID e.g. 210332862"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) =>
									e.key === "Enter" && handleSpeedSearch()
								}
							/>
							<button
								onClick={handleSpeedSearch}
								disabled={searchLoading}
								className="rounded bg-blue-600 px-2 text-white hover:bg-blue-500 disabled:opacity-50"
							>
								{searchLoading ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Search className="h-3.5 w-3.5" />
								)}
							</button>
						</div>

						{/* Search results table */}
						{searchResults.length > 0 && (
							<div className="mt-2 rounded bg-zinc-800 overflow-hidden">
								<table className="w-full text-[11px]">
									<thead>
										<tr className="border-b border-zinc-700 text-zinc-400">
											<th className="px-2 py-1 text-left">Way ID</th>
											<th className="px-2 py-1 text-left">TB</th>
											<th className="px-2 py-1 text-right">Speed</th>
											<th className="px-2 py-1 text-right">Mult</th>
										</tr>
									</thead>
									<tbody>
										{searchResults.map((row, i) => (
											<tr
												key={i}
												className="border-b border-zinc-700/50 text-zinc-300"
											>
												<td className="px-2 py-1 font-mono">
													{row.wayId}
												</td>
												<td className="px-2 py-1">{row.timeband}</td>
												<td className="px-2 py-1 text-right">
													{row.speed.toFixed(1)}
												</td>
												<td className="px-2 py-1 text-right">
													{row.multiplier.toFixed(2)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{searchResults.length === 0 &&
							searchQuery.trim() &&
							!searchLoading && (
								<div className="mt-1 text-[11px] text-zinc-500">
									No speed data found
								</div>
							)}
					</div>
				</div>
			)}
		</div>
	)
}
