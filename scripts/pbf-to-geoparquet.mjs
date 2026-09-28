#!/usr/bin/env node
/**
 * Convert an .osm.pbf extract into a GeoParquet file.
 *
 * GeoParquet keeps only what the visualizer needs — columns, WKB geometry and
 * zstd/snappy compression — so a converted file is typically several times
 * smaller than the source PBF and skips PBF block decoding entirely.
 *
 * Usage:
 *   node scripts/pbf-to-geoparquet.mjs <input.osm.pbf> [output.geoparquet] [--all]
 *
 *   --all   Export every way with a highway=* tag plus tagged nodes.
 *           Default is roads only (matches the "roads-only PBF" export).
 *
 * Requires Node >= 23 (native TypeScript type-stripping) so the shared
 * encoder in src/lib/geoparquet-encode.ts can be imported directly.
 */

import { readFile, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { statSync } from "node:fs"

import { fromPbf } from "osmix"
import { encodeGeoParquet } from "../src/lib/geoparquet-encode.ts"

function usage(message) {
	if (message) console.error(`error: ${message}\n`)
	console.error(
		"usage: node scripts/pbf-to-geoparquet.mjs <input.osm.pbf> [output.geoparquet] [--all]",
	)
	process.exit(1)
}

const args = process.argv.slice(2)
const includeAll = args.includes("--all")
const positional = args.filter((a) => !a.startsWith("--"))
const inputPath = positional[0]
if (!inputPath) usage("missing input file")

const outputPath =
	positional[1] ?? `${basename(inputPath).replace(/\.osm\.pbf$|\.pbf$/, "")}.geoparquet`

const input = resolve(inputPath)
const output = resolve(outputPath)

const started = Date.now()
const inputBytes = statSync(input).size
console.log(`Reading ${input} (${(inputBytes / 1024 / 1024).toFixed(1)} MB)...`)

const data = await readFile(input)
const osm = await fromPbf(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), {
	id: basename(input),
})

console.log(
	`Parsed in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
		`${osm.nodes.size.toLocaleString()} nodes, ` +
		`${osm.ways.size.toLocaleString()} ways, ` +
		`${osm.relations.size.toLocaleString()} relations`,
)

const features = []
const nodeCache = new Map()

const geometryForWay = (way) => {
	const coordinates = []
	for (const ref of way.refs) {
		let node = nodeCache.get(ref)
		if (node === undefined) {
			const found = osm.nodes.getById(ref)
			node = found ? [found.lon, found.lat] : null
			nodeCache.set(ref, node)
		}
		if (node) coordinates.push(node)
	}
	if (coordinates.length < 2) return null
	return { type: "LineString", coordinates }
}

for (const way of osm.ways.search("highway")) {
	const geometry = geometryForWay(way)
	if (!geometry) continue
	features.push({
		type: "way",
		id: way.id,
		tags: way.tags ?? {},
		geometry,
	})
}

if (includeAll) {
	const roadWayIds = new Set(features.map((f) => f.id))
	for (const way of osm.ways) {
		if (roadWayIds.has(way.id)) continue
		const geometry = geometryForWay(way)
		if (!geometry) continue
		features.push({ type: "way", id: way.id, tags: way.tags ?? {}, geometry })
	}
}

for (const node of osm.nodes) {
	if (!node.tags || Object.keys(node.tags).length === 0) continue
	features.push({
		type: "node",
		id: node.id,
		tags: node.tags,
		geometry: { type: "Point", coordinates: [node.lon, node.lat] },
	})
}

console.log(`Encoding ${features.length.toLocaleString()} features -> GeoParquet...`)

const { bytes, rowCount, skipped } = encodeGeoParquet(features, {
	extraMetadata: {
		"osmroad:source": basename(input),
		"osmroad:generated_at": new Date().toISOString(),
		"osmroad:roads_only": String(!includeAll),
	},
	onProgress: (done, total) => {
		if (done < total) process.stdout.write(`\r  encoded ${done.toLocaleString()}/${total.toLocaleString()}`)
	},
})
process.stdout.write("\n")

if (rowCount === 0) {
	console.error("No features with geometry found — nothing written.")
	process.exit(1)
}

await writeFile(output, bytes)

const ratio = inputBytes / bytes.byteLength
console.log(
	`\n${output}\n` +
		`  ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB  (${rowCount.toLocaleString()} rows` +
		`${skipped ? `, ${skipped.toLocaleString()} skipped` : ""})\n` +
		`  ${ratio.toFixed(1)}x smaller than the source PBF\n` +
		`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`,
)
