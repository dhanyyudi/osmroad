import { useState, useRef, type ReactNode, type TouchEvent } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"

interface BottomPanelProps {
	isOpen: boolean
	onClose: () => void
	children: ReactNode
	title?: string
	subtitle?: string
}

export function BottomPanel({ 
	isOpen, 
	onClose, 
	children, 
	title,
	subtitle 
}: BottomPanelProps) {
	const [height, setHeight] = useState(40) // percentage
	const [isDragging, setIsDragging] = useState(false)
	const startYRef = useRef(0)
	const startHeightRef = useRef(0)

	const handleTouchStart = (e: TouchEvent) => {
		setIsDragging(true)
		startYRef.current = e.touches[0].clientY
		startHeightRef.current = height
	}

	const handleTouchMove = (e: TouchEvent) => {
		if (!isDragging) return
		
		const touch = e.touches[0]
		if (!touch) return
		
		const deltaY = startYRef.current - touch.clientY
		const windowHeight = window.innerHeight
		const deltaPercent = (deltaY / windowHeight) * 100
		
		setHeight(Math.max(25, Math.min(90, startHeightRef.current + deltaPercent)))
	}

	const handleTouchEnd = () => {
		setIsDragging(false)
		
		// Snap to nearest breakpoint
		if (height < 30) {
			onClose()
		} else if (height < 55) {
			setHeight(40)
		} else {
			setHeight(75)
		}
	}

	const toggleHeight = () => {
		if (height < 50) {
			setHeight(75)
		} else {
			setHeight(40)
		}
	}

	if (!isOpen) return null

	return (
		<div 
			className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 rounded-t-2xl shadow-2xl border-t border-zinc-800"
			style={{ 
				height: `${height}%`,
				transition: isDragging ? undefined : "height 0.2s ease-out"
			}}
		>
			{/* Drag Handle */}
			<div 
				className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onClick={toggleHeight}
			>
				<div className="w-10 h-1 bg-zinc-600 rounded-full" />
			</div>

			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
				<div className="flex-1 min-w-0">
					{title && (
						<h3 className="text-sm font-semibold text-zinc-200 truncate">{title}</h3>
					)}
					{subtitle && (
						<p className="text-xs text-zinc-500 truncate">{subtitle}</p>
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={toggleHeight}
						className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
					>
						{height > 50 ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</button>
					<button
						onClick={onClose}
						className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="overflow-y-auto h-[calc(100%-80px)] p-4">
				{children}
			</div>
		</div>
	)
}
