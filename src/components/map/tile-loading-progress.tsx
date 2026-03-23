import { useTileLoading } from "../../hooks/use-tile-loading"

export function TileLoadingProgress() {
	const { isLoading, loaded, total, progress } = useTileLoading()

	if (!isLoading) return null

	const percent = Math.round(progress)

	return (
		<div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-64">
			<div className="rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-xl">
				<div className="mb-1.5 flex items-center justify-between text-xs">
					<span className="font-medium text-zinc-300">Loading map tiles...</span>
					<span className="text-zinc-500">{loaded}/{total}</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
					<div
						className="h-full rounded-full bg-blue-500 transition-all duration-200"
						style={{ width: `${percent}%` }}
					/>
				</div>
				<div className="mt-1 text-right text-[10px] text-zinc-500">{percent}%</div>
			</div>
		</div>
	)
}
