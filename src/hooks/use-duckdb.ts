import { useEffect, useState } from "react"
import type * as duckdb from "@duckdb/duckdb-wasm"
import { isFullMode } from "../lib/browser-support"

// Only the `eh` bundle is shipped. The `mvp` fallback would add another 39 MB of
// wasm to every deploy for browsers that fail `isFullMode()`'s exception-handling
// check anyway (see src/lib/browser-support.ts).
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"

/**
 * Where the DuckDB module lives.
 *
 * It cannot be a normal `?url` asset: the raw module is 32.7 MiB and Cloudflare
 * rejects any single static asset over 25 MiB. It also cannot be shipped
 * gzipped with `Content-Encoding: gzip` in `_headers` — the asset layer
 * compresses the stored bytes again, so the browser receives gzip inside gzip
 * and `instantiateStreaming` fails. The Worker serves it from R2 instead
 * (worker/index.ts → handleDuckdbWasm). Locally the Vite dev server serves the
 * same path from public/duckdb/.
 */
const DUCKDB_WASM_URL = "/duckdb/duckdb-eh.wasm"

/**
 * DuckDB-wasm is loaded on demand only.
 *
 * Everything here reaches the rest of the app through the structurally-typed
 * `DuckDBClient`, so the library itself can stay out of the initial bundle:
 * a visitor who only opens a PBF file never pays for the SQL engine. Between
 * them the eh/mvp wasm modules are ~73 MB of deployable assets, fetched only
 * when an AI-query or speed-map panel actually initialises the engine.
 */
type DuckDBModule = typeof import("@duckdb/duckdb-wasm")

let _db: duckdb.AsyncDuckDB | null = null
let _conn: duckdb.AsyncDuckDBConnection | null = null
let _initPromise: Promise<DuckDBClient | null> | null = null

/**
 * The DuckDB bundle this app runs.
 *
 * `selectBundle()` is deliberately not used. It would only ever land here — we
 * gate on `WebAssembly.Exception` support in isFullMode() — while forcing an
 * `mvp` entry into the bundles object that we would then have to ship. Naming
 * the bundle directly keeps the deploy to one wasm module.
 *
 * The `eh` module is single-threaded, so DuckDB does not need SharedArrayBuffer;
 * COOP/COEP is still required for the transferable ReadableStream used when
 * streaming large PBF files into the worker.
 */
const DUCKDB_BUNDLE: { mainModule: string; mainWorker: string } = {
	mainModule: DUCKDB_WASM_URL,
	mainWorker: eh_worker,
}

export interface DuckDBClient {
	loadSpeedmapCSV(buffer: ArrayBuffer, fileName: string): Promise<void>
	getStats(): Promise<{
		totalRows: number
		uniqueWays: number
		minSpeed: number
		maxSpeed: number
		avgSpeed: number
	} | null>
	getSpeedForWays(
		wayIds: number[],
	): Promise<
		Array<{
			wayId: number
			timeband: number
			speed: number
			multiplier: number
		}>
	>
	getTimebands(): Promise<number[]>
	// For AI Query feature
	executeQuery(sql: string): Promise<{ rows: unknown[]; schema: unknown; error?: string }>
}

const client: DuckDBClient = {
	async loadSpeedmapCSV(buffer: ArrayBuffer, fileName: string) {
		if (!_db || !_conn) throw new Error("DuckDB not initialized")

		const filePath = `/${fileName}`
		await _db.registerFileBuffer(filePath, new Uint8Array(buffer))

		await _conn.query(`
			CREATE OR REPLACE TABLE speedmap AS
			SELECT
				column0::BIGINT AS way_id,
				column1::INT AS timeband,
				column2::DOUBLE AS speed,
				column3::DOUBLE AS multiplier
			FROM read_csv('${filePath}',
				header=false,
				columns={'column0': 'BIGINT', 'column1': 'INT', 'column2': 'DOUBLE', 'column3': 'DOUBLE'},
				auto_detect=false
			)
		`)

		await _conn.query(
			`CREATE INDEX IF NOT EXISTS idx_speedmap_way ON speedmap(way_id)`,
		)
	},

	async getStats() {
		if (!_conn) throw new Error("DuckDB not initialized")

		const result = await _conn.query(`
			SELECT
				COUNT(*)::INT AS total_rows,
				COUNT(DISTINCT abs(way_id))::INT AS unique_ways,
				MIN(speed)::DOUBLE AS min_speed,
				MAX(speed)::DOUBLE AS max_speed,
				AVG(speed)::DOUBLE AS avg_speed
			FROM speedmap
		`)

		const row = result.get(0)
		if (!row) return null

		return {
			totalRows: Number(row.total_rows),
			uniqueWays: Number(row.unique_ways),
			minSpeed: Number(row.min_speed),
			maxSpeed: Number(row.max_speed),
			avgSpeed: Number(row.avg_speed),
		}
	},

	async getSpeedForWays(wayIds: number[]) {
		if (!_conn || wayIds.length === 0) return []

		const idList = wayIds.flatMap((id) => [id, -id]).join(",")
		const result = await _conn.query(`
			SELECT way_id::BIGINT AS way_id, timeband::INT AS timeband,
				   speed::DOUBLE AS speed, multiplier::DOUBLE AS multiplier
			FROM speedmap
			WHERE way_id IN (${idList})
		`)

		const rows: Array<{
			wayId: number
			timeband: number
			speed: number
			multiplier: number
		}> = []
		for (let i = 0; i < result.numRows; i++) {
			const row = result.get(i)
			if (!row) continue
			rows.push({
				wayId: Number(row.way_id),
				timeband: Number(row.timeband),
				speed: Number(row.speed),
				multiplier: Number(row.multiplier),
			})
		}
		return rows
	},

	async getTimebands() {
		if (!_conn) return []
		const result = await _conn.query(`
			SELECT DISTINCT timeband::INT AS timeband FROM speedmap ORDER BY timeband
		`)
		const bands: number[] = []
		for (let i = 0; i < result.numRows; i++) {
			const row = result.get(i)
			if (row) bands.push(Number(row.timeband))
		}
		return bands
	},

	async executeQuery(sql: string) {
		if (!_conn) {
			return { rows: [], schema: null, error: 'DuckDB not initialized' }
		}
		
		try {
			const result = await _conn.query(sql)
			const rows: unknown[] = []
			for (let i = 0; i < result.numRows; i++) {
				const row = result.get(i)
				if (row) rows.push(row)
			}
			return { rows, schema: result.schema }
		} catch (err: any) {
			return { rows: [], schema: null, error: err.message || 'Query execution failed' }
		}
	},
}

async function initDuckDB(): Promise<DuckDBClient | null> {
	// Skip initialization in limited mode (Safari)
	// DuckDB requires SharedArrayBuffer which is not available
	if (!isFullMode()) {
		return null
	}

	if (_conn) return client
	if (_initPromise) return _initPromise

	_initPromise = (async () => {
		// Deferred until a panel that needs SQL is actually opened.
		const duckdbModule: DuckDBModule = await import("@duckdb/duckdb-wasm")

		const worker = new Worker(DUCKDB_BUNDLE.mainWorker)
		const logger = new duckdbModule.ConsoleLogger()
		_db = new duckdbModule.AsyncDuckDB(logger, worker)
		await _db.instantiate(DUCKDB_BUNDLE.mainModule)
		_conn = await _db.connect()
		return client
	})()

	return _initPromise
}

/**
 * Drop the AI-query `roads` table.
 *
 * Called when a dataset is unloaded. Without it, a large dataset that skips the
 * DuckDB sync would leave the previous dataset's roads in place, and AI queries
 * would silently answer from data the user can no longer see.
 *
 * A no-op when DuckDB was never initialised or never synced.
 */
export async function dropRoadsTable(): Promise<void> {
	if (!_conn) return
	try {
		await _conn.query("DROP TABLE IF EXISTS roads")
	} catch (err) {
		// Not fatal: the next sync uses CREATE OR REPLACE TABLE.
		console.warn("[duckdb] Could not drop the roads table:", err)
	}
}

export function useDuckDB() {
	const [duckClient, setDuckClient] = useState<DuckDBClient | null>(
		isFullMode() && _conn ? client : null,
	)
	const [error, setError] = useState<string | null>(null)
	const [isLimited, setIsLimited] = useState(!isFullMode())

	useEffect(() => {
		// In limited mode, skip DuckDB initialization entirely
		if (!isFullMode()) {
			setIsLimited(true)
			setDuckClient(null)
			return
		}

		initDuckDB()
			.then((client) => {
				setDuckClient(client)
				setIsLimited(false)
			})
			.catch((err) => setError(String(err)))
	}, [])

	return { duckdb: duckClient, error, isLimited }
}
