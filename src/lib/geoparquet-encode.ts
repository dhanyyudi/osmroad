/**
 * GeoParquet encoder — turns OSM-derived features into a GeoParquet 1.1 file.
 *
 * Pure module: no DOM, no OSM indexes. Runs identically in the browser worker
 * (Vite bundle) and in Node (scripts/pbf-to-geoparquet.mjs relies on Node's
 * native TypeScript type-stripping, so keep this file free of non-erasable TS).
 *
 * Schema produced — the exact column set `@osmix/geoparquet` reads back:
 *
 *   type      STRING      "node" | "way" | "relation"
 *   id        INT64       OSM entity id
 *   geometry  BYTE_ARRAY  WKB
 *   tags      STRING      JSON object
 *   bbox      struct      xmin, ymin, xmax, ymax
 *
 * `bbox` is required: hyparquet rejects a read that requests a column the file
 * does not contain, and @osmix/geoparquet always requests it.
 */

import { geojsonToWkb, parquetWriteBuffer, type SchemaElement } from "hyparquet-writer"

export interface GeoParquetFeature {
	type: "node" | "way" | "relation"
	id: number
	tags: Record<string, string>
	geometry: GeoJSON.Geometry
}

export interface EncodeGeoParquetOptions {
	/** Rows per parquet row group. Defaults to 100_000. */
	rowGroupSize?: number
	/** Overrides the dataset bbox stored in the `geo` metadata key. */
	bbox?: [number, number, number, number]
	/** Extra file-level metadata keys (e.g. OpenStreetMap source info). */
	extraMetadata?: Record<string, string>
	/** Compression codec. Defaults to ZSTD when available, else SNAPPY. */
	compression?: "SNAPPY" | "UNCOMPRESSED" | "GZIP"
	/** Reported through this callback every `progressInterval` rows. */
	onProgress?: (done: number, total: number) => void
	progressInterval?: number
}

const PARQUET_SCHEMA: SchemaElement[] = [
	{ name: "root", num_children: 5 },
	{
		name: "type",
		type: "BYTE_ARRAY",
		repetition_type: "REQUIRED",
		converted_type: "UTF8",
		logical_type: { type: "STRING" },
	},
	{ name: "id", type: "INT64", repetition_type: "REQUIRED" },
	{ name: "geometry", type: "BYTE_ARRAY", repetition_type: "REQUIRED" },
	{
		name: "tags",
		type: "BYTE_ARRAY",
		repetition_type: "REQUIRED",
		converted_type: "UTF8",
		logical_type: { type: "STRING" },
	},
	{ name: "bbox", repetition_type: "REQUIRED", num_children: 4 },
	{ name: "xmin", type: "DOUBLE", repetition_type: "REQUIRED" },
	{ name: "ymin", type: "DOUBLE", repetition_type: "REQUIRED" },
	{ name: "xmax", type: "DOUBLE", repetition_type: "REQUIRED" },
	{ name: "ymax", type: "DOUBLE", repetition_type: "REQUIRED" },
]

const GEOMETRY_TYPES = new Set([
	"Point",
	"LineString",
	"Polygon",
	"MultiPoint",
	"MultiLineString",
	"MultiPolygon",
	"GeometryCollection",
])

/** Axis-aligned bounds of any GeoJSON geometry, or null for empty geometry. */
export function geometryBbox(
	geometry: GeoJSON.Geometry,
): [number, number, number, number] | null {
	let xmin = Infinity
	let ymin = Infinity
	let xmax = -Infinity
	let ymax = -Infinity

	const visit = (coords: unknown): void => {
		if (!Array.isArray(coords)) return
		if (typeof coords[0] === "number" && typeof coords[1] === "number") {
			const x = coords[0]
			const y = coords[1]
			if (x < xmin) xmin = x
			if (y < ymin) ymin = y
			if (x > xmax) xmax = x
			if (y > ymax) ymax = y
			return
		}
		for (const child of coords) visit(child)
	}

	if (geometry.type === "GeometryCollection") {
		for (const child of geometry.geometries) {
			const childBox = geometryBbox(child)
			if (!childBox) continue
			if (childBox[0] < xmin) xmin = childBox[0]
			if (childBox[1] < ymin) ymin = childBox[1]
			if (childBox[2] > xmax) xmax = childBox[2]
			if (childBox[3] > ymax) ymax = childBox[3]
		}
	} else {
		visit(geometry.coordinates)
	}

	if (!Number.isFinite(xmin)) return null
	return [xmin, ymin, xmax, ymax]
}

function unionBbox(
	current: [number, number, number, number] | null,
	next: [number, number, number, number],
): [number, number, number, number] {
	if (!current) return next
	return [
		Math.min(current[0], next[0]),
		Math.min(current[1], next[1]),
		Math.max(current[2], next[2]),
		Math.max(current[3], next[3]),
	]
}

/**
 * Encode features into a GeoParquet 1.1 buffer.
 *
 * Rows whose geometry is empty or of an unsupported type are skipped; the
 * returned `skipped` count lets callers report that honestly.
 */
export function encodeGeoParquet(
	features: GeoParquetFeature[],
	options: EncodeGeoParquetOptions = {},
): { bytes: Uint8Array; rowCount: number; skipped: number; bbox: [number, number, number, number] | null } {
	const {
		rowGroupSize = 100_000,
		extraMetadata,
		compression = "SNAPPY",
		onProgress,
		progressInterval = 50_000,
	} = options

	const types: string[] = []
	const ids: bigint[] = []
	const geometries: Uint8Array[] = []
	const tags: string[] = []
	const bboxes: Array<{ xmin: number; ymin: number; xmax: number; ymax: number }> = []
	const seenGeometryTypes = new Set<string>()

	let datasetBbox: [number, number, number, number] | null = null
	let skipped = 0

	for (let i = 0; i < features.length; i++) {
		const feature = features[i]
		if (!feature) continue
		const geometry = feature.geometry
		if (!geometry || !GEOMETRY_TYPES.has(geometry.type)) {
			skipped++
			continue
		}
		const box = geometryBbox(geometry)
		if (!box) {
			skipped++
			continue
		}

		let wkb: Uint8Array
		try {
			wkb = geojsonToWkb(geometry as never)
		} catch {
			skipped++
			continue
		}

		types.push(feature.type)
		ids.push(BigInt(Math.trunc(feature.id)))
		geometries.push(wkb)
		tags.push(JSON.stringify(feature.tags ?? {}))
		bboxes.push({ xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3] })

		seenGeometryTypes.add(geometry.type)
		datasetBbox = unionBbox(datasetBbox, box)

		if (onProgress && i > 0 && i % progressInterval === 0) onProgress(i, features.length)
	}
	onProgress?.(features.length, features.length)

	if (types.length === 0) {
		return { bytes: new Uint8Array(0), rowCount: 0, skipped, bbox: null }
	}

	const finalBbox = options.bbox ?? datasetBbox ?? [0, 0, 0, 0]
	const geoMetadata = {
		version: "1.1.0",
		primary_column: "geometry",
		columns: {
			geometry: {
				encoding: "WKB",
				geometry_types: [...seenGeometryTypes].sort(),
				crs: null,
				bbox: finalBbox,
			},
		},
	}

	const kvMetadata = [
		{ key: "geo", value: JSON.stringify(geoMetadata) },
		...Object.entries(extraMetadata ?? {}).map(([key, value]) => ({ key, value })),
	]

	const buffer = parquetWriteBuffer({
		schema: PARQUET_SCHEMA,
		columnData: [
			{ name: "type", data: types },
			{ name: "id", data: ids },
			{ name: "geometry", data: geometries },
			{ name: "tags", data: tags },
			{ name: "bbox", data: bboxes },
		],
		kvMetadata,
		codec: compression,
		rowGroupSize,
	})

	return {
		bytes: new Uint8Array(buffer),
		rowCount: types.length,
		skipped,
		bbox: finalBbox,
	}
}
