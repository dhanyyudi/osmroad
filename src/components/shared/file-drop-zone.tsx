import { useCallback, useState, type DragEvent } from "react"
import { Upload } from "lucide-react"

interface FileDropZoneProps {
	accept: string
	label: string
	onFile: (file: File) => void
	disabled?: boolean
}

export function FileDropZone({
	accept,
	label,
	onFile,
	disabled,
}: FileDropZoneProps) {
	const [dragOver, setDragOver] = useState(false)

	const handleDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault()
			setDragOver(false)
			const file = e.dataTransfer.files[0]
			if (file) onFile(file)
		},
		[onFile],
	)

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault()
		setDragOver(true)
	}, [])

	const handleDragLeave = useCallback(() => {
		setDragOver(false)
	}, [])

	return (
		<label
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
				dragOver
					? "border-blue-400 bg-blue-400/10"
					: "border-zinc-600 hover:border-zinc-400"
			} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
		>
			<Upload className="h-6 w-6 text-zinc-400" />
			<span className="text-sm text-zinc-400">{label}</span>
			<input
				type="file"
				accept={accept}
				className="hidden"
				disabled={disabled}
				onChange={(e) => {
					const file = e.target.files?.[0]
					if (file) onFile(file)
				}}
			/>
		</label>
	)
}
