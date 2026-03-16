/**
 * Node icon rendering using Temaki/Maki SVG path data.
 *
 * Icons are drawn via Path2D onto a Canvas, producing SDF-compatible images
 * that MapLibre can recolor via `icon-color`. All paths are from the
 * Temaki (CC0/ISC) and Maki (CC0) icon sets on a 15×15 viewBox.
 *
 * @see https://github.com/ideditor/temaki
 * @see https://github.com/mapbox/maki
 */

interface SdfImage {
	width: number
	height: number
	data: Uint8Array
}

// ---------------------------------------------------------------------------
// Temaki / Maki SVG path data (15×15 viewBox)
// ---------------------------------------------------------------------------

const ICON_PATHS = {
	// Highway nodes
	traffic_signals:
		"M9.21 0C10.48 0 11.5 1.03 11.5 2.31L11.5 12.69C11.5 13.97 10.48 15 9.21 15L5.79 15C4.52 15 3.5 13.97 3.5 12.69L3.5 2.31C3.5 1.03 4.52 0 5.79 0L9.21 0zM7.5 10.5C6.67 10.5 6 11.17 6 12C6 12.83 6.67 13.5 7.5 13.5C8.33 13.5 9 12.83 9 12C9 11.17 8.33 10.5 7.5 10.5zM7.5 6C6.67 6 6 6.67 6 7.5C6 8.33 6.67 9 7.5 9C8.33 9 9 8.33 9 7.5C9 6.67 8.33 6 7.5 6zM7.5 1.5C6.67 1.5 6 2.17 6 3C6 3.83 6.67 4.5 7.5 4.5C8.33 4.5 9 3.83 9 3C9 2.17 8.33 1.5 7.5 1.5z",
	stop:
		"M10.5 0C10.5 0 15 4.5 15 4.5C15 4.5 15 10.5 15 10.5C15 10.5 10.5 15 10.5 15C10.5 15 4.5 15 4.5 15C4.5 15 0 10.5 0 10.5L0 4.5C0 4.5 4.5 0 4.5 0L10.5 0z",
	give_way:
		"M14.5 1.5L7.5 14L0.5 1.5L14.5 1.5zM11.25 3.5L3.75 3.5L7.5 10.25L11.25 3.5z",
	crossing:
		"M9.38 1.96C9.38 2.76 8.68 3.42 7.81 3.42C6.95 3.42 6.25 2.76 6.25 1.96C6.25 1.15 6.95 0.5 7.81 0.5C8.68 0.5 9.38 1.15 9.38 1.96zM6.25 4L6.88 4L7.19 4L12.5 7.79L12.5 8.67L11.88 8.67L8.75 6.41L8.75 8.67L10 11L11.25 13.92L10.63 14.5L10 14.5L8.75 11.58L6.25 8.08L6.25 5.37L4.69 6.63L3.44 8.67L2.5 8.67L2.5 8.08L3.44 6.33L6.25 4zM6.78 10.07L5.33 14.5L4.69 14.5L4.06 13.92L5.82 8.99z",
	bus_stop:
		"M2 3C2 1.9 2.9 1 4 1L11 1C12.1 1 13 1.9 13 3L13 11C13 12 12 12 12 12L12 13C12 13 12 14 11 14C10 14 10 13 10 13L10 12L5 12L5 13C5 13 5 14 4 14C3 14 3 13 3 13L3 12C2 12 2 11 2 11L2 7.2L2 3ZM3.5 4C3.22 4 3 4.22 3 4.5L3 7.5C3 7.78 3.22 8 3.5 8L11.5 8C11.78 8 12 7.78 12 7.5L12 4.5C12 4.22 11.78 4 11.5 4L3.5 4ZM4 9C3.45 9 3 9.45 3 10C3 10.55 3.45 11 4 11C4.55 11 5 10.55 5 10C5 9.45 4.55 9 4 9ZM11 9C10.45 9 10 9.45 10 10C10 10.55 10.45 11 11 11C11.55 11 12 10.55 12 10C12 9.45 11.55 9 11 9ZM4 2.5C4 2.78 4.22 3 4.5 3L10.5 3C10.78 3 11 2.78 11 2.5C11 2.22 10.78 2 10.5 2L4.5 2C4.22 2 4 2.22 4 2.5Z",
	speed_bump:
		"M0 10L15 10L15 11L0 11L0 10ZM7.5 5C9.99 5 12 7.01 12 9.5L3 9.5C3 7.01 5.01 5 7.5 5Z",

	// Barrier nodes
	gate:
		"M1.5 9.63L11.77 4.5L1.5 4.5L1.5 9.63ZM13.5 5.37L3.23 10.5L13.5 10.5L13.5 5.37ZM1 3L14 3C14.55 3 15 3.45 15 4L15 11C15 11.55 14.55 12 14 12L1 12C0.45 12 0 11.55 0 11L0 4C0 3.45 0.45 3 1 3Z",
	bollard:
		"M5 3.5C5 -0.5 10 -0.5 10 3.5C10 4 5 4 5 3.5zM5 4C5 3.5 5 13.5 5 14C5 14.5 10 14.5 10 14C10 13.5 10 3.5 10 4C10 4.5 5 4.5 5 4z",
	lift_gate:
		"M4.34 6.15L12.39 1.5L13.89 4.1L6 8.65L6 14L1 14L1 8.5C1 7.12 2.12 6 3.5 6C3.8 6 4.08 6.05 4.34 6.15L4.34 6.15ZM5.29 6.76C5.52 6.99 5.71 7.28 5.83 7.6L7.33 6.73L6.83 5.87L5.29 6.76L5.29 6.76ZM8.2 6.23L9.93 5.23L9.43 4.37L7.7 5.37L8.2 6.23ZM10.79 4.73L12.53 3.73L12.03 2.87L10.29 3.87L10.79 4.73ZM3.5 9.5C4.05 9.5 4.5 9.05 4.5 8.5C4.5 7.95 4.05 7.5 3.5 7.5C2.95 7.5 2.5 7.95 2.5 8.5C2.5 9.05 2.95 9.5 3.5 9.5Z",
} as const

// ---------------------------------------------------------------------------
// Renderer — SVG path → Canvas → SDF image
// ---------------------------------------------------------------------------

/**
 * Render an SVG path string to an SDF-compatible image.
 * Uses Path2D for hardware-accelerated vector drawing.
 */
function renderSvgPathToSdf(
	pathData: string,
	size = 24,
	padding = 2,
): SdfImage {
	const canvas = document.createElement("canvas")
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext("2d")!

	ctx.clearRect(0, 0, size, size)

	// Scale from 15×15 viewBox to target size with padding
	const scale = (size - padding * 2) / 15
	ctx.save()
	ctx.translate(padding, padding)
	ctx.scale(scale, scale)

	// SDF: draw white on transparent
	ctx.fillStyle = "#ffffff"
	ctx.fill(new Path2D(pathData))

	ctx.restore()

	const imageData = ctx.getImageData(0, 0, size, size)
	return {
		width: size,
		height: size,
		data: new Uint8Array(imageData.data.buffer),
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All icon names that can be registered. */
export const NODE_ICON_NAMES = Object.keys(ICON_PATHS) as (keyof typeof ICON_PATHS)[]

/** MapLibre image ID for a given icon name. */
export function nodeIconId(name: string): string {
	return `node-icon-${name}`
}

/**
 * Register all node icons on a MapLibre map instance.
 * Safe to call multiple times — skips already-registered images.
 */
export function registerNodeIcons(map: maplibregl.Map, size = 24): void {
	for (const [name, pathData] of Object.entries(ICON_PATHS)) {
		const id = nodeIconId(name)
		if (map.hasImage(id)) continue
		const img = renderSvgPathToSdf(pathData, size)
		map.addImage(id, img, { sdf: true })
	}
}
