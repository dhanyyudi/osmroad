import { Info, ChevronDown, ChevronUp } from "lucide-react"
import { useUIStore } from "../../stores/ui-store"

// Temaki SVG paths (15×15 viewBox) for legend icons — matches node-icons.ts
const NODE_LEGEND: Array<{
	color: string
	label: string
	path?: string
}> = [
	{
		color: "#e8a838", label: "Traffic Signal",
		path: "M9.21 0C10.48 0 11.5 1.03 11.5 2.31L11.5 12.69C11.5 13.97 10.48 15 9.21 15L5.79 15C4.52 15 3.5 13.97 3.5 12.69L3.5 2.31C3.5 1.03 4.52 0 5.79 0L9.21 0zM7.5 10.5C6.67 10.5 6 11.17 6 12C6 12.83 6.67 13.5 7.5 13.5C8.33 13.5 9 12.83 9 12C9 11.17 8.33 10.5 7.5 10.5zM7.5 6C6.67 6 6 6.67 6 7.5C6 8.33 6.67 9 7.5 9C8.33 9 9 8.33 9 7.5C9 6.67 8.33 6 7.5 6zM7.5 1.5C6.67 1.5 6 2.17 6 3C6 3.83 6.67 4.5 7.5 4.5C8.33 4.5 9 3.83 9 3C9 2.17 8.33 1.5 7.5 1.5z",
	},
	{
		color: "#e03030", label: "Stop Sign",
		path: "M10.5 0C10.5 0 15 4.5 15 4.5C15 4.5 15 10.5 15 10.5C15 10.5 10.5 15 10.5 15C10.5 15 4.5 15 4.5 15C4.5 15 0 10.5 0 10.5L0 4.5C0 4.5 4.5 0 4.5 0L10.5 0z",
	},
	{
		color: "#6a8fa0", label: "Crossing",
		path: "M9.38 1.96C9.38 2.76 8.68 3.42 7.81 3.42C6.95 3.42 6.25 2.76 6.25 1.96C6.25 1.15 6.95 0.5 7.81 0.5C8.68 0.5 9.38 1.15 9.38 1.96zM6.25 4L6.88 4L7.19 4L12.5 7.79L12.5 8.67L11.88 8.67L8.75 6.41L8.75 8.67L10 11L11.25 13.92L10.63 14.5L10 14.5L8.75 11.58L6.25 8.08L6.25 5.37L4.69 6.63L3.44 8.67L2.5 8.67L2.5 8.08L3.44 6.33L6.25 4zM6.78 10.07L5.33 14.5L4.69 14.5L4.06 13.92L5.82 8.99z",
	},
	{
		color: "#e07020", label: "Give Way",
		path: "M14.5 1.5L7.5 14L0.5 1.5L14.5 1.5zM11.25 3.5L3.75 3.5L7.5 10.25L11.25 3.5z",
	},
	{
		color: "#4a90e2", label: "Bus Stop",
		path: "M2 3C2 1.9 2.9 1 4 1L11 1C12.1 1 13 1.9 13 3L13 11C13 12 12 12 12 12L12 13C12 13 12 14 11 14C10 14 10 13 10 13L10 12L5 12L5 13C5 13 5 14 4 14C3 14 3 13 3 13L3 12C2 12 2 11 2 11L2 7.2L2 3ZM3.5 4C3.22 4 3 4.22 3 4.5L3 7.5C3 7.78 3.22 8 3.5 8L11.5 8C11.78 8 12 7.78 12 7.5L12 4.5C12 4.22 11.78 4 11.5 4L3.5 4ZM4 9C3.45 9 3 9.45 3 10C3 10.55 3.45 11 4 11C4.55 11 5 10.55 5 10C5 9.45 4.55 9 4 9ZM11 9C10.45 9 10 9.45 10 10C10 10.55 10.45 11 11 11C11.55 11 12 10.55 12 10C12 9.45 11.55 9 11 9ZM4 2.5C4 2.78 4.22 3 4.5 3L10.5 3C10.78 3 11 2.78 11 2.5C11 2.22 10.78 2 10.5 2L4.5 2C4.22 2 4 2.22 4 2.5Z",
	},
	{
		color: "#888888", label: "Gate",
		path: "M1.5 9.63L11.77 4.5L1.5 4.5L1.5 9.63ZM13.5 5.37L3.23 10.5L13.5 10.5L13.5 5.37ZM1 3L14 3C14.55 3 15 3.45 15 4L15 11C15 11.55 14.55 12 14 12L1 12C0.45 12 0 11.55 0 11L0 4C0 3.45 0.45 3 1 3Z",
	},
	{
		color: "#666666", label: "Bollard",
		path: "M5 3.5C5 -0.5 10 -0.5 10 3.5C10 4 5 4 5 3.5zM5 4C5 3.5 5 13.5 5 14C5 14.5 10 14.5 10 14C10 13.5 10 3.5 10 4C10 4.5 5 4.5 5 4z",
	},
	{
		color: "#ff9900", label: "Speed Bump",
		path: "M0 10L15 10L15 11L0 11L0 10ZM7.5 5C9.99 5 12 7.01 12 9.5L3 9.5C3 7.01 5.01 5 7.5 5Z",
	},
	{ color: "#cccccc", label: "Node (other)" },
]

const ROAD_LEGEND = [
	{ color: "#e892a2", label: "Motorway" },
	{ color: "#f9b29c", label: "Trunk" },
	{ color: "#fcd6a4", label: "Primary" },
	{ color: "#f7fabf", label: "Secondary" },
	{ color: "#ffffff", label: "Tertiary / Residential", border: true },
	{ color: "#ededed", label: "Living Street" },
	{ color: "#ffffff", label: "Service", thin: true, border: true },
	{ color: "#ff6666", label: "Footway / Steps", dashed: true },
	{ color: "#5555ff", label: "Cycleway", dashed: true },
	{ color: "#776a6a", label: "Path", dashed: true },
	{ color: "#996633", label: "Track", dashed: true },
]

export function MapLegend() {
	const open = useUIStore((s) => s.legendOpen)
	const setOpen = useUIStore((s) => s.setLegendOpen)

	return (
		<div className="absolute bottom-6 left-6 z-20">
			{open && (
				<div className="mb-2 w-52 rounded-lg bg-zinc-900/95 backdrop-blur border border-zinc-700 shadow-xl overflow-hidden">
					<div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
						<span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
							Legend
						</span>
						<button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-200">
							<ChevronDown className="h-4 w-4" />
						</button>
					</div>

					<div className="max-h-80 overflow-y-auto">
						{/* Roads */}
						<div className="px-3 pt-2 pb-1">
							<span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Roads</span>
						</div>
						<div className="px-3 pb-2 flex flex-col gap-1">
							{ROAD_LEGEND.map((item) => (
								<div key={item.label} className="flex items-center gap-2">
									<div className="w-6 flex items-center justify-center">
										<svg width="24" height="6" viewBox="0 0 24 6">
											<line
												x1="0" y1="3" x2="24" y2="3"
												stroke={item.color}
												strokeWidth={item.thin ? 1.5 : 3}
												strokeDasharray={item.dashed ? "4 3" : undefined}
												strokeLinecap="round"
											/>
											{item.border && (
												<line
													x1="0" y1="3" x2="24" y2="3"
													stroke="#999"
													strokeWidth={item.thin ? 2.5 : 4}
													strokeLinecap="round"
													opacity={0.3}
												/>
											)}
										</svg>
									</div>
									<span className="text-[11px] text-zinc-400">{item.label}</span>
								</div>
							))}
						</div>

						{/* Nodes */}
						<div className="px-3 pt-1 pb-1 border-t border-zinc-800">
							<span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Nodes</span>
						</div>
						<div className="px-3 pb-2 flex flex-col gap-1">
							{NODE_LEGEND.map((item) => (
								<div key={item.label} className="flex items-center gap-2">
									<div className="w-6 flex items-center justify-center">
										{item.path ? (
											<svg width="18" height="18" viewBox="0 0 18 18">
												<circle cx="9" cy="9" r="8" fill={item.color} stroke="#fff" strokeWidth="1" />
												<g transform="translate(2, 2) scale(0.933)">
													<path d={item.path} fill="#ffffff" />
												</g>
											</svg>
										) : (
											<svg width="14" height="14" viewBox="0 0 14 14">
												<circle cx="7" cy="7" r="5" fill={item.color} stroke="#fff" strokeWidth="1.5" />
											</svg>
										)}
									</div>
									<span className="text-[11px] text-zinc-400">{item.label}</span>
								</div>
							))}
						</div>

						{/* Arrows */}
						<div className="px-3 pt-1 pb-1 border-t border-zinc-800">
							<span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Direction</span>
						</div>
						<div className="px-3 pb-2 flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<div className="w-6 flex items-center justify-center">
									<svg width="14" height="10" viewBox="0 0 20 14">
										<polyline points="4,2 14,7 4,12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
								</div>
								<span className="text-[11px] text-zinc-400">Oneway (solid)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-6 flex items-center justify-center">
									<svg width="14" height="10" viewBox="0 0 20 14" opacity="0.3">
										<polyline points="4,2 14,7 4,12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
								</div>
								<span className="text-[11px] text-zinc-400">Way direction (faint)</span>
							</div>
						</div>
					</div>
				</div>
			)}

			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 rounded-lg bg-zinc-900/95 backdrop-blur border border-zinc-700 px-2.5 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shadow-lg transition-colors"
				title="Map legend"
			>
				<Info className="h-3.5 w-3.5" />
				<span className="text-[11px] font-medium">Legend</span>
				{open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
			</button>
		</div>
	)
}
