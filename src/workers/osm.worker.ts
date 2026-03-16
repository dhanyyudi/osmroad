import { OsmChangeset, applyChangesetToOsm } from "@osmix/change"
import { expose, transfer } from "comlink"
import { OsmixWorker } from "osmix"

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
	/**
	 * Override getVectorTile with LRU cache.
	 * The base class uses Comlink.transfer which detaches the buffer,
	 * so we cache the original and transfer a copy.
	 */
	override getVectorTile(
		id: string,
		tile: [number, number, number],
	): ArrayBuffer {
		const cached = this.tileCache.get(id, tile)
		if (cached) {
			// Return a copy — transfer detaches the buffer
			const copy = cached.slice(0)
			return transfer(copy, [copy]) as unknown as ArrayBuffer
		}

		const encoder = (this as any).vtEncoders[id]
		if (!encoder) return new ArrayBuffer(0)

		const data = encoder.getTile(tile)
		if (!data || data.byteLength === 0) return new ArrayBuffer(0)

		// Cache the original, transfer a copy
		this.tileCache.set(id, tile, data)
		const copy = data.slice(0)
		return transfer(copy, [copy]) as unknown as ArrayBuffer
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
		return newOsm.info()
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
}

expose(new VizWorker())
