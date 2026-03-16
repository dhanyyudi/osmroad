interface ProgressBarProps {
	progress: number // 0-1
	label?: string
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
	const pct = Math.round(progress * 100)
	return (
		<div className="w-full">
			{label && (
				<div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
					<span>{label}</span>
					<span>{pct}%</span>
				</div>
			)}
			<div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
				<div
					className="h-full rounded-full bg-blue-500 transition-all duration-200"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	)
}
