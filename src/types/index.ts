import type { OsmInfo } from "@osmix/core"

export interface SelectedEntity {
	id: number
	type: "node" | "way" | "relation"
	tags: Record<string, string>
	geometry: GeoJSON.Geometry | null
	lat?: number // Latitude (for inspect panel)
	lon?: number // Longitude (for inspect panel)
}

export interface OsmDataset {
	osmId: string
	info: OsmInfo
	fileName: string
}

export interface SpeedRecord {
	wayId: number
	timeband: number
	speed: number
	multiplier: number
}

export interface SpeedStats {
	totalRows: number
	uniqueWays: number
	minSpeed: number
	maxSpeed: number
	avgSpeed: number
}
