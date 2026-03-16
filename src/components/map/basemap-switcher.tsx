import { useState } from "react"
import { Map as MapIcon, ChevronDown } from "lucide-react"
import { useUIStore } from "../../stores/ui-store"
import { BASEMAP_OPTIONS } from "../../constants"

/** Inline color swatches for each basemap preview */
const BASEMAP_PREVIEWS: Record<string, { bg: string; fg: string; lines?: string }> = {
	"dark-matter":   { bg: "#1a1a2e", fg: "#444466", lines: "#555577" },
	"positron":      { bg: "#f2f2f2", fg: "#cccccc", lines: "#aaaaaa" },
	"voyager":       { bg: "#f0ede6", fg: "#d4cfc4", lines: "#b8b1a4" },
	"osm-standard":  { bg: "#eae5c9", fg: "#aad3df", lines: "#f0d9a8" },
	"dark":          { bg: "#0e0e1a", fg: "#222233", lines: "#333355" },
	"light":         { bg: "#fafafa", fg: "#e8e8e8", lines: "#d0d0d0" },
	"no-basemap":    { bg: "#0a0a0f", fg: "#0a0a0f" },
}

function BasemapPreview({ id }: { id: string }) {
	const p = BASEMAP_PREVIEWS[id] ?? { bg: "#333", fg: "#555" }
	return (
		<svg viewBox="0 0 48 48" className="w-full h-full">
			<rect width="48" height="48" fill={p.bg} />
			<rect x="4" y="6" width="14" height="10" rx="1" fill={p.fg} opacity={0.6} />
			<rect x="22" y="4" width="22" height="14" rx="1" fill={p.fg} opacity={0.5} />
			<rect x="6" y="30" width="18" height="14" rx="1" fill={p.fg} opacity={0.5} />
			<rect x="30" y="26" width="14" height="18" rx="1" fill={p.fg} opacity={0.6} />
			{p.lines && (
				<>
					<line x1="0" y1="20" x2="48" y2="22" stroke={p.lines} strokeWidth="3" opacity={0.8} />
					<line x1="20" y1="0" x2="18" y2="48" stroke={p.lines} strokeWidth="2" opacity={0.7} />
					<line x1="36" y1="0" x2="40" y2="48" stroke={p.lines} strokeWidth="2" opacity={0.5} />
				</>
			)}
		</svg>
	)
}

export function BasemapSwitcher() {
	const [open, setOpen] = useState(false)
	const basemapId = useUIStore((s) => s.basemapId)
	const setBasemapId = useUIStore((s) => s.setBasemapId)

	const current = BASEMAP_OPTIONS.find((b) => b.id === basemapId)

	return (
		<div className="absolute top-16 right-3 z-10 w-96">
			{/* Toggle button */}
			<button
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-2 rounded-lg bg-zinc-900/95 backdrop-blur border border-zinc-700 px-3 py-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 shadow-lg transition-colors"
				title="Change basemap style"
			>
				<MapIcon className="h-4 w-4 shrink-0" />
				<span className="text-xs font-medium flex-1 text-left">
					Basemap: {current?.label ?? "—"}
				</span>
				<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{/* Expanded panel */}
			{open && (
				<div className="mt-1 w-full rounded-lg bg-zinc-900/95 backdrop-blur border border-zinc-700 shadow-xl overflow-hidden">
					<div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
						<span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
							Base Map Style
						</span>
						<button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-200">
							<ChevronDown className="h-4 w-4 rotate-180" />
						</button>
					</div>
					<div className="p-2 grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
						{BASEMAP_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								onClick={() => {
									setBasemapId(opt.id)
									setOpen(false)
								}}
								className={`flex flex-col items-center gap-1 rounded-md p-1.5 transition-all ${
									basemapId === opt.id
										? "ring-2 ring-blue-500 bg-zinc-800"
										: "hover:bg-zinc-800 opacity-80 hover:opacity-100"
								}`}
							>
								<div className="w-full aspect-square rounded overflow-hidden border border-zinc-700">
									<BasemapPreview id={opt.id} />
								</div>
								<span className="text-[10px] text-zinc-400 leading-tight text-center truncate w-full">
									{opt.label}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
