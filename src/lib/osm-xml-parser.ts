/**
 * Parse Overpass API OSM XML response to GeoJSON
 * Lightweight parser for browser environment
 */

interface OSMNode {
	id: number
	lat: number
	lon: number
	tags: Record<string, string>
}

interface OSMWay {
	id: number
	nodeRefs: number[]
	tags: Record<string, string>
}

export function osmXmlToGeoJSON(xml: string): GeoJSON.FeatureCollection {
	const parser = new DOMParser()
	const doc = parser.parseFromString(xml, "application/xml")

	// Check for parse errors
	const parseError = doc.querySelector("parsererror")
	if (parseError) {
		throw new Error("Failed to parse OSM XML")
	}

	// Parse nodes
	const nodes = new Map<number, OSMNode>()
	const nodeElements = doc.querySelectorAll("node")
	nodeElements.forEach((nodeEl) => {
		const id = parseInt(nodeEl.getAttribute("id") || "0")
		const lat = parseFloat(nodeEl.getAttribute("lat") || "0")
		const lon = parseFloat(nodeEl.getAttribute("lon") || "0")
		const tags: Record<string, string> = {}

		nodeEl.querySelectorAll("tag").forEach((tagEl) => {
			const k = tagEl.getAttribute("k")
			const v = tagEl.getAttribute("v")
			if (k && v) tags[k] = v
		})

		nodes.set(id, { id, lat, lon, tags })
	})

	// Parse ways
	const ways: OSMWay[] = []
	const wayElements = doc.querySelectorAll("way")
	wayElements.forEach((wayEl) => {
		const id = parseInt(wayEl.getAttribute("id") || "0")
		const nodeRefs: number[] = []
		const tags: Record<string, string> = {}

		wayEl.querySelectorAll("nd").forEach((ndEl) => {
			const ref = parseInt(ndEl.getAttribute("ref") || "0")
			if (ref) nodeRefs.push(ref)
		})

		wayEl.querySelectorAll("tag").forEach((tagEl) => {
			const k = tagEl.getAttribute("k")
			const v = tagEl.getAttribute("v")
			if (k && v) tags[k] = v
		})

		ways.push({ id, nodeRefs, tags })
	})

	// Convert ways to GeoJSON features
	const features: GeoJSON.Feature[] = []

	for (const way of ways) {
		// Only include ways with highway tag
		if (!way.tags.highway) continue

		const coordinates: [number, number][] = []
		for (const nodeRef of way.nodeRefs) {
			const node = nodes.get(nodeRef)
			if (node) {
				coordinates.push([node.lon, node.lat])
			}
		}

		if (coordinates.length < 2) continue

		const feature: GeoJSON.Feature = {
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates,
			},
			properties: {
				id: way.id,
				...way.tags,
			},
		}

		features.push(feature)
	}

	return {
		type: "FeatureCollection",
		features,
	}
}

/**
 * Calculate approximate area size in km² from bbox
 */
export function calculateBboxAreaKm2(
	minLon: number,
	minLat: number,
	maxLon: number,
	maxLat: number,
): number {
	// Rough calculation using haversine formula approximation
	const R = 6371 // Earth radius in km
	const lat1 = (minLat * Math.PI) / 180
	const lat2 = (maxLat * Math.PI) / 180
	const lon1 = (minLon * Math.PI) / 180
	const lon2 = (maxLon * Math.PI) / 180

	const dLat = lat2 - lat1
	const dLon = lon2 - lon1

	// Distance north-south
	const nsDistance = R * dLat
	// Distance east-west (at average latitude)
	const avgLat = (lat1 + lat2) / 2
	const ewDistance = R * dLon * Math.cos(avgLat)

	return Math.abs(nsDistance * ewDistance)
}

/**
 * Format bbox for display
 */
export function formatBbox(bbox: {
	minLon: number
	minLat: number
	maxLon: number
	maxLat: number
}): string {
	return `${bbox.minLon.toFixed(4)}, ${bbox.minLat.toFixed(4)}, ${bbox.maxLon.toFixed(4)}, ${bbox.maxLat.toFixed(4)}`
}
