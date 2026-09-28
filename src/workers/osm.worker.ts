import { OsmChangeset, applyChangesetToOsm } from "@osmix/change"
import { expose, transfer } from "comlink"
import { Osm, toPbfBuffer, OsmixWorker } from "osmix"
import {
	encodeGeoParquet,
	type GeoParquetFeature,
} from "../lib/geoparquet-encode"
import {
	executeStreamingQuery,
	executeCountQuery,
	executeAggregateQuery,
	parseNaturalLanguageQuery,
	type QueryFilter,
	type QueryOptions,
	type QueryResult,
	type RoadRecord,
} from "./query-processor"

export interface GeoParquetExportOptions {
	roadsOnly?: boolean
	includeNodes?: boolean
	compression?: "SNAPPY" | "UNCOMPRESSED" | "GZIP"
}

export interface GeoParquetExportResult {
	bytes: Uint8Array
	rowCount: number
	skipped: number
}

/** Earth radius in metres, for the haversine helper below. */
const EARTH_RADIUS_M = 6_371_000

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dLat = (lat2 - lat1) * (Math.PI / 180)
	const dLon = (lon2 - lon1) * (Math.PI / 180)
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2
	return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toTagMap(tags: Record<string, unknown> | undefined): Record<string, string> {
	const out: Record<string, string> = {}
	if (!tags) return out
	for (const [key, value] of Object.entries(tags)) out[key] = String(value)
	return out
}

interface OsmWayLike {
	id: number
	refs: number[]
	tags?: Record<string, unknown>
}

interface OsmNodeLookup {
	nodes: { getById(id: number): { lon: number; lat: number } | null }
}

/** Build a LineString (or closed Polygon) for a way, or null if degenerate. */
function wayGeometry(osm: OsmNodeLookup, way: OsmWayLike): GeoJSON.Geometry | null {
	const coordinates: Array<[number, number]> = []
	for (const ref of way.refs) {
		const node = osm.nodes.getById(ref)
		if (node) coordinates.push([node.lon, node.lat])
	}
	if (coordinates.length < 2) return null

	const first = coordinates[0]
	const last = coordinates[coordinates.length - 1]
	const isClosed =
		coordinates.length > 3 && first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]

	if (isClosed && (way.tags?.building || way.tags?.landuse || way.tags?.natural || way.tags?.waterway || way.tags?.amenity)) {
		return { type: "Polygon", coordinates: [coordinates] }
	}
	return { type: "LineString", coordinates }
}

/**
 * Simple LRU tile cache to avoid re-encoding identical tiles.
 */
class TileCache {
	private cache = new Map<string, ArrayBuffer>()
	private maxSize: number

	constructor(maxSize = 512) {
		this.maxSize = maxSize
	}

	private key(id: string, tile: [number, number, number]): string {
		return `${id}/${tile[2]}/${tile[0]}/${tile[1]}`
	}

	get(id: string, tile: [number, number, number]): ArrayBuffer | undefined {
		const k = this.key(id, tile)
		const val = this.cache.get(k)
		if (val !== undefined) {
			// Move to end (most recently used)
			this.cache.delete(k)
			this.cache.set(k, val)
		}
		return val
	}

	set(id: string, tile: [number, number, number], data: ArrayBuffer): void {
		const k = this.key(id, tile)
		if (this.cache.has(k)) {
			this.cache.delete(k)
		}
		this.cache.set(k, data)
		// Evict oldest entries
		while (this.cache.size > this.maxSize) {
			const firstKey = this.cache.keys().next().value
			if (firstKey) this.cache.delete(firstKey)
		}
	}

	invalidate(id: string): void {
		for (const k of this.cache.keys()) {
			if (k.startsWith(`${id}/`)) this.cache.delete(k)
		}
	}

	clear(): void {
		this.cache.clear()
	}
}

/**
 * Extended OsmixWorker for the OSM Viz app.
 */
export class VizWorker extends OsmixWorker {
	private tileCache = new TileCache(512)
	/** Memoised `exportRoadsData` result, keyed by dataset id. */
	private roadsCache = new Map<string, RoadRecord[]>()
	/**
	 * Override getVectorTile with LRU cache.
	 * The base class uses Comlink.transfer which detaches the buffer,
	 * so we cache the original and transfer a copy.
	 */
	override getVectorTile(
		id: string,
		tile: [number, number, number],
	): ArrayBuffer {
		// NOTE: this runs once per visible tile on every pan/zoom. Logging here
		// (as this method used to) costs more than the tile encoding it wraps.
		const cached = this.tileCache.get(id, tile)
		if (cached) {
			// Return a copy — transfer detaches the buffer
			const copy = cached.slice(0)
			return transfer(copy, [copy]) as unknown as ArrayBuffer
		}

		const encoder = this.getEncoder(id)
		if (!encoder) return new ArrayBuffer(0)

		try {
			const data = encoder.getTile(tile)

			if (!data || data.byteLength === 0) {
				// Empty tiles are normal for tiles outside the data bounds.
				return new ArrayBuffer(0)
			}

			// Cache the original, transfer a copy
			this.tileCache.set(id, tile, data)
			const copy = data.slice(0)
			return transfer(copy, [copy]) as unknown as ArrayBuffer
		} catch (err) {
			console.error(`[worker] Tile encode failed ${id}/${tile[2]}/${tile[0]}/${tile[1]}:`, err)
			return new ArrayBuffer(0)
		}
	}

	/**
	 * Resolve the vector-tile encoder for a loaded dataset.
	 *
	 * `vtEncoders` is private on OsmixWorker, so it is reached through a narrow
	 * cast instead of an `any` — the base class owns this shape, not us.
	 */
	private getEncoder(id: string): { getTile(tile: [number, number, number]): ArrayBuffer } | undefined {
		const encoders = (this as unknown as {
			vtEncoders?: Record<string, { getTile(tile: [number, number, number]): ArrayBuffer }>
		}).vtEncoders
		return encoders?.[id]
	}

	/**
	 * Get all tags for a specific entity.
	 */
	getEntityTags(
		osmId: string,
		entityType: "node" | "way" | "relation",
		entityId: number,
	): Record<string, string> | null {
		const osm = this.get(osmId)
		const collection =
			entityType === "node"
				? osm.nodes
				: entityType === "way"
					? osm.ways
					: osm.relations
		const entity = collection.getById(entityId)
		if (!entity) return null
		const tags: Record<string, string> = {}
		if (entity.tags) {
			for (const [k, v] of Object.entries(entity.tags)) {
				tags[k] = String(v)
			}
		}
		return tags
	}

	/**
	 * Edit tags on an entity and persist the change.
	 * Creates a new Osm with the changeset applied and replaces the old one.
	 */
	editEntityTags(
		osmId: string,
		entityType: "node" | "way" | "relation",
		entityId: number,
		newTags: Record<string, string>,
	) {
		const osm = this.get(osmId)
		const changeset = new OsmChangeset(osm)

		changeset.modify(entityType, entityId, (entity) => ({
			...entity,
			tags: newTags,
		}))

		const newOsm = applyChangesetToOsm(changeset, osmId)
		this.set(osmId, newOsm)
		this.tileCache.invalidate(osmId)
		this.roadsCache.delete(osmId)
		return newOsm.info()
	}

	/**
	 * Drop a dataset and everything cached for it.
	 *
	 * OsmixWorker.delete() only releases the Osm index itself, so every cache
	 * keyed by osmId has to go with it — otherwise the next dataset loaded under
	 * the same id would be served stale tiles and a stale road table.
	 */
	override delete(osmId: string): void {
		super.delete(osmId)
		this.tileCache.invalidate(osmId)
		this.roadsCache.delete(osmId)
	}

	/**
	 * Get all restriction relations in the dataset.
	 */
	getRestrictions(osmId: string) {
		const osm = this.get(osmId)
		const restrictions: Array<{
			id: number
			tags: Record<string, string>
			members: Array<{
				type: "node" | "way" | "relation"
				ref: number
				role: string
			}>
			viaCoords: [number, number] | null
			fromWayCoords: Array<[number, number]>
			toWayCoords: Array<[number, number]>
		}> = []

		const result = osm.relations.search("type", "restriction")
		for (const rel of result) {
			const tags: Record<string, string> = {}
			if (rel.tags) {
				for (const [k, v] of Object.entries(rel.tags)) {
					tags[k] = String(v)
				}
			}

			const members: Array<{
				type: "node" | "way" | "relation"
				ref: number
				role: string
			}> = []
			let viaCoords: [number, number] | null = null
			const fromWayCoords: Array<[number, number]> = []
			const toWayCoords: Array<[number, number]> = []

			for (const member of rel.members) {
				members.push({
					type: member.type,
					ref: member.ref,
					role: member.role ?? "",
				})

				if (member.role === "via" && member.type === "node") {
					const node = osm.nodes.getById(member.ref)
					if (node) viaCoords = [node.lon, node.lat]
				}
				if (member.role === "from" && member.type === "way") {
					const way = osm.ways.getById(member.ref)
					if (way) {
						for (const nodeId of way.refs) {
							const node = osm.nodes.getById(nodeId)
							if (node) fromWayCoords.push([node.lon, node.lat])
						}
					}
				}
				if (member.role === "to" && member.type === "way") {
					const way = osm.ways.getById(member.ref)
					if (way) {
						for (const nodeId of way.refs) {
							const node = osm.nodes.getById(nodeId)
							if (node) toWayCoords.push([node.lon, node.lat])
						}
					}
				}
			}

			restrictions.push({
				id: rel.id,
				tags,
				members,
				viaCoords,
				fromWayCoords,
				toWayCoords,
			})
		}

		return restrictions
	}

	/**
	 * Get ways with access restrictions
	 */
	getAccessBlockedWays(osmId: string) {
		const osm = this.get(osmId)
		const blocked: Array<{
			id: number
			tags: Record<string, string>
			coords: Array<[number, number]>
			accessTag: string
		}> = []

		const accessTags = [
			["access", "no"],
			["motor_vehicle", "no"],
			["vehicle", "no"],
		] as const

		const seen = new Set<number>()

		for (const [key, val] of accessTags) {
			const result = osm.ways.search(key, val)
			for (const way of result) {
				if (seen.has(way.id)) continue
				seen.add(way.id)

				const tags: Record<string, string> = {}
				if (way.tags) {
					for (const [k, v] of Object.entries(way.tags)) {
						tags[k] = String(v)
					}
				}

				const coords: Array<[number, number]> = []
				for (const nodeId of way.refs) {
					const node = osm.nodes.getById(nodeId)
					if (node) coords.push([node.lon, node.lat])
				}

				blocked.push({ id: way.id, tags, coords, accessTag: `${key}=${val}` })
			}
		}

		return blocked
	}

	/**
	 * Get barrier nodes
	 */
	getBarrierNodes(osmId: string) {
		const osm = this.get(osmId)
		const barriers: Array<{
			id: number
			tags: Record<string, string>
			coords: [number, number]
		}> = []

		const result = osm.nodes.search("barrier")
		for (const node of result) {
			const tags: Record<string, string> = {}
			if (node.tags) {
				for (const [k, v] of Object.entries(node.tags)) {
					tags[k] = String(v)
				}
			}
			barriers.push({ id: node.id, tags, coords: [node.lon, node.lat] })
		}

		return barriers
	}

	/**
	 * Get all way IDs with a highway tag.
	 */
	getHighwayWayIds(osmId: string): number[] {
		const osm = this.get(osmId)
		return osm.ways.search("highway").map((way) => way.id)
	}

	/**
	 * Batch get way geometries for a list of way IDs.
	 * Returns GeoJSON-ready features with way_id property.
	 */
	getWayGeometries(
		osmId: string,
		wayIds: number[],
	): Array<{
		wayId: number
		coords: Array<[number, number]>
		highway: string
	}> {
		const osm = this.get(osmId)
		const results: Array<{
			wayId: number
			coords: Array<[number, number]>
			highway: string
		}> = []

		for (const wayId of wayIds) {
			const way = osm.ways.getById(wayId)
			if (!way) continue
			const coords: Array<[number, number]> = []
			for (const nodeId of way.refs) {
				const node = osm.nodes.getById(nodeId)
				if (node) coords.push([node.lon, node.lat])
			}
			if (coords.length >= 2) {
				const highway = way.tags?.highway
					? String(way.tags.highway)
					: "unknown"
				results.push({ wayId: way.id, coords, highway })
			}
		}

		return results
	}

	/**
	 * Batch get way coordinates for multiple IDs (for search highlights).
	 */
	getBatchWayCoords(
		osmId: string,
		wayIds: number[],
	): Array<{ id: number; coords: Array<[number, number]> }> {
		const osm = this.get(osmId)
		const results: Array<{ id: number; coords: Array<[number, number]> }> = []
		for (const wayId of wayIds) {
			const way = osm.ways.getById(wayId)
			if (!way) continue
			const coords: Array<[number, number]> = []
			for (const nodeId of way.refs) {
				const node = osm.nodes.getById(nodeId)
				if (node) coords.push([node.lon, node.lat])
			}
			if (coords.length >= 2) results.push({ id: way.id, coords })
		}
		return results
	}

	/**
	 * Get coordinates for a way (for highlighting on map).
	 */
	getWayCoords(
		osmId: string,
		wayId: number,
	): Array<[number, number]> | null {
		const osm = this.get(osmId)
		const way = osm.ways.getById(wayId)
		if (!way) return null
		const coords: Array<[number, number]> = []
		for (const nodeId of way.refs) {
			const node = osm.nodes.getById(nodeId)
			if (node) coords.push([node.lon, node.lat])
		}
		return coords.length >= 2 ? coords : null
	}

	/**
	 * Get node coordinates.
	 */
	getNodeCoords(
		osmId: string,
		nodeId: number,
	): [number, number] | null {
		const osm = this.get(osmId)
		const node = osm.nodes.getById(nodeId)
		if (!node) return null
		return [node.lon, node.lat]
	}

	/**
	 * Export all ways (roads) data for AI Query
	 * Returns array of road objects with all relevant properties
	 */
	exportRoadsData(osmId: string): RoadRecord[] {
		// Building this walks every highway way and resolves every node ref, so
		// it is memoised per dataset. AI Query used to rebuild it for each
		// individual query, making a "count motorways" question O(all ways).
		const cached = this.roadsCache.get(osmId)
		if (cached) return cached

		const osm = this.get(osmId)
		const roads: RoadRecord[] = []

		// Get all ways with highway tag (roads)
		const ways = osm.ways.search("highway")

		for (const way of ways) {
			const tags: Record<string, string> = {}
			if (way.tags) {
				for (const [k, v] of Object.entries(way.tags)) {
					tags[k] = String(v)
				}
			}

			// Calculate length from coordinates
			let lengthMeters = 0
			let prevLon: number | null = null
			let prevLat = 0
			for (const nodeId of way.refs) {
				const node = osm.nodes.getById(nodeId)
				if (!node) continue
				if (prevLon !== null) {
					lengthMeters += haversineDistance(prevLat, prevLon, node.lat, node.lon)
				}
				prevLon = node.lon
				prevLat = node.lat
			}

			roads.push({
				id: way.id,
				name: way.tags?.name ? String(way.tags.name) : null,
				highway: way.tags?.highway ? String(way.tags.highway) : null,
				length_meters: Math.round(lengthMeters),
				tags,
			})
		}

		this.roadsCache.set(osmId, roads)
		return roads
	}

	/**
	 * Execute streaming query on roads data
	 * Returns results in batches to avoid memory issues
	 */
	async executeQuery(
		osmId: string,
		filter: QueryFilter,
		options: QueryOptions = {},
	): Promise<QueryResult> {
		const roads = this.exportRoadsData(osmId)
		return executeStreamingQuery(roads, filter, options)
	}

	/**
	 * Execute count query (faster for large datasets)
	 */
	async executeCount(osmId: string, filter: QueryFilter): Promise<number> {
		const roads = this.exportRoadsData(osmId)
		return executeCountQuery(roads, filter)
	}

	/**
	 * Execute aggregate query (SUM, AVG, etc)
	 */
	async executeAggregate(
		osmId: string,
		filter: QueryFilter,
		aggregate: 'sum' | 'avg' | 'min' | 'max',
		field: 'length_meters',
	): Promise<number> {
		const roads = this.exportRoadsData(osmId)
		return executeAggregateQuery(roads, filter, aggregate, field)
	}

	/**
	 * Parse natural language to query filter
	 */
	parseQuery(query: string): QueryFilter {
		return parseNaturalLanguageQuery(query)
	}

	/**
	 * Export a roads-only PBF from the loaded dataset.
	 * Filters to ways with highway=* tags and their referenced nodes only.
	 * Returns a Uint8Array of PBF bytes ready for download.
	 */
	async exportRoadsPbf(osmId: string): Promise<Uint8Array> {
		const source = this.get(osmId)

		// Collect all highway ways
		const highwayWays = source.ways.search("highway")
		if (highwayWays.length === 0) return new Uint8Array(0)

		// Collect unique node IDs referenced by those ways
		const nodeIds = new Set<number>()
		for (const way of highwayWays) {
			for (const ref of way.refs) nodeIds.add(ref)
		}

		// Build a new minimal Osm with only roads + their nodes
		const filtered = new Osm({ id: `${osmId}:roads`, header: source.header })
		for (const nodeId of nodeIds) {
			const node = source.nodes.getById(nodeId)
			if (node) filtered.nodes.addNode(node)
		}
		for (const way of highwayWays) {
			filtered.ways.addWay(way)
		}
		filtered.buildIndexes()

		const pbfBytes = await toPbfBuffer(filtered)
		return transfer(pbfBytes, [pbfBytes.buffer]) as unknown as Uint8Array
	}

	/**
	 * Export the loaded dataset as a GeoParquet file.
	 *
	 * GeoParquet stores geometry inline per feature, so it needs no node table
	 * and can be read columnar by hyparquet, DuckDB, GeoPandas or QGIS. It is an
	 * interchange format rather than a compaction win: for an extract that is
	 * already filtered down to roads, a PBF is usually the smaller of the two.
	 */
	exportGeoParquet(
		osmId: string,
		options: GeoParquetExportOptions = {},
	): GeoParquetExportResult {
		const { roadsOnly = true, includeNodes = true, compression = "SNAPPY" } = options
		const osm = this.get(osmId)
		const features: GeoParquetFeature[] = []

		const ways = roadsOnly ? osm.ways.search("highway") : Array.from(osm.ways)
		for (const way of ways) {
			const geometry = wayGeometry(osm, way)
			if (!geometry) continue
			features.push({ type: "way", id: way.id, tags: toTagMap(way.tags), geometry })
		}

		if (includeNodes) {
			for (const node of osm.nodes) {
				if (!node.tags) continue
				const tags = toTagMap(node.tags)
				if (Object.keys(tags).length === 0) continue
				features.push({
					type: "node",
					id: node.id,
					tags,
					geometry: { type: "Point", coordinates: [node.lon, node.lat] },
				})
			}
		}

		const { bytes, rowCount, skipped } = encodeGeoParquet(features, { compression })
		if (bytes.byteLength === 0) {
			return { bytes, rowCount: 0, skipped }
		}
		return transfer({ bytes, rowCount, skipped }, [bytes.buffer]) as unknown as GeoParquetExportResult
	}
}

expose(new VizWorker())
