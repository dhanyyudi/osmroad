import { useEffect, useState } from "react"
import { Info, X, Zap } from "lucide-react"
import { checkBrowserSupport, getSupportDescription } from "../lib/browser-support"

/**
 * Browser support indicator
 * Shows info about feature availability based on browser capabilities
 */
export function BrowserWarning() {
	const [showInfo, setShowInfo] = useState(false)
	const [supportMode, setSupportMode] = useState<"full" | "limited" | "unsupported">("full")
	const [description, setDescription] = useState("")

	useEffect(() => {
		const support = checkBrowserSupport()
		setSupportMode(support.mode)
		setDescription(getSupportDescription())

		// Show info for limited mode (Safari) or unsupported
		if (support.mode !== "full") {
			setShowInfo(true)
		}
	}, [])

	if (!showInfo) return null

	// Unsupported - show blocking warning
	if (supportMode === "unsupported") {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
				<div className="w-full max-w-md rounded-lg border border-red-500/50 bg-zinc-900 p-6 shadow-2xl">
					<div className="mb-4 flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
							<span className="text-xl">❌</span>
						</div>
						<h2 className="text-lg font-semibold text-zinc-100">Browser Not Supported</h2>
					</div>

					<p className="mb-4 text-sm text-zinc-400">{description}</p>

					<div className="mb-4 rounded-md bg-zinc-800/50 p-3 text-xs text-zinc-500">
						<p className="mb-2 font-medium text-zinc-400">Please use one of these browsers:</p>
						<ul className="list-disc space-y-1 pl-4">
							<li>Chrome 92+</li>
							<li>Firefox 90+</li>
							<li>Brave</li>
							<li>Edge 92+</li>
						</ul>
					</div>
				</div>
			</div>
		)
	}

	// Limited mode (Safari) - show dismissible info
	return (
		<div className="fixed bottom-4 right-4 z-50 max-w-sm">
			<div className="rounded-lg border border-amber-500/30 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
				<div className="mb-3 flex items-start gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
						<Info className="h-4 w-4 text-amber-500" />
					</div>
					<div className="flex-1">
						<h3 className="text-sm font-semibold text-zinc-200">Limited Mode</h3>
						<p className="mt-1 text-xs text-zinc-400">{description}</p>
					</div>
					<button
						onClick={() => setShowInfo(false)}
						className="text-zinc-500 hover:text-zinc-300"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="mb-3 rounded-md bg-zinc-800/50 p-2 text-[10px] text-zinc-500">
					<p className="mb-1 font-medium text-zinc-400">Available features:</p>
					<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
						<span className="text-green-400/80">✓ PBF loading</span>
						<span className="text-green-400/80">✓ Road visualization</span>
						<span className="text-green-400/80">✓ Routing</span>
						<span className="text-green-400/80">✓ Overpass download</span>
						<span className="text-red-400/80">✗ SQL queries</span>
						<span className="text-red-400/80">✗ CSV overlays</span>
					</div>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-[10px] text-zinc-600">For full features, use Chrome/Brave</span>
					<button
						onClick={() => setShowInfo(false)}
						className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/30"
					>
						<Zap className="h-3 w-3" />
						Continue
					</button>
				</div>
			</div>
		</div>
	)
}
