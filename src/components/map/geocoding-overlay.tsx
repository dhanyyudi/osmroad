import { useState, useCallback } from "react"
import { Search, Loader2, MapPin } from "lucide-react"
import { useIsMobile } from "../../hooks/use-media-query"

interface GeocodingResult {
	lat: number
	lon: number
	displayName: string
}

export function GeocodingOverlay() {
	const isMobile = useIsMobile()
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<GeocodingResult[]>([])
	const [searching, setSearching] = useState(false)
	const [showResults, setShowResults] = useState(false)

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return

		// Check if it's a lat,lon coordinate
		const coordMatch = query.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
		if (coordMatch) {
			const lat = parseFloat(coordMatch[1]!)
			const lon = parseFloat(coordMatch[2]!)
			if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
				window.dispatchEvent(
					new CustomEvent("osmviz:flyto", {
						detail: { lon, lat, zoom: 17 },
					}),
				)
				setShowResults(false)
				return
			}
		}

		setSearching(true)
		setResults([])
		setShowResults(true)
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
				{
					headers: { "User-Agent": "OSMRoad/1.0" },
				},
			)
			const data = await response.json()
			setResults(
				data.map(
					(item: { lat: string; lon: string; display_name: string }) => ({
						lat: parseFloat(item.lat),
						lon: parseFloat(item.lon),
						displayName: item.display_name,
					}),
				),
			)
		} catch (err) {
			console.error("Geocoding error:", err)
		} finally {
			setSearching(false)
		}
	}, [query])

	const handleSelect = useCallback((result: GeocodingResult) => {
		window.dispatchEvent(
			new CustomEvent("osmviz:flyto", {
				detail: { lon: result.lon, lat: result.lat, zoom: 16 },
			}),
		)
		setShowResults(false)
		setQuery(result.displayName.split(",")[0] ?? "")
	}, [])

	return (
		<div className={`absolute z-10 ${isMobile ? "top-3 left-16 right-3" : "top-3 right-3 w-96"}`}>
			{/* Search bar */}
			<div className="flex gap-1.5 rounded-lg bg-zinc-900/95 p-1.5 backdrop-blur shadow-lg border border-zinc-700">
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
					<input
						className="w-full rounded-md bg-zinc-800 pl-8 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 border-0 outline-none focus:ring-1 focus:ring-blue-500"
						placeholder="Search places, or lat,lon..."
						value={query}
						onChange={(e) => {
							setQuery(e.target.value)
							if (!e.target.value.trim()) setShowResults(false)
						}}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						onFocus={() => results.length > 0 && setShowResults(true)}
					/>
				</div>
				<button
					onClick={handleSearch}
					disabled={searching || !query.trim()}
					className="rounded-md bg-blue-600 px-3 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center"
				>
					{searching ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Search className="h-4 w-4" />
					)}
				</button>
			</div>

			{/* Results dropdown */}
			{showResults && results.length > 0 && (
				<div className="mt-1 rounded-lg bg-zinc-900/95 backdrop-blur shadow-lg border border-zinc-700 max-h-64 overflow-y-auto">
					{results.map((r, i) => (
						<button
							key={i}
							onClick={() => handleSelect(r)}
							className="flex items-start gap-2.5 w-full px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
						>
							<MapPin className="h-4 w-4 mt-0.5 text-blue-400 shrink-0" />
							<div className="flex-1 min-w-0">
								<div className="text-sm text-zinc-200 truncate">
									{r.displayName}
								</div>
								<div className="text-[11px] text-zinc-500">
									{r.lat.toFixed(6)}, {r.lon.toFixed(6)}
								</div>
							</div>
						</button>
					))}
				</div>
			)}

			{showResults && !searching && results.length === 0 && query.trim() && (
				<div className="mt-1 rounded-lg bg-zinc-900/95 backdrop-blur shadow-lg border border-zinc-700 px-3 py-3 text-sm text-zinc-500 text-center">
					No results found
				</div>
			)}
		</div>
	)
}
