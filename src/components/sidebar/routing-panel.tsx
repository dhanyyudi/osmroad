import { useCallback } from "react"
import { useRoutingStore } from "../../stores/routing-store"
import { useOsmStore } from "../../stores/osm-store"
import {
	Navigation,
	X,
	Loader2,
	AlertTriangle,
	Route as RouteIcon,
} from "lucide-react"

function formatDistance(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)}m`
	return `${(meters / 1000).toFixed(2)}km`
}

function formatTime(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)} sec`
	const mins = Math.floor(seconds / 60)
	const secs = Math.round(seconds % 60)
	if (mins < 60) return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`
	const hours = Math.floor(mins / 60)
	const remainMins = mins % 60
	return `${hours} hr ${remainMins} min`
}

function formatCoord(coord: [number, number]): string {
	return `${coord[1].toFixed(6)}, ${coord[0].toFixed(6)}`
}

export function RoutingPanel() {
	const dataset = useOsmStore((s) => s.dataset)
	const {
		fromPoint,
		toPoint,
		fromNode,
		toNode,
		result,
		isRouting,
		isActive,
		noNodeNearby,
		setActive,
		reset,
	} = useRoutingStore()

	const toggleRouting = useCallback(() => {
		setActive(!isActive)
	}, [isActive, setActive])

	if (!dataset) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500">
				<RouteIcon className="h-8 w-8" />
				<span className="text-sm">Load a PBF file first</span>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3 p-4">
			<button
				onClick={toggleRouting}
				className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
					isActive
						? "bg-blue-600 text-white"
						: "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
				}`}
			>
				<Navigation className="h-4 w-4" />
				{isActive ? "Routing Active — Click Map" : "Start Routing"}
			</button>

			{isActive && (
				<>
					{!fromPoint && !noNodeNearby && !isRouting && (
						<div className="text-xs text-zinc-400 text-center">
							Click on the map to set a starting point
							<div className="text-zinc-500">
								(routing graph builds on first use)
							</div>
						</div>
					)}
					{fromPoint && !toPoint && !noNodeNearby && !isRouting && (
						<div className="text-xs text-zinc-400 text-center">
							Click on the map to set a destination
						</div>
					)}

					{noNodeNearby && (
						<div className="flex items-center gap-2 text-xs text-amber-400">
							<AlertTriangle className="h-3 w-3 shrink-0" />
							No road found nearby. Click closer to a road.
						</div>
					)}

					{isRouting && (
						<div className="flex items-center gap-2 text-xs text-zinc-400">
							<Loader2 className="h-3 w-3 animate-spin" />
							Calculating route...
						</div>
					)}

					{fromPoint && fromNode && (
						<div className="rounded-lg bg-zinc-800 p-2 space-y-1">
							<div className="text-xs font-semibold text-red-400">FROM</div>
							<div className="grid grid-cols-2 gap-x-3 text-[11px]">
								<div>
									<div className="text-zinc-500">Click</div>
									<div className="text-zinc-300">
										{formatCoord(fromPoint)}
									</div>
								</div>
								<div>
									<div className="text-zinc-500">Snapped</div>
									<div className="text-zinc-300">
										{formatDistance(fromNode.distance)} away
									</div>
								</div>
							</div>
						</div>
					)}

					{toPoint && toNode && (
						<div className="rounded-lg bg-zinc-800 p-2 space-y-1">
							<div className="text-xs font-semibold text-red-400">TO</div>
							<div className="grid grid-cols-2 gap-x-3 text-[11px]">
								<div>
									<div className="text-zinc-500">Click</div>
									<div className="text-zinc-300">
										{formatCoord(toPoint)}
									</div>
								</div>
								<div>
									<div className="text-zinc-500">Snapped</div>
									<div className="text-zinc-300">
										{formatDistance(toNode.distance)} away
									</div>
								</div>
							</div>
						</div>
					)}

					{toPoint && !result && !isRouting && (
						<div className="text-xs text-red-400 font-semibold text-center">
							No route found between these points
						</div>
					)}

					{result && (
						<div className="rounded-lg bg-zinc-800 p-2 space-y-2">
							<div className="text-xs font-semibold text-blue-400">ROUTE</div>
							<div className="grid grid-cols-2 gap-2 text-[11px]">
								<div>
									<div className="text-zinc-500">Distance</div>
									<div className="text-zinc-200 font-medium">
										{formatDistance(result.distance ?? 0)}
									</div>
								</div>
								<div>
									<div className="text-zinc-500">Est. Time</div>
									<div className="text-zinc-200 font-medium">
										{formatTime(result.time ?? 0)}
									</div>
								</div>
							</div>

							{result.segments && result.segments.length > 0 && (
								<div className="space-y-1">
									<div className="text-[10px] text-zinc-500 uppercase">
										Directions ({result.segments.length} segments)
									</div>
									<div className="max-h-48 overflow-y-auto space-y-1">
										{result.segments.map((seg, i) => (
											<div
												key={`${seg.wayIds.join("-")}-${i}`}
												className="border-l-2 border-blue-400 pl-2 text-[11px]"
											>
												<div
													className="text-zinc-200"
													title={`Way IDs: ${seg.wayIds.join(", ")}`}
												>
													{seg.name || `(${seg.highway})`}
												</div>
												<div className="text-zinc-500">
													{formatDistance(seg.distance)} ·{" "}
													{formatTime(seg.time)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{(fromPoint || result) && (
						<button
							onClick={reset}
							disabled={isRouting}
							className="flex items-center justify-center gap-1.5 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
						>
							<X className="h-3 w-3" />
							Clear Route
						</button>
					)}
				</>
			)}
		</div>
	)
}
