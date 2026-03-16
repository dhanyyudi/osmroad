import { useUIStore } from "../../stores/ui-store"
import {
	Route,
	MapPin,
	Gauge,
	AlertTriangle,
	ShieldOff,
	Layers,
} from "lucide-react"

const LAYER_CONFIG = [
	{ key: "roads" as const, label: "Roads", icon: Route },
	{ key: "nodes" as const, label: "Nodes", icon: MapPin },
	{ key: "speed" as const, label: "Speed Overlay", icon: Gauge },
	{
		key: "restrictions" as const,
		label: "Turn Restrictions",
		icon: AlertTriangle,
	},
	{ key: "access" as const, label: "Access Blocked", icon: ShieldOff },
]

export function LayersPanel() {
	const layers = useUIStore((s) => s.layers)
	const toggleLayer = useUIStore((s) => s.toggleLayer)

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-center gap-2">
				<Layers className="h-4 w-4 text-zinc-400" />
				<h2 className="text-sm font-semibold text-zinc-300">Layer Visibility</h2>
			</div>

			<div className="flex flex-col gap-1">
				{LAYER_CONFIG.map(({ key, label, icon: Icon }) => (
					<button
						key={key}
						onClick={() => toggleLayer(key)}
						className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
							layers[key]
								? "bg-zinc-700 text-zinc-200"
								: "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400"
						}`}
					>
						<Icon className="h-4 w-4" />
						<span className="flex-1 text-left">{label}</span>
						<div
							className={`h-3 w-3 rounded-full ${
								layers[key] ? "bg-green-500" : "bg-zinc-600"
							}`}
						/>
					</button>
				))}
			</div>
		</div>
	)
}
