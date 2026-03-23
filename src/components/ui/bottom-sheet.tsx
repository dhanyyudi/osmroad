import { useState, useRef, type ReactNode, type TouchEvent } from "react"
import { X } from "lucide-react"

interface BottomSheetProps {
	isOpen: boolean
	onClose: () => void
	children: ReactNode
	title?: string
	snapPoints?: number[] // Percentage of screen height (0-100)
	initialSnap?: number
}

export function BottomSheet({
	isOpen,
	onClose,
	children,
	title,
	snapPoints = [25, 50, 85],
	initialSnap = 0,
}: BottomSheetProps) {
	const [currentSnap, setCurrentSnap] = useState(initialSnap)
	const [isDragging, setIsDragging] = useState(false)
	const [translateY, setTranslateY] = useState(0)
	const startYRef = useRef(0)
	const currentYRef = useRef(0)
	const sheetRef = useRef<HTMLDivElement>(null)

	// Reset when opened
	const resetState = () => {
		setCurrentSnap(initialSnap)
		setTranslateY(0)
	}

	// Use effect-like pattern for isOpen change
	if (isOpen && translateY !== 0 && !isDragging) {
		resetState()
	}

	// Close on backdrop click
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}

	// Touch handlers for drag
	const handleTouchStart = (e: TouchEvent) => {
		const touch = e.touches[0]
		if (!touch) return
		
		setIsDragging(true)
		startYRef.current = touch.clientY
		currentYRef.current = translateY
	}

	const handleTouchMove = (e: TouchEvent) => {
		if (!isDragging) return
		
		const touch = e.touches[0]
		if (!touch) return
		
		const deltaY = touch.clientY - startYRef.current
		const newTranslateY = Math.max(0, currentYRef.current + deltaY)
		setTranslateY(newTranslateY)
	}

	const handleTouchEnd = () => {
		if (!isDragging) return
		setIsDragging(false)

		const windowHeight = window.innerHeight
		const currentHeight = windowHeight - translateY
		const currentPercent = (currentHeight / windowHeight) * 100

		// Find nearest snap point
		let nearestSnap = snapPoints[0]!
		let minDiff = Math.abs(currentPercent - snapPoints[0]!)

		for (const point of snapPoints) {
			const diff = Math.abs(currentPercent - point)
			if (diff < minDiff) {
				minDiff = diff
				nearestSnap = point
			}
		}

		// Close if dragged down past threshold
		if (currentPercent < snapPoints[0]! / 2) {
			onClose()
			return
		}

		const snapIndex = snapPoints.indexOf(nearestSnap)
		setCurrentSnap(snapIndex >= 0 ? snapIndex : 0)
		setTranslateY(0)
	}

	// Calculate height based on snap point
	const getSheetHeight = () => {
		if (isDragging) {
			return `calc(100% - ${translateY}px)`
		}
		return `${snapPoints[currentSnap]}%`
	}

	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 z-50 bg-black/50 transition-opacity"
			onClick={handleBackdropClick}
		>
			<div
				ref={sheetRef}
				className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out"
				style={{ 
					height: getSheetHeight(),
					touchAction: "none",
				}}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				{/* Drag Handle */}
				<div className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
					<div className="w-10 h-1 bg-zinc-600 rounded-full" />
				</div>

				{/* Header */}
				{(title || onClose) && (
					<div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
						{title && (
							<h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
						)}
						<button
							onClick={onClose}
							className="p-1.5 rounded-full hover:bg-zinc-800 transition-colors"
						>
							<X className="h-4 w-4 text-zinc-400" />
						</button>
					</div>
				)}

				{/* Content */}
				<div className="overflow-y-auto h-[calc(100%-48px)]">
					{children}
				</div>

				{/* Snap Point Indicators */}
				<div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
					{snapPoints.map((_, index) => (
						<div
							key={index}
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								index === currentSnap ? "bg-blue-500" : "bg-zinc-600"
							}`}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
