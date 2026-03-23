import { useState } from "react"
import { useUIStore } from "../../stores/ui-store"
import { useOsmStore } from "../../stores/osm-store"
import { 
	Info, 
	Minimize2,
	Maximize2
} from "lucide-react"

interface FloatingToolbarProps {
	position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}

export function FloatingToolbar({ position = "top-right" }: FloatingToolbarProps) {
	const [isExpanded, setIsExpanded] = useState(true)
	const { layers, toggleLayer, basemapId, setBasemapId } = useUIStore()
	const dataset = useOsmStore((s) => s.dataset)

	const positionClasses = {
		"top-left": "top-4 left-4",
		"top-right": "top-4 right-4",
		"bottom-left": "bottom-4 left-4",
		"bottom-right": "bottom-4 right-4",
	}

	if (!isExpanded) {
		return (
			<button
				onClick={() => setIsExpanded(true)}
				className={`fixed ${positionClasses[position]} z-30 p-2 rounded-lg bg-zinc-900/90 backdrop-blur border border-zinc-700 text-zinc-300 shadow-lg hover:bg-zinc-800 transition-all`}
				aria-label="Expand toolbar"
			>
				<Maximize2 className="h-4 w-4" />
			</button>
		)
	}

	return (
		<div
			className={`fixed ${positionClasses[position]} z-30 flex flex-col gap-2 p-2 rounded-xl bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-lg`}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-800">
				<span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Tools</span>
				<button
					onClick={() => setIsExpanded(false)}
					className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
					aria-label="Collapse toolbar"
				>
					<Minimize2 className="h-3 w-3" />
				</button>
			</div>

			{/* Layer Toggles */}
			{dataset && (
				<div className="flex flex-col gap-1">
					<span className="text-[10px] text-zinc-600 px-1">Layers</span>
					{[
						{ key: "roads" as const, label: "Roads", icon: "🛣️" },
						{ key: "nodes" as const, label: "Nodes", icon: "📍" },
						{ key: "restrictions" as const, label: "Restrictions", icon: "🚫" },
						{ key: "access" as const, label: "Access", icon: "🔒" },
					].map(({ key, label, icon }) => (
						<button
							key={key}
							onClick={() => toggleLayer(key)}
							className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
								layers[key]
									? "bg-blue-500/20 text-blue-400"
									: "text-zinc-500 hover:text-zinc-300"
							}`}
						>
							<span>{icon}</span>
							<span>{label}</span>
						</button>
					))}
				</div>
			)}

			{/* Info */}
			{dataset && (
				<div className="pt-1 border-t border-zinc-800">
					<div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-zinc-500">
						<Info className="h-3 w-3" />
						<span>
							{dataset.info.stats.ways.toLocaleString()} roads
						</span>
					</div>
				</div>
			)}
		</div>
	)
}
