import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"

/**
 * Detect browser support for required features
 * SharedArrayBuffer is required for osmix/DuckDB-wasm
 */
function checkBrowserSupport() {
	// Check SharedArrayBuffer support
	if (typeof SharedArrayBuffer === "undefined") {
		return {
			supported: false,
			reason: "SharedArrayBuffer",
			message: "Your browser doesn't support SharedArrayBuffer, which is required for this app.",
		}
	}

	// Check Web Worker support
	if (typeof Worker === "undefined") {
		return {
			supported: false,
			reason: "Web Workers",
			message: "Your browser doesn't support Web Workers, which are required for this app.",
		}
	}

	return { supported: true }
}

export function BrowserWarning() {
	const [showWarning, setShowWarning] = useState(false)
	const [warningMessage, setWarningMessage] = useState("")

	useEffect(() => {
		const support = checkBrowserSupport()
		if (!support.supported && support.message) {
			setWarningMessage(support.message)
			setShowWarning(true)
		}
	}, [])

	if (!showWarning) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<div className="w-full max-w-md rounded-lg border border-amber-500/50 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-4 flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
					</div>
					<h2 className="text-lg font-semibold text-zinc-100">Browser Not Supported</h2>
				</div>

				<p className="mb-4 text-sm text-zinc-400">{warningMessage}</p>

				<div className="mb-4 rounded-md bg-zinc-800/50 p-3 text-xs text-zinc-500">
					<p className="mb-2 font-medium text-zinc-400">Recommended browsers:</p>
					<ul className="list-disc space-y-1 pl-4">
						<li>Chrome 92+</li>
						<li>Firefox 90+</li>
						<li>Brave</li>
						<li>Edge 92+</li>
					</ul>
					<p className="mt-2 text-amber-500/80">Note: Safari currently has limited support.</p>
				</div>

				<div className="flex justify-end">
					<button
						onClick={() => setShowWarning(false)}
						className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
					>
						<X className="h-4 w-4" />
						Dismiss
					</button>
				</div>
			</div>
		</div>
	)
}
