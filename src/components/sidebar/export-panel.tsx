import { useCallback, useState } from "react"
import { useOsmStore } from "../../stores/osm-store"
import { useOsm } from "../../hooks/use-osm"
import { Download, FileText } from "lucide-react"

export function ExportPanel() {
	const { remote } = useOsm()
	const dataset = useOsmStore((s) => s.dataset)
	const [exporting, setExporting] = useState(false)

	const exportPbf = useCallback(async () => {
		if (!remote || !dataset) return
		setExporting(true)
		try {
			const data = await remote.toPbfData(dataset.osmId)
			const blob = new Blob([new Uint8Array(data)], { type: "application/octet-stream" })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = dataset.fileName.replace(/\.(?:osm\.)?pbf$/, "-modified.osm.pbf")
			a.click()
			URL.revokeObjectURL(url)
		} catch (err) {
			console.error("Export failed:", err)
		} finally {
			setExporting(false)
		}
	}, [remote, dataset])

	if (!dataset) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500">
				<FileText className="h-8 w-8" />
				<span className="text-sm">Load a PBF file first</span>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 p-4">
			<h2 className="text-sm font-semibold text-zinc-300">Export</h2>

			<button
				onClick={exportPbf}
				disabled={exporting}
				className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
			>
				<Download className="h-4 w-4" />
				{exporting ? "Exporting..." : "Download PBF"}
			</button>
		</div>
	)
}
