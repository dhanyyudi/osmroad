#!/usr/bin/env node
/**
 * Stage DuckDB-wasm's `eh` module for the local Vite dev server.
 *
 * In production the module is NOT a static asset. It is 32.7 MiB raw, which
 * exceeds Cloudflare's 25 MiB per-asset limit, and storing it gzipped and
 * declaring `Content-Encoding: gzip` via `_headers` double-encodes it (the
 * asset layer compresses the already-compressed bytes on the way out). So it
 * lives in R2 and is served by the Worker at /duckdb/duckdb-eh.wasm — see
 * `handleDuckdbWasm` in worker/index.ts.
 *
 * Locally there is no Worker, so this drops the raw module into public/ for the
 * Vite dev server to serve at that same path. `public/duckdb/` is gitignored.
 *
 * Usage: node scripts/prepare-duckdb-wasm.mjs
 */

import { copyFile, mkdir, stat } from "node:fs/promises"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const source = join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist", "duckdb-eh.wasm")
const target = join(root, "public", "duckdb", "duckdb-eh.wasm")

try {
	await stat(source)
} catch {
	console.error(`error: ${source} not found. Run \`npm install\` first.`)
	process.exit(1)
}

await mkdir(join(root, "public", "duckdb"), { recursive: true })
await copyFile(source, target)

console.log(`duckdb-wasm: staged module for the dev server -> ${target}`)
