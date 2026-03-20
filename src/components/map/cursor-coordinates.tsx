import { useEffect, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'

/**
 * Displays current cursor coordinates at bottom-left of map
 */
export function CursorCoordinates() {
	const { current: map } = useMap()
	const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (!map) return

		let rafId: number | null = null
		let lastUpdate = 0

		const handleMouseMove = (e: MouseEvent) => {
			// Throttle to ~30fps untuk performance
			const now = performance.now()
			if (now - lastUpdate < 33) return // ~30fps
			lastUpdate = now

			if (rafId) cancelAnimationFrame(rafId)
			
			rafId = requestAnimationFrame(() => {
				// Convert screen pixel to lat/lon
				const point = { x: e.clientX, y: e.clientY }
				
				// Get map container bounds untuk calculate relative position
				const canvas = map.getCanvas()
				const rect = canvas.getBoundingClientRect()
				
				// Check if cursor is within map
				if (
					e.clientX < rect.left ||
					e.clientX > rect.right ||
					e.clientY < rect.top ||
					e.clientY > rect.bottom
				) {
					setVisible(false)
					return
				}

				// Calculate position relative to canvas
				const x = e.clientX - rect.left
				const y = e.clientY - rect.top

				try {
					const lngLat = map.unproject([x, y])
					setCoords({ lat: lngLat.lat, lon: lngLat.lng })
					setVisible(true)
				} catch {
					setVisible(false)
				}
			})
		}

		const handleMouseLeave = () => {
			setVisible(false)
		}

		const canvas = map.getCanvas()
		canvas.addEventListener('mousemove', handleMouseMove)
		canvas.addEventListener('mouseleave', handleMouseLeave)

		return () => {
			canvas.removeEventListener('mousemove', handleMouseMove)
			canvas.removeEventListener('mouseleave', handleMouseLeave)
			if (rafId) cancelAnimationFrame(rafId)
		}
	}, [map])

	if (!visible || !coords) return null

	return (
		<div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-zinc-900/90 backdrop-blur rounded-md border border-zinc-700 shadow-lg">
			<span className="text-xs font-mono text-zinc-300">
				{coords.lat.toFixed(5)}°, {coords.lon.toFixed(5)}°
			</span>
		</div>
	)
}
