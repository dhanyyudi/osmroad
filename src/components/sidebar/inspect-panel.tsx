import { useOsmStore } from "../../stores/osm-store"
import { useSpeedStore } from "../../stores/speed-store"
import { Tag, Hash, MapPin, Gauge, Copy, ExternalLink } from "lucide-react"
import { generateStreetViewURL, formatCoordinate, copyToClipboard } from "../../lib/map-utils"
import { useState } from "react"

const PRIORITY_TAGS = [
	"name",
	"highway",
	"ref",
	"oneway",
	"maxspeed",
	"lanes",
	"surface",
	"access",
	"motor_vehicle",
	"vehicle",
	"bicycle",
	"foot",
]

export function InspectPanel() {
	const entity = useOsmStore((s) => s.selectedEntity)
	const speedData = useSpeedStore((s) => s.speedData)
	const speedLoaded = useSpeedStore((s) => s.isLoaded)
	const [copied, setCopied] = useState(false)

	if (!entity) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500">
				<MapPin className="h-8 w-8" />
				<span className="text-sm">Click an entity on the map to inspect</span>
			</div>
		)
	}

	const tags = entity.tags
	const tagEntries = Object.entries(tags)

	tagEntries.sort(([a], [b]) => {
		const ai = PRIORITY_TAGS.indexOf(a)
		const bi = PRIORITY_TAGS.indexOf(b)
		if (ai !== -1 && bi !== -1) return ai - bi
		if (ai !== -1) return -1
		if (bi !== -1) return 1
		return a.localeCompare(b)
	})

	// Get speed data for this entity if it's a way
	const waySpeedRecords =
		entity.type === "way" && speedLoaded ? speedData.get(entity.id) : null

	// Coordinate display
	const hasCoordinate = entity.lat != null && entity.lon != null
	const coordString = hasCoordinate
		? formatCoordinate(entity.lat!, entity.lon!)
		: null
	const streetViewUrl = hasCoordinate
		? generateStreetViewURL(entity.lat!, entity.lon!)
		: null

	const handleCopy = async () => {
		if (!coordString) return
		const success = await copyToClipboard(`${entity.lat}, ${entity.lon}`)
		if (success) {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="flex items-center gap-2">
				<Hash className="h-4 w-4 text-zinc-400" />
				<span className="text-sm font-semibold text-zinc-200">
					{entity.type}/{entity.id}
				</span>
			</div>

			{/* Coordinate Section */}
			{hasCoordinate && (
				<div className="flex flex-col gap-2 border-b border-zinc-800 pb-3">
					<div className="flex items-center gap-1.5 text-xs text-zinc-400">
						<MapPin className="h-3 w-3" />
						<span>Coordinate</span>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between bg-zinc-800/50 rounded px-2 py-1.5">
							<span className="text-xs font-mono text-zinc-300">{coordString}</span>
							<button
								onClick={handleCopy}
								className="p-1 hover:bg-zinc-700 rounded transition-colors"
								title="Copy coordinates"
							>
								<Copy className="h-3 w-3 text-zinc-400" />
							</button>
						</div>
						{copied && (
							<span className="text-[10px] text-green-400">Copied!</span>
						)}
						{streetViewUrl && (
							<a
								href={streetViewUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded transition-colors"
							>
								<ExternalLink className="h-3 w-3" />
								<span>Open Street View</span>
							</a>
						)}
					</div>
				</div>
			)}

			{tagEntries.length === 0 ? (
				<div className="text-xs text-zinc-500">No tags</div>
			) : (
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
						<Tag className="h-3 w-3" />
						<span>{tagEntries.length} tags</span>
					</div>
					<table className="w-full text-xs">
						<tbody>
							{tagEntries.map(([key, value]) => (
								<tr
									key={key}
									className="border-b border-zinc-800 hover:bg-zinc-800/50"
								>
									<td className="py-1.5 pr-2 font-medium text-zinc-300 align-top whitespace-nowrap">
										{key}
									</td>
									<td className="py-1.5 text-zinc-400 break-all">{value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Speed data from speedmap CSV */}
			{waySpeedRecords && waySpeedRecords.length > 0 && (
				<div className="flex flex-col gap-1 border-t border-zinc-800 pt-2">
					<div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
						<Gauge className="h-3 w-3" />
						<span>Speedmap Data ({waySpeedRecords.length} records)</span>
					</div>
					<div className="rounded bg-zinc-800 overflow-hidden">
						<table className="w-full text-[11px]">
							<thead>
								<tr className="border-b border-zinc-700 text-zinc-400">
									<th className="px-2 py-1 text-left">Dir</th>
									<th className="px-2 py-1 text-left">TB</th>
									<th className="px-2 py-1 text-right">Speed</th>
									<th className="px-2 py-1 text-right">Mult</th>
								</tr>
							</thead>
							<tbody>
								{waySpeedRecords.map((rec, i) => (
									<tr
										key={i}
										className="border-b border-zinc-700/50 text-zinc-300"
									>
										<td className="px-2 py-0.5 font-mono text-[10px]">
											{rec.wayId > 0 ? "fwd" : "rev"}
										</td>
										<td className="px-2 py-0.5">{rec.timeband}</td>
										<td className="px-2 py-0.5 text-right font-medium">
											{rec.speed.toFixed(1)}
										</td>
										<td className="px-2 py-0.5 text-right">
											{rec.multiplier.toFixed(2)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}
