import { useMemo, useEffect, useCallback } from "react"
import { Layer, Source, useMap } from "react-map-gl/maplibre"
import type {
	FilterSpecification,
	SymbolLayerSpecification,
} from "maplibre-gl"
import { zigzag } from "@osmix/shared/zigzag"
import { osmixIdToTileUrl } from "../../lib/osmix-vector-protocol"
import { MIN_PICKABLE_ZOOM } from "../../constants"
import { useUIStore } from "../../stores/ui-store"
import { useOsmStore } from "../../stores/osm-store"
import { useSpeedStore } from "../../stores/speed-store"
import {
	roadColorExpression,
	roadCasingColorExpression,
	roadWidthExpression,
	roadCasingWidthExpression,
} from "../../lib/road-style"
import { registerNodeIcons, nodeIconId } from "../../lib/node-icons"

interface RoadLayerProps {
	osmId: string
}

// Filters
const wayLinesFilter: FilterSpecification = [
	"==",
	["geometry-type"],
	"LineString",
]
// nodeFilter kept for reference if needed
// const nodeFilter: FilterSpecification = ["==", ["get", "type"], "node"]

// Oneway filters (raw OSM: string values)
const onewayForwardFilter: FilterSpecification = [
	"all",
	["==", ["geometry-type"], "LineString"],
	["any",
		["==", ["get", "oneway"], "yes"],
		["==", ["get", "oneway"], "1"],
	],
]
const onewayReverseFilter: FilterSpecification = [
	"all",
	["==", ["geometry-type"], "LineString"],
	["==", ["get", "oneway"], "-1"],
]
// All ways that are NOT oneway (for faint way-direction arrows)
const notOnewayFilter: FilterSpecification = [
	"all",
	["==", ["geometry-type"], "LineString"],
	["!", ["any",
		["==", ["get", "oneway"], "yes"],
		["==", ["get", "oneway"], "1"],
		["==", ["get", "oneway"], "-1"],
	]],
]

const DASHED_TYPES = ["track", "path", "footway", "sidewalk", "cycleway", "steps", "bridleway", "construction", "proposed"]
const dashedFilter: FilterSpecification = [
	"all",
	["==", ["geometry-type"], "LineString"],
	["in", ["get", "highway"], ["literal", DASHED_TYPES]],
]
const solidFilter: FilterSpecification = [
	"all",
	["==", ["geometry-type"], "LineString"],
	["!", ["in", ["get", "highway"], ["literal", DASHED_TYPES]]],
]

// barrierFilter replaced by iconNodeFilter below
// const barrierFilter: FilterSpecification = [
// 	"all",
// 	["==", ["get", "type"], "node"],
// 	["has", "barrier"],
// ]

// Nodes that have a specific icon (highway or barrier or traffic_calming)
const ICON_HIGHWAY_TYPES = [
	"traffic_signals", "bus_stop", "stop", "give_way", "crossing",
]
const ICON_BARRIER_TYPES = ["gate", "bollard", "lift_gate"]

const iconNodeFilter: FilterSpecification = [
	"all",
	["==", ["get", "type"], "node"],
	["any",
		["in", ["get", "highway"], ["literal", ICON_HIGHWAY_TYPES]],
		["in", ["get", "barrier"], ["literal", ICON_BARRIER_TYPES]],
		["has", "traffic_calming"],
	],
]

// Remaining nodes without a specific icon (fallback circle)
const plainNodeFilter: FilterSpecification = [
	"all",
	["==", ["get", "type"], "node"],
	["!",
		["any",
			["in", ["get", "highway"], ["literal", ICON_HIGHWAY_TYPES]],
			["in", ["get", "barrier"], ["literal", ICON_BARRIER_TYPES]],
			["has", "traffic_calming"],
		],
	],
]

/**
 * Generate iD-style chevron arrow (open '>') for SDF rendering.
 * Arrow points right — MapLibre auto-rotates along line direction.
 * SDF mode allows controlling color via `icon-color` paint property.
 *
 * Draws a slim, elegant chevron that matches iD Editor's visual style:
 * - Narrow chevron angle (~60°) for a sleek look
 * - Thin stroke for subtlety
 * - Vertically compact to sit within road lines
 */
function createChevronArrowSDF(size = 20): {
	width: number
	height: number
	data: Uint8Array
} {
	const canvas = document.createElement("canvas")
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext("2d")!

	ctx.clearRect(0, 0, size, size)

	// Slim chevron: narrower angle, vertically compact
	const leftX = size * 0.3
	const tipX = size * 0.7
	const midY = size * 0.5
	const armY = size * 0.25  // vertical extent of arms

	ctx.strokeStyle = "#ffffff"
	ctx.lineWidth = size * 0.1  // thinner stroke (~2px at 20px)
	ctx.lineCap = "round"
	ctx.lineJoin = "round"

	ctx.beginPath()
	ctx.moveTo(leftX, midY - armY)
	ctx.lineTo(tipX, midY)
	ctx.lineTo(leftX, midY + armY)
	ctx.stroke()

	const imageData = ctx.getImageData(0, 0, size, size)
	return {
		width: size,
		height: size,
		data: new Uint8Array(imageData.data.buffer),
	}
}

export function RoadLayer({ osmId }: RoadLayerProps) {
	const roadsVisible = useUIStore((s) => s.layers.roads)
	const nodesVisible = useUIStore((s) => s.layers.nodes)
	const speedVisible = useUIStore((s) => s.layers.speed)
	const dataset = useOsmStore((s) => s.dataset)
	const speedLoaded = useSpeedStore((s) => s.isLoaded)
	const speedStats = useSpeedStore((s) => s.stats)
	const speedData = useSpeedStore((s) => s.speedData)
	const { current: mapInstance } = useMap()

	const sourceId = `osmviz:${osmId}:source`
	const sourceLayerPrefix = `@osmix:${osmId}`

	const tiles = useMemo(() => [osmixIdToTileUrl(osmId)], [osmId])
	const bounds = dataset?.info.bbox as [number, number, number, number] | undefined

	const colorBySpeed = speedVisible && speedLoaded && speedStats

	// Register SDF arrow + node icons on map
	const registerImages = useCallback(() => {
		const map = mapInstance?.getMap()
		if (!map) return
		if (!map.hasImage("oneway-arrow")) {
			const arrow = createChevronArrowSDF(20)
			map.addImage("oneway-arrow", arrow, { sdf: true })
		}
		registerNodeIcons(map, 24)
	}, [mapInstance])

	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!map) return

		if (map.isStyleLoaded()) {
			registerImages()
		} else {
			map.once("style.load", registerImages)
		}

		// Re-add when style changes (basemap switch wipes images)
		const onStyleData = () => { registerImages() }
		map.on("styledata", onStyleData)
		return () => { map.off("styledata", onStyleData) }
	}, [mapInstance, registerImages])

	// Apply feature states for speed coloring
	useEffect(() => {
		const map = mapInstance?.getMap()
		if (!colorBySpeed || !speedStats || !map) return
		const sourceLayer = `${sourceLayerPrefix}:ways`

		const applyStates = () => {
			try {
				map.removeFeatureState({ source: sourceId, sourceLayer })
			} catch { /* ignore */ }

			for (const [wayId, records] of speedData) {
				const speed = records[0]?.speed ?? 0
				try {
					map.setFeatureState(
						{ source: sourceId, sourceLayer, id: zigzag(wayId) },
						{ speed, hasSpeed: true },
					)
				} catch { /* feature may not be loaded yet */ }
			}
		}

		applyStates()
		map.on("sourcedata", applyStates)
		return () => { map.off("sourcedata", applyStates) }
	}, [colorBySpeed, speedData, speedStats, sourceId, sourceLayerPrefix, mapInstance])

	// Dynamic road color
	const roadColor = useMemo(() => {
		if (colorBySpeed && speedStats) {
			return [
				"case",
				["boolean", ["feature-state", "hasSpeed"], false],
				[
					"interpolate", ["linear"], ["feature-state", "speed"],
					speedStats.minSpeed, "#ff0000",
					speedStats.minSpeed + (speedStats.maxSpeed - speedStats.minSpeed) * 0.25, "#ff8800",
					speedStats.minSpeed + (speedStats.maxSpeed - speedStats.minSpeed) * 0.5, "#ffff00",
					speedStats.minSpeed + (speedStats.maxSpeed - speedStats.minSpeed) * 0.75, "#88ff00",
					speedStats.maxSpeed, "#00ff00",
				],
				"rgba(80, 80, 80, 0.4)",
			] as unknown as maplibregl.ExpressionSpecification
		}
		return roadColorExpression
	}, [colorBySpeed, speedStats])

	const opacity = roadsVisible ? 1 : 0

	return (
		<Source
			id={sourceId}
			type="vector"
			tiles={tiles}
			bounds={bounds}
			minzoom={MIN_PICKABLE_ZOOM}
			maxzoom={14}
		>
			{/* === CASING (outline) for solid roads === */}
			<Layer
				id={`osmviz:${osmId}:casing`}
				type="line"
				filter={solidFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				layout={{ "line-join": "round", "line-cap": "round" }}
				paint={{
					"line-color": colorBySpeed ? "rgba(0,0,0,0.3)" : roadCasingColorExpression,
					"line-width": roadCasingWidthExpression,
					"line-opacity": opacity * 0.8,
				}}
			/>

			{/* === SOLID road fill === */}
			<Layer
				id={`osmviz:${osmId}:ways`}
				type="line"
				filter={solidFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				layout={{ "line-join": "round", "line-cap": "round" }}
				paint={{
					"line-color": roadColor,
					"line-width": roadWidthExpression,
					"line-opacity": opacity,
				}}
			/>

			{/* === DASHED road fill (track, footway, cycleway, etc) === */}
			<Layer
				id={`osmviz:${osmId}:ways-dashed`}
				type="line"
				filter={dashedFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				layout={{ "line-join": "round", "line-cap": "butt" }}
				paint={{
					"line-color": roadColor,
					"line-width": roadWidthExpression,
					"line-dasharray": [4, 3],
					"line-opacity": opacity,
				}}
			/>

			{/* === WAY DIRECTION ARROWS (all non-oneway ways, very faint) === */}
			<Layer
				id={`osmviz:${osmId}:way-direction`}
				type="symbol"
				filter={notOnewayFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={16}
				layout={{
					"symbol-placement": "line",
					"symbol-spacing": 80,
					"icon-image": "oneway-arrow",
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						16, 0.5,
						18, 0.65,
					],
					"icon-rotation-alignment": "map",
					"icon-keep-upright": false,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#888888",
					"icon-opacity": [
						"interpolate", ["linear"], ["zoom"],
						16, 0,
						17, 0.2,
						20, 0.3,
					] as unknown as maplibregl.ExpressionSpecification,
				}}
			/>

			{/* === ONEWAY ARROW CASING (dark shadow for contrast on light roads) === */}
			<Layer
				id={`osmviz:${osmId}:oneway-casing`}
				type="symbol"
				filter={onewayForwardFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={13}
				layout={{
					"symbol-placement": "line",
					"symbol-spacing": 75,
					"icon-image": "oneway-arrow",
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.65,
						15, 0.85,
						18, 1.05,
					],
					"icon-rotation-alignment": "map",
					"icon-keep-upright": false,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#333333",
					"icon-opacity": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.2,
						15, 0.35,
						18, 0.4,
					] as unknown as maplibregl.ExpressionSpecification,
				}}
			/>

			{/* === ONEWAY ARROWS FORWARD (oneway=yes, solid chevron) === */}
			<Layer
				id={`osmviz:${osmId}:oneway-arrows`}
				type="symbol"
				filter={onewayForwardFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={13}
				layout={{
					"symbol-placement": "line",
					"symbol-spacing": 75,
					"icon-image": "oneway-arrow",
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.5,
						15, 0.7,
						18, 0.9,
					],
					"icon-rotation-alignment": "map",
					"icon-keep-upright": false,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#ffffff",
					"icon-opacity": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.55,
						15, 0.85,
						18, 0.9,
					] as unknown as maplibregl.ExpressionSpecification,
				}}
			/>

			{/* === ONEWAY REVERSE CASING (dark shadow) === */}
			<Layer
				id={`osmviz:${osmId}:oneway-reverse-casing`}
				type="symbol"
				filter={onewayReverseFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={13}
				layout={{
					"symbol-placement": "line",
					"symbol-spacing": 75,
					"icon-image": "oneway-arrow",
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.65,
						15, 0.85,
						18, 1.05,
					],
					"icon-rotation-alignment": "map",
					"icon-keep-upright": false,
					"icon-rotate": 180,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#333333",
					"icon-opacity": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.2,
						15, 0.35,
						18, 0.4,
					] as unknown as maplibregl.ExpressionSpecification,
				}}
			/>

			{/* === ONEWAY ARROWS REVERSE (oneway=-1, rotated 180°) === */}
			<Layer
				id={`osmviz:${osmId}:oneway-arrows-reverse`}
				type="symbol"
				filter={onewayReverseFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={13}
				layout={{
					"symbol-placement": "line",
					"symbol-spacing": 75,
					"icon-image": "oneway-arrow",
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.5,
						15, 0.7,
						18, 0.9,
					],
					"icon-rotation-alignment": "map",
					"icon-keep-upright": false,
					"icon-rotate": 180,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#ffffff",
					"icon-opacity": [
						"interpolate", ["linear"], ["zoom"],
						13, 0.55,
						15, 0.85,
						18, 0.9,
					] as unknown as maplibregl.ExpressionSpecification,
				}}
			/>

			{/* === ROAD LABELS (name + ref) === */}
			<Layer
				id={`osmviz:${osmId}:road-labels`}
				type="symbol"
				filter={wayLinesFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:ways` }}
				minzoom={15}
				layout={{
					"symbol-placement": "line-center",
					"text-field": [
						"case",
						["all", ["has", "name"], ["has", "ref"]],
						["concat", ["get", "name"], " (", ["get", "ref"], ")"],
						["has", "name"],
						["get", "name"],
						["has", "ref"],
						["get", "ref"],
						"",
					],
					"text-size": [
						"interpolate", ["linear"], ["zoom"],
						15, 10,
						18, 13,
					],
					"text-max-angle": 30,
					"text-padding": 10,
					"text-font": ["Open Sans Regular"],
				} as SymbolLayerSpecification["layout"]}
				paint={{
					"text-color": "#e0e0e0",
					"text-halo-color": "#1a1a2e",
					"text-halo-width": 1.5,
					"text-opacity": opacity * 0.85,
				}}
			/>

			{/* === NODE BACKGROUND CIRCLES (colored pin behind icon) === */}
			<Layer
				id={`osmviz:${osmId}:node-bg`}
				type="circle"
				filter={iconNodeFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:nodes` }}
				minzoom={14}
				paint={{
					"circle-color": [
						"match",
						["get", "highway"],
						"traffic_signals", "#e8a838",
						"bus_stop", "#4a90e2",
						"stop", "#e03030",
						"give_way", "#e07020",
						"crossing", "#6a8fa0",
						[
							"case",
							["has", "barrier"], "#888888",
							["has", "traffic_calming"], "#ff9900",
							"#555555",
						],
					] as unknown as maplibregl.ExpressionSpecification,
					"circle-radius": [
						"interpolate", ["linear"], ["zoom"],
						14, 5,
						16, 9,
						18, 12,
					],
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": [
						"interpolate", ["linear"], ["zoom"],
						14, 1,
						16, 1.5,
						18, 2,
					],
					"circle-opacity": nodesVisible ? 1 : 0,
					"circle-stroke-opacity": nodesVisible ? 1 : 0,
				}}
			/>

			{/* === NODE ICONS (Temaki/Maki SDF symbols) === */}
			<Layer
				id={`osmviz:${osmId}:node-icons`}
				type="symbol"
				filter={iconNodeFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:nodes` }}
				minzoom={14}
				layout={{
					"icon-image": [
						"case",
						["==", ["get", "highway"], "traffic_signals"], nodeIconId("traffic_signals"),
						["==", ["get", "highway"], "bus_stop"], nodeIconId("bus_stop"),
						["==", ["get", "highway"], "stop"], nodeIconId("stop"),
						["==", ["get", "highway"], "give_way"], nodeIconId("give_way"),
						["==", ["get", "highway"], "crossing"], nodeIconId("crossing"),
						["==", ["get", "barrier"], "gate"], nodeIconId("gate"),
						["==", ["get", "barrier"], "bollard"], nodeIconId("bollard"),
						["==", ["get", "barrier"], "lift_gate"], nodeIconId("lift_gate"),
						["has", "traffic_calming"], nodeIconId("speed_bump"),
						"",
					] as unknown as maplibregl.ExpressionSpecification,
					"icon-size": [
						"interpolate", ["linear"], ["zoom"],
						14, 0.35,
						16, 0.55,
						18, 0.75,
					],
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				} as unknown as SymbolLayerSpecification["layout"]}
				paint={{
					"icon-color": "#ffffff",
					"icon-opacity": nodesVisible ? 1 : 0,
				}}
			/>

			{/* === PLAIN NODES (no icon — small circles for misc tagged nodes) === */}
			<Layer
				id={`osmviz:${osmId}:nodes-plain`}
				type="circle"
				filter={plainNodeFilter}
				{...{ "source-layer": `${sourceLayerPrefix}:nodes` }}
				minzoom={15}
				paint={{
					"circle-color": "#cccccc",
					"circle-radius": [
						"interpolate", ["linear"], ["zoom"],
						15, 2,
						18, 4,
					],
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 1,
					"circle-opacity": nodesVisible ? 1 : 0,
					"circle-stroke-opacity": nodesVisible ? 1 : 0,
				}}
			/>
		</Source>
	)
}
