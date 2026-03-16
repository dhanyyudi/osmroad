/**
 * Speed-based color ramp: green (fast) → yellow → red (slow)
 */
export function speedToColor(
	speed: number,
	minSpeed: number,
	maxSpeed: number,
): string {
	const range = maxSpeed - minSpeed
	if (range === 0) return "#00ff00"

	const normalized = Math.max(0, Math.min(1, (speed - minSpeed) / range))

	// Green (fast) → Yellow (medium) → Red (slow)
	// normalized: 0 = slow (red), 1 = fast (green)
	const r = normalized < 0.5 ? 255 : Math.round(255 * (1 - normalized) * 2)
	const g = normalized > 0.5 ? 255 : Math.round(255 * normalized * 2)

	return `rgb(${r}, ${g}, 0)`
}

/**
 * Create a fixed set of color stops for the speed legend.
 */
export function speedColorStops(
	minSpeed: number,
	maxSpeed: number,
	steps = 5,
): Array<{ speed: number; color: string }> {
	const result: Array<{ speed: number; color: string }> = []
	for (let i = 0; i < steps; i++) {
		const speed = minSpeed + ((maxSpeed - minSpeed) * i) / (steps - 1)
		result.push({ speed, color: speedToColor(speed, minSpeed, maxSpeed) })
	}
	return result
}
