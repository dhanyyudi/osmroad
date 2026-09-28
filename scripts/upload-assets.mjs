#!/usr/bin/env node
/**
 * Upload the binary assets the Worker serves out of R2.
 *
 * Two groups, both of which are impossible to ship as static assets:
 *
 *   samples/*.osm.pbf, *.geoparquet   up to 75 MB each (25 MiB asset limit)
 *   duckdb-eh.wasm                    32.7 MiB raw (25 MiB asset limit). Stored
 *                                     uncompressed on purpose — Cloudflare's own
 *                                     content negotiation compresses it in
 *                                     transit, and pre-compressing it here was
 *                                     double-encoded on the way out.
 *
 * Usage:
 *   node scripts/upload-assets.mjs [--dry-run] [--bucket osmroad-samples]
 */

import { execFile } from "node:child_process"
import { readdir, stat } from "node:fs/promises"
import { join, resolve } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const bucketIndex = args.indexOf("--bucket")
const bucket = bucketIndex >= 0 ? args[bucketIndex + 1] : "osmroad-samples"

if (!bucket) {
	console.error("error: --bucket needs a value")
	process.exit(1)
}

const root = resolve(import.meta.dirname, "..")

const CONTENT_TYPES = {
	pbf: "application/octet-stream",
	geoparquet: "application/vnd.apache.parquet",
	wasm: "application/wasm",
}

function contentTypeFor(name) {
	if (name.endsWith(".osm.pbf") || name.endsWith(".pbf")) return CONTENT_TYPES.pbf
	if (name.endsWith(".geoparquet") || name.endsWith(".parquet")) return CONTENT_TYPES.geoparquet
	if (name.endsWith(".wasm") || name.endsWith(".wasm.gz")) return CONTENT_TYPES.wasm
	return "application/octet-stream"
}

async function upload(localPath, key) {
	const info = await stat(localPath)
	const sizeMb = (info.size / 1024 / 1024).toFixed(1)

	const command = [
		"r2",
		"object",
		"put",
		`${bucket}/${key}`,
		"--file",
		localPath,
		"--content-type",
		contentTypeFor(key),
		"--cache-control",
		"public, max-age=31536000, immutable",
		"--remote",
	]
	console.log(`${dryRun ? "[dry-run] " : ""}${sizeMb.padStart(7)} MB  ${key}`)
	if (dryRun) return

	try {
		await run("npx", ["wrangler", ...command], { stdio: "inherit" })
	} catch (error) {
		console.error(`failed to upload ${key}:`, error instanceof Error ? error.message : error)
		process.exitCode = 1
	}
}

// ── Sample extracts ──────────────────────────────────────────────────────────

const samplesDir = join(root, "samples")
const sampleNames = await readdir(samplesDir).catch(() => {
	console.error(`error: no samples directory at ${samplesDir}`)
	process.exit(1)
})

/**
 * Every small `<name>.osm.pbf` gets a GeoParquet sibling so the app can
 * demonstrate opening both formats. Those files are derived, so they are
 * gitignored and rebuilt here rather than committed — one source of truth, no
 * drift.
 *
 * The size cap is deliberate. GeoParquet repeats full float64 coordinates per
 * feature and carries no node table, so on an extract already filtered down to
 * roads it is the *larger* format and the gap widens with size: the 71.8 MB
 * Taipei PBF converts to 150.6 MB. Regenerating that on every upload would cost
 * minutes and ~180 MB of R2 to demonstrate nothing new.
 */
const GEOPARQUET_SAMPLE_MAX_BYTES = 40 * 1024 * 1024

async function convertMissingGeoparquet() {
	const pbfs = sampleNames.filter((name) => /\.osm\.pbf$/i.test(name))
	for (const pbf of pbfs) {
		const target = `${pbf.replace(/\.osm\.pbf$/i, "")}.geoparquet`
		if (sampleNames.includes(target)) continue

		const source = join(samplesDir, pbf)
		const { size } = await stat(source)
		if (size > GEOPARQUET_SAMPLE_MAX_BYTES) {
			console.log(
				`  skipping ${target}: ${pbf} is ${(size / 1024 / 1024).toFixed(0)} MB, ` +
					`over the ${GEOPARQUET_SAMPLE_MAX_BYTES / 1024 / 1024} MB demo cap`,
			)
			continue
		}

		console.log(`  generating ${target} from ${pbf}...`)
		if (dryRun) {
			// Nothing is written, so it must not be added to the upload list —
			// `upload()` stats every path it is given.
			console.log(`    [dry-run] would generate and upload ${target}`)
			continue
		}
		try {
			await run(
				"node",
				[join(root, "scripts", "pbf-to-geoparquet.mjs"), source, join(samplesDir, target)],
				{ stdio: "ignore" },
			)
			sampleNames.push(target)
		} catch (error) {
			console.error(
				`  could not generate ${target}:`,
				error instanceof Error ? error.message : error,
			)
		}
	}
}

await convertMissingGeoparquet()

const samples = sampleNames.filter((name) => /\.(osm\.pbf|pbf|geoparquet|parquet)$/i.test(name))
if (samples.length === 0) {
	console.error(`error: no .osm.pbf or .geoparquet files in ${samplesDir}`)
	process.exit(1)
}

console.log(`\n== samples -> r2://${bucket}/ ==`)
for (const name of samples) await upload(join(samplesDir, name), name)

// ── DuckDB wasm ──────────────────────────────────────────────────────────────

const wasmSource = join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist", "duckdb-eh.wasm")

try {
	await stat(wasmSource)
} catch {
	console.error(`\nerror: ${wasmSource} not found. Run \`npm install\` first.`)
	process.exit(1)
}

console.log(`\n== duckdb wasm -> r2://${bucket}/duckdb/ ==`)
await upload(wasmSource, "duckdb/duckdb-eh.wasm")

console.log(`\nDone. ${samples.length} sample(s) + 1 wasm object(s) ${dryRun ? "would be " : ""}uploaded.`)
