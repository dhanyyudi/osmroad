import { useState, useCallback } from "react"
import { useOsmStore } from "../../stores/osm-store"
import { useUIStore } from "../../stores/ui-store"
import { useSearchStore, type SearchHighlight } from "../../stores/search-store"
import { useOsm } from "../../hooks/use-osm"
import { Search, Loader2, X } from "lucide-react"

interface SearchResult {
	id: number
	type: "node" | "way" | "relation"
	tags: Record<string, string>
	label: string
}

export function SearchPanel() {
	const { remote } = useOsm()
	const dataset = useOsmStore((s) => s.dataset)
	const selectEntity = useOsmStore((s) => s.selectEntity)
	const setActiveTab = useUIStore((s) => s.setActiveTab)
	const setHighlights = useSearchStore((s) => s.setHighlights)
	const clearHighlights = useSearchStore((s) => s.clearHighlights)

	const [query, setQuery] = useState("")
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)

	const handleSearch = useCallback(async () => {
		if (!remote || !dataset || !query.trim()) return
		setSearching(true)
		setResults([])
		clearHighlights()

		try {
			const q = query.trim()
			const found: SearchResult[] = []
			const highlights: SearchHighlight[] = []

			// ID search: "way/123" or "node/456" or "id:123"
			const idMatch = q.match(/^(?:(node|way|relation)\/)?(?:id:)?(\d+)$/i)
			if (idMatch) {
				const entityId = Number(idMatch[2])
				const types: Array<"node" | "way" | "relation"> = idMatch[1]
					? [idMatch[1].toLowerCase() as "node" | "way" | "relation"]
					: ["way", "node", "relation"]

				for (const type of types) {
					const tags = await remote.getWorker().getEntityTags(dataset.osmId, type, entityId)
					if (tags) {
						const label = tags.name ?? tags.highway ?? tags.ref ?? `${type}/${entityId}`
						found.push({ id: entityId, type, tags, label })
						if (type === "way") {
							const rawCoords = await remote.getWorker().getWayCoords(dataset.osmId, entityId)
							if (rawCoords) {
								const coords = JSON.parse(JSON.stringify(rawCoords)) as Array<[number, number]>
								highlights.push({ id: entityId, type, coords, tags, label })
							}
						} else if (type === "node") {
							const rawCoord = await remote.getWorker().getNodeCoords(dataset.osmId, entityId)
							if (rawCoord) {
								const coord = [Number(rawCoord[0]), Number(rawCoord[1])] as [number, number]
								highlights.push({ id: entityId, type, coords: [coord], tags, label })
							}
						}
					}
				}
			} else {
				// Tag search: "key=value" or just "key"
				const tagMatch = q.match(/^([^=:]+)[=:](.+)$/)
				const key = tagMatch ? tagMatch[1]!.trim() : q
				const value = tagMatch ? tagMatch[2]!.trim() : undefined

				// Deep-clone search results to avoid Comlink proxy issues
				const rawResult = await remote.search(dataset.osmId, key, value)
				const searchResult = JSON.parse(JSON.stringify(rawResult)) as typeof rawResult
				const { nodes, ways, relations } = searchResult

				// Collect way results
				const wayIds: number[] = []
				for (const way of ways.slice(0, 200)) {
					const tags: Record<string, string> = {}
					if (way.tags) for (const [k, v] of Object.entries(way.tags)) tags[k] = String(v)
					const label = tags.name ?? tags.highway ?? tags.ref ?? `way/${way.id}`
					found.push({ id: way.id, type: "way", tags, label })
					wayIds.push(way.id)
				}

				// Batch fetch all way geometries in a single RPC call
				// Deep-clone to convert Comlink proxy objects to plain arrays
				if (wayIds.length > 0) {
					const rawBatch = await remote.getWorker().getBatchWayCoords(dataset.osmId, wayIds)
					const batchCoords = JSON.parse(JSON.stringify(rawBatch)) as Array<{ id: number; coords: Array<[number, number]> }>
					for (const wc of batchCoords) {
						const r = found.find((f) => f.id === wc.id && f.type === "way")
						if (r) {
							highlights.push({ id: wc.id, type: "way", coords: wc.coords, tags: r.tags, label: r.label })
						}
					}
				}

				// Node results
				for (const node of nodes.slice(0, 30)) {
					const tags: Record<string, string> = {}
					if (node.tags) for (const [k, v] of Object.entries(node.tags)) tags[k] = String(v)
					const label = tags.name ?? tags.barrier ?? `node/${node.id}`
					found.push({ id: node.id, type: "node", tags, label })
					highlights.push({ id: node.id, type: "node", coords: [[node.lon, node.lat]], tags, label })
				}

				// Relation results
				for (const rel of relations.slice(0, 20)) {
					const tags: Record<string, string> = {}
					if (rel.tags) for (const [k, v] of Object.entries(rel.tags)) tags[k] = String(v)
					found.push({ id: rel.id, type: "relation", tags, label: tags.name ?? tags.type ?? `relation/${rel.id}` })
				}
			}

			setResults(found)
			setHighlights(highlights)
		} catch (err) {
			console.error("Search error:", err)
		} finally {
			setSearching(false)
		}
	}, [remote, dataset, query, clearHighlights, setHighlights])

	const handleSelectResult = useCallback(
		async (result: SearchResult) => {
			selectEntity({ id: result.id, type: result.type, tags: result.tags, geometry: null })
			setActiveTab("inspect")
			if (!remote || !dataset) return

			if (result.type === "way") {
				const rawCoords = await remote.getWorker().getWayCoords(dataset.osmId, result.id)
				if (rawCoords) {
					const coords = JSON.parse(JSON.stringify(rawCoords)) as Array<[number, number]>
					if (coords.length > 0) {
						let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
						for (const [lon, lat] of coords) {
							if (lon < minLon) minLon = lon; if (lat < minLat) minLat = lat
							if (lon > maxLon) maxLon = lon; if (lat > maxLat) maxLat = lat
						}
						window.dispatchEvent(new CustomEvent("osmviz:fitbounds", {
							detail: { bounds: [[minLon, minLat], [maxLon, maxLat]], padding: 80 },
						}))
					}
				}
			} else if (result.type === "node") {
				const rawCoord = await remote.getWorker().getNodeCoords(dataset.osmId, result.id)
				if (rawCoord) {
					window.dispatchEvent(new CustomEvent("osmviz:flyto", {
						detail: { lon: Number(rawCoord[0]), lat: Number(rawCoord[1]), zoom: 18 },
					}))
				}
			}
		},
		[selectEntity, setActiveTab, remote, dataset],
	)

	const handleClear = useCallback(() => {
		setQuery(""); setResults([]); clearHighlights()
	}, [clearHighlights])

	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="flex gap-1.5">
				<div className="relative flex-1">
					<input
						className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-200 border border-zinc-700 placeholder:text-zinc-500 pr-7"
						placeholder="highway=primary, access=no, way/12345..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					/>
					{query && (
						<button onClick={handleClear} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-300">
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
				<button
					onClick={handleSearch}
					disabled={searching || !query.trim()}
					className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
				>
					{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
				</button>
			</div>

			{!results.length && !searching && (
				<div className="text-[11px] text-zinc-500 space-y-0.5">
					<div><span className="text-zinc-400">ID:</span> way/12345, node/67890</div>
					<div><span className="text-zinc-400">Tag:</span> highway=primary, access=no</div>
					<div><span className="text-zinc-400">Key:</span> highway, barrier, oneway</div>
					<div className="mt-1 text-zinc-600">Results highlighted in red on map. Click to zoom.</div>
				</div>
			)}

			{results.length > 0 && (
				<div className="flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
					<div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
						<span>{results.length} results <span className="text-red-400">(on map)</span></span>
						<button onClick={handleClear} className="text-zinc-500 hover:text-zinc-300 text-[11px]">Clear</button>
					</div>
					{results.map((r) => (
						<button
							key={`${r.type}-${r.id}`}
							onClick={() => handleSelectResult(r)}
							className="flex items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800 transition-colors"
						>
							<span className={`mt-0.5 rounded px-1 text-[10px] font-mono ${
								r.type === "way" ? "bg-blue-900 text-blue-300"
								: r.type === "node" ? "bg-green-900 text-green-300"
								: "bg-purple-900 text-purple-300"
							}`}>{r.type[0]}</span>
							<div className="flex-1 min-w-0">
								<div className="text-xs text-zinc-200 truncate">{r.label}</div>
								<div className="text-[10px] text-zinc-500">{r.type}/{r.id}{r.tags.highway && ` · ${r.tags.highway}`}</div>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
