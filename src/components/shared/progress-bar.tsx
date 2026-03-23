import type { ExtendedProgress, LoadingStage } from "../../stores/osm-store"

interface ProgressBarProps {
	progress: ExtendedProgress | null
}

const STAGE_CONFIG: Record<LoadingStage, { label: string; color: string; icon: string }> = {
	downloading: { label: "Downloading", color: "bg-blue-500", icon: "⬇️" },
	parsing: { label: "Parsing Data", color: "bg-amber-500", icon: "📊" },
	indexing: { label: "Building Index", color: "bg-purple-500", icon: "🔍" },
	"building-tiles": { label: "Generating Tiles", color: "bg-green-500", icon: "🗺️" },
	complete: { label: "Complete", color: "bg-emerald-500", icon: "✅" },
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatETA(seconds: number): string {
	if (seconds < 60) return `${Math.ceil(seconds)}s`
	if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
	return `${Math.ceil(seconds / 3600)}h`
}

export function ProgressBar({ progress }: ProgressBarProps) {
	if (!progress) return null

	const stage = progress.stage || "parsing"
	const percent = progress.percent ?? 0
	const stageConfig = STAGE_CONFIG[stage]
	
	// Calculate progress bar segments for multi-stage visualization
	const stages: LoadingStage[] = ["downloading", "parsing", "indexing", "building-tiles", "complete"]
	const currentStageIndex = stages.indexOf(stage)
	const totalStages = stages.length - 1 // Exclude 'complete'
	
	// Overall progress based on stage + current stage progress
	const stageWeight = 100 / totalStages
	const overallPercent = stage === "complete" 
		? 100 
		: Math.min(99, (currentStageIndex * stageWeight) + (percent * stageWeight / 100))

	return (
		<div className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
			{/* Stage Header */}
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-sm">{stageConfig.icon}</span>
					<span className="text-xs font-medium text-zinc-300">
						{stageConfig.label}
					</span>
				</div>
				<span className="text-xs font-semibold text-zinc-400">
					{Math.round(overallPercent)}%
				</span>
			</div>

			{/* Main Progress Bar */}
			<div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-700">
				<div
					className={`h-full rounded-full transition-all duration-300 ${stageConfig.color}`}
					style={{ width: `${overallPercent}%` }}
				/>
			</div>

			{/* Stage Indicators */}
			<div className="mt-3 flex items-center justify-between">
				{stages.slice(0, -1).map((s, idx) => {
					const isActive = idx === currentStageIndex
					const isCompleted = idx < currentStageIndex
					
					return (
						<div key={s} className="flex flex-col items-center gap-1">
							<div 
								className={`h-1.5 w-1.5 rounded-full transition-colors ${
									isCompleted 
										? "bg-emerald-500" 
										: isActive 
											? stageConfig.color.replace("bg-", "bg-") 
											: "bg-zinc-600"
								}`}
							/>
						</div>
					)
				})}
			</div>

			{/* Progress Details */}
			<div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
				<span className="truncate">
					{progress.msg || "Processing..."}
				</span>
				{(progress.bytesTotal && progress.bytesTotal > 0) && (
					<span className="shrink-0 ml-2">
						{formatBytes(progress.bytesLoaded || 0)} / {formatBytes(progress.bytesTotal)}
					</span>
				)}
			</div>

			{/* ETA Display */}
			{progress.etaSeconds && progress.etaSeconds > 0 && (
				<div className="mt-1 text-[10px] text-zinc-600">
					ETA: ~{formatETA(progress.etaSeconds)} remaining
				</div>
			)}
		</div>
	)
}
