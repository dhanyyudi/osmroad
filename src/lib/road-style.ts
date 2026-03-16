import type { ExpressionSpecification } from "maplibre-gl"

/**
 * iD Editor highway colors — exact values from osm-id-editor-highway-colors.md
 * Reference: openstreetmap-carto + iD Editor source
 */

// Fill colors (main road color)
export const roadColorExpression: ExpressionSpecification = [
	"match",
	["get", "highway"],
	// Major roads
	"motorway", "#e892a2",
	"motorway_link", "#e892a2",
	"trunk", "#f9b29c",
	"trunk_link", "#f9b29c",
	"primary", "#fcd6a4",
	"primary_link", "#fcd6a4",
	"secondary", "#f7fabf",
	"secondary_link", "#f7fabf",
	"tertiary", "#ffffff",
	"tertiary_link", "#ffffff",
	// Minor roads
	"unclassified", "#ffffff",
	"residential", "#ffffff",
	"living_street", "#ededed",
	"service", "#ffffff",
	"pedestrian", "#dddddd",
	"road", "#dddddd",
	// Paths (dashed)
	"footway", "#ff6666",
	"sidewalk", "#ff6666",
	"cycleway", "#5555ff",
	"path", "#776a6a",
	"track", "#996633",
	"steps", "#ff6666",
	"bridleway", "#996633",
	// Special
	"construction", "#f7a030",
	"proposed", "#aaaaaa",
	"#dddddd", // default
]

// Casing colors (outline/border — darker than fill)
export const roadCasingColorExpression: ExpressionSpecification = [
	"match",
	["get", "highway"],
	"motorway", "#c24e6b",
	"motorway_link", "#c24e6b",
	"trunk", "#d1684a",
	"trunk_link", "#d1684a",
	"primary", "#a06b00",
	"primary_link", "#a06b00",
	"secondary", "#707d05",
	"secondary_link", "#707d05",
	"tertiary", "#c6c6c6",
	"tertiary_link", "#c6c6c6",
	"unclassified", "#c6c6c6",
	"residential", "#c6c6c6",
	"living_street", "#b8b8b8",
	"service", "#d4d4d4",
	"pedestrian", "#aaaaaa",
	"footway", "#cc4444",
	"sidewalk", "#cc4444",
	"cycleway", "#3333cc",
	"path", "#554f4f",
	"track", "#6b4520",
	"steps", "#cc4444",
	"bridleway", "#6b4520",
	"construction", "#c47a05",
	"#cccccc", // default
]

// Line widths by highway class
export const roadWidthExpression: ExpressionSpecification = [
	"interpolate",
	["linear"],
	["zoom"],
	8,
	[
		"match",
		["get", "highway"],
		"motorway", 3,
		"trunk", 2.5,
		"primary", 2,
		"secondary", 1.5,
		"footway", 1,
		"cycleway", 1,
		0.8,
	],
	14,
	[
		"match",
		["get", "highway"],
		"motorway", 10,
		"trunk", 8,
		"primary", 7,
		"secondary", 6,
		"tertiary", 4,
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
	],
	18,
	[
		"match",
		["get", "highway"],
		"motorway", 18,
		"trunk", 15,
		"primary", 13,
		"secondary", 11,
		"tertiary", 8,
		"unclassified", 7,
		"residential", 7,
		"living_street", 6,
		"service", 5,
		"footway", 3,
		"sidewalk", 3,
		"cycleway", 3,
		"path", 2.5,
		"track", 3,
		"steps", 3,
		6,
	],
]

// Casing widths (wider than fill to create border effect)
export const roadCasingWidthExpression: ExpressionSpecification = [
	"interpolate",
	["linear"],
	["zoom"],
	8,
	[
		"match",
		["get", "highway"],
		"motorway", 4,
		"trunk", 3.5,
		"primary", 3,
		"secondary", 2.5,
		1,
	],
	14,
	[
		"match",
		["get", "highway"],
		"motorway", 12,
		"trunk", 10,
		"primary", 9,
		"secondary", 8,
		"tertiary", 6,
		"residential", 5,
		"service", 3,
		4,
	],
	18,
	[
		"match",
		["get", "highway"],
		"motorway", 22,
		"trunk", 19,
		"primary", 17,
		"secondary", 15,
		"tertiary", 12,
		"unclassified", 11,
		"residential", 11,
		"living_street", 10,
		"service", 9,
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
