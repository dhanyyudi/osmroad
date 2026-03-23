import type { ExpressionSpecification } from "maplibre-gl"

/**
 * OSMRoad Colorblind-Friendly Highway Colors
 * 
 * Palette yang dirancang untuk accessibility:
 * - Menggunakan hue yang berbeda jauh (bukan red-green-orange yang mirip)
 * - Kontras brightness yang jelas
 * - Cocok untuk Deuteranopia (red-green color blindness)
 * 
 * Warna dipilih berdasarkan ColorBrewer dan research accessibility:
 * https://colorbrewer2.org/
 */

// Highlight color untuk AI Query results
const HIGHLIGHT_COLOR = "#fbbf24" // amber-400

// Colorblind-friendly palette - menggunakan warna dengan hue berbeda jauh
// Hindari kombinasi red-green, gunakan blue-purple-orange-cyan
export const roadColorExpression: ExpressionSpecification = [
	"case",
	// Jika highlighted (dari AI Query), gunakan warna kuning
	["boolean", ["feature-state", "highlighted"], false],
	HIGHLIGHT_COLOR,
	// Default colors - Colorblind-friendly palette
	[
		"match",
		["get", "highway"],
		// Motorway: Biru Tua (kontras tinggi, mudah dibedakan)
		"motorway", "#0055CC",      // Deep Blue
		"motorway_link", "#0055CC",
		// Trunk: Ungu/Magenta (kontras dengan biru)
		"trunk", "#8B008B",         // Dark Magenta
		"trunk_link", "#8B008B",
		// Primary: Oranye/Kuning (kontras dengan biru dan ungu)
		"primary", "#FF8C00",       // Dark Orange
		"primary_link", "#FF8C00",
		// Secondary: Hijau Tosca/Cyan (berbeda dengan yang lain)
		"secondary", "#008B8B",     // Dark Cyan
		"secondary_link", "#008B8B",
		// Tertiary: Pink/Rose
		"tertiary", "#C71585",      // Medium Violet Red
		"tertiary_link", "#C71585",
		// Minor roads - grayscale dengan perbedaan jelas
		"unclassified", "#6B7280",  // gray-500
		"residential", "#4B5563",   // gray-600 - lebih gelap
		"living_street", "#374151", // gray-700 - lebih gelap lagi
		"service", "#9CA3AF",       // gray-400 - lebih terang, beda jauh
		"pedestrian", "#D1D5DB",    // gray-300 - paling terang
		"road", "#9CA3AF",
		// Paths - warna yang berbeda
		"footway", "#4B0082",       // Indigo
		"sidewalk", "#4B0082",
		"cycleway", "#20B2AA",      // Light Sea Green
		"path", "#9370DB",          // Medium Purple
		"track", "#B8860B",         // Dark Goldenrod
		"steps", "#4B0082",
		"bridleway", "#B8860B",
		// Special
		"construction", "#FF6347",  // Tomato
		"proposed", "#94A3B8",      // gray-400
		"#9CA3AF", // default
	]
] as ExpressionSpecification

// Casing colors - darker variants
export const roadCasingColorExpression: ExpressionSpecification = [
	"case",
	["boolean", ["feature-state", "highlighted"], false],
	"#D97706", // amber-600
	[
		"match",
		["get", "highway"],
		"motorway", "#003380",      // Darker Blue
		"motorway_link", "#003380",
		"trunk", "#5C005C",         // Darker Magenta
		"trunk_link", "#5C005C",
		"primary", "#CC5500",       // Darker Orange
		"primary_link", "#CC5500",
		"secondary", "#006666",     // Darker Cyan
		"secondary_link", "#006666",
		"tertiary", "#8B0A50",      // Darker Violet Red
		"tertiary_link", "#8B0A50",
		"unclassified", "#374151",  // gray-700
		"residential", "#374151",
		"living_street", "#1F2937", // gray-800
		"service", "#4B5563",
		"pedestrian", "#9CA3AF",
		"footway", "#2E0052",       // Darker Indigo
		"sidewalk", "#2E0052",
		"cycleway", "#167A75",      // Darker Sea Green
		"path", "#6B4E9C",          // Darker Purple
		"track", "#8B6914",         // Darker Goldenrod
		"steps", "#2E0052",
		"bridleway", "#8B6914",
		"construction", "#CC4A33",
		"#6B7280", // default
	]
] as ExpressionSpecification

// Line widths - tetap sama tapi ditambah pola untuk accessibility
export const roadWidthExpression: ExpressionSpecification = [
	"interpolate",
	["linear"],
	["zoom"],
	8,
	[
		"case",
		["boolean", ["feature-state", "highlighted"], false],
		5,
		[
			"match",
			["get", "highway"],
			"motorway", 4,    // Lebih tebal untuk motorway
			"trunk", 3.5,
			"primary", 3,
			"secondary", 2.5,
			"footway", 1,
			"cycleway", 1,
			0.8,
		]
	],
	14,
	[
		"case",
		["boolean", ["feature-state", "highlighted"], false],
		14,
		[
			"match",
			["get", "highway"],
			"motorway", 12,   // Lebih tebal untuk motorway
			"trunk", 10,
			"primary", 9,
			"secondary", 7,
			"tertiary", 5,
			"unclassified", 4,
			"residential", 4,
			"living_street", 3,
			"service", 2,
			"footway", 1.5,
			"sidewalk", 1.5,
			"cycleway", 1.5,
			"path", 1.2,
			"track", 1.5,
			"steps", 1.5,
			3,
		]
	],
	18,
	[
		"case",
		["boolean", ["feature-state", "highlighted"], false],
		22,
		[
			"match",
			["get", "highway"],
			"motorway", 20,
			"trunk", 17,
			"primary", 15,
			"secondary", 13,
			"tertiary", 10,
			"unclassified", 8,
			"residential", 8,
			"living_street", 7,
			"service", 6,
			"footway", 3,
			"sidewalk", 3,
			"cycleway", 3,
			"path", 2.5,
			"track", 3,
			"steps", 3,
			6,
		]
	],
] as ExpressionSpecification

// Casing widths
export const roadCasingWidthExpression: ExpressionSpecification = [
	"interpolate",
	["linear"],
	["zoom"],
	8,
	[
		"match",
		["get", "highway"],
		"motorway", 5,
		"trunk", 4.5,
		"primary", 4,
		"secondary", 3.5,
		1,
	],
	14,
	[
		"match",
		["get", "highway"],
		"motorway", 14,
		"trunk", 12,
		"primary", 11,
		"secondary", 9,
		"tertiary", 7,
		"residential", 6,
		"service", 4,
		4,
	],
	18,
	[
		"match",
		["get", "highway"],
		"motorway", 24,
		"trunk", 21,
		"primary", 19,
		"secondary", 17,
		"tertiary", 14,
		"unclassified", 13,
		"residential", 13,
		"living_street", 12,
		"service", 11,
		10,
	],
]

/** Dashed road types */
export const DASHED_HIGHWAYS = new Set([
	"track",
	"path",
	"footway",
	"sidewalk",
	"cycleway",
	"steps",
	"bridleway",
	"construction",
	"proposed",
])

/** Road type labels for legend */
export const ROAD_TYPE_LABELS: Record<string, string> = {
	motorway: "Motorway",
	motorway_link: "Motorway Link",
	trunk: "Trunk Road",
	trunk_link: "Trunk Link",
	primary: "Primary Road",
	primary_link: "Primary Link",
	secondary: "Secondary Road",
	secondary_link: "Secondary Link",
	tertiary: "Tertiary Road",
	tertiary_link: "Tertiary Link",
	unclassified: "Unclassified",
	residential: "Residential",
	living_street: "Living Street",
	service: "Service Road",
	pedestrian: "Pedestrian",
	footway: "Footway",
	sidewalk: "Sidewalk",
	cycleway: "Cycleway",
	path: "Path",
	track: "Track",
	steps: "Steps",
	bridleway: "Bridleway",
	construction: "Construction",
	proposed: "Proposed",
	road: "Road",
}

/** Color descriptions for accessibility */
export const ROAD_COLOR_DESCRIPTIONS: Record<string, string> = {
	motorway: "Dark Blue",
	trunk: "Purple/Magenta",
	primary: "Orange",
	secondary: "Teal/Cyan",
	tertiary: "Pink",
	residential: "Gray",
	footway: "Indigo",
	cycleway: "Sea Green",
}
