import { useState, useEffect } from "react"
import { RotateCcw, Download, X, Database } from "lucide-react"
import type { CachedDataset } from "../../lib/storage"
import { formatBytes, formatRelativeTime } from "../../lib/storage"

interface ReloadDialogProps {
	cachedDataset: CachedDataset | null
	isOpen: boolean
	onClose: () => void
	onReload: () => void
	onLoadNew: () => void
}

export function ReloadDialog({
	cachedDataset,
	isOpen,
	onClose,
	onReload,
	onLoadNew,
}: ReloadDialogProps) {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		if (isOpen) {
			// Small delay for animation
			setTimeout(() => setIsVisible(true), 10)
		} else {
			setIsVisible(false)
		}
	}, [isOpen])

	if (!isOpen || !cachedDataset) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
			<div
				className={`w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl transform transition-all duration-300 ${
					isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
				}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-zinc-800">
					<div className="flex items-center gap-2">
						<Database className="h-5 w-5 text-blue-400" />
						<h3 className="text-sm font-semibold text-zinc-200">Cached Data Available</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-full hover:bg-zinc-800 transition-colors"
					>
						<X className="h-4 w-4 text-zinc-400" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4">
					<p className="text-xs text-zinc-400 mb-4">
						You previously loaded this dataset. Would you like to reload from cache or load new data?
					</p>

					{/* Dataset Info Card */}
					<div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 mb-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
								<Database className="h-5 w-5 text-blue-400" />
							</div>
							<div className="flex-1 min-w-0">
								<h4 className="text-sm font-medium text-zinc-200 truncate">
									{cachedDataset.fileName}
								</h4>
								<div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
									<span>{formatBytes(cachedDataset.fileSize)}</span>
									<span className="text-zinc-600">•</span>
									<span>{formatRelativeTime(cachedDataset.cachedAt)}</span>
								</div>
							</div>
						</div>

						{/* Stats */}
						<div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-700/50">
							<div className="text-center">
								<div className="text-xs font-medium text-zinc-300">
									{cachedDataset.stats.nodes.toLocaleString()}
								</div>
								<div className="text-[10px] text-zinc-500">Nodes</div>
							</div>
							<div className="text-center border-x border-zinc-700/50">
								<div className="text-xs font-medium text-zinc-300">
									{cachedDataset.stats.ways.toLocaleString()}
								</div>
								<div className="text-[10px] text-zinc-500">Ways</div>
							</div>
							<div className="text-center">
								<div className="text-xs font-medium text-zinc-300">
									{cachedDataset.stats.relations.toLocaleString()}
								</div>
								<div className="text-[10px] text-zinc-500">Relations</div>
							</div>
						</div>
					</div>

					{/* Options */}
					<div className="space-y-2">
						<button
							onClick={onReload}
							className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
						>
							<RotateCcw className="h-4 w-4" />
							Reload from Cache
						</button>
						
						<button
							onClick={onLoadNew}
							className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors border border-zinc-700"
						>
							<Download className="h-4 w-4" />
							Load New Data
						</button>
						
						<button
							onClick={onClose}
							className="w-full p-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
						>
							Cancel
						</button>
					</div>

					{/* Tip */}
					<p className="mt-4 text-[10px] text-zinc-600 text-center">
						Tip: Use Shift+Reload to bypass cache and load fresh data
					</p>
				</div>
			</div>
		</div>
	)
}
