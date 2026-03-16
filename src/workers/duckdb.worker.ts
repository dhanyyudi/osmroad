import * as Comlink from "comlink"
import * as duckdb from "@duckdb/duckdb-wasm"
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
	mvp: {
		mainModule: duckdb_wasm,
		mainWorker: mvp_worker,
	},
	eh: {
		mainModule: duckdb_wasm_eh,
		mainWorker: eh_worker,
	},
}

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null

const worker = {
	async init() {
		if (db) return

		const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
		const innerWorker = new Worker(bundle.mainWorker!)
		const logger = new duckdb.ConsoleLogger()
		db = new duckdb.AsyncDuckDB(logger, innerWorker)
		await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
		conn = await db.connect()
	},

	async loadSpeedmapCSV(buffer: ArrayBuffer, fileName: string) {
		if (!db || !conn) throw new Error("DuckDB not initialized")

		const filePath = `/${fileName}`
		await db.registerFileBuffer(filePath, new Uint8Array(buffer))

		await conn.query(`
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

		await conn.query(
			`CREATE INDEX IF NOT EXISTS idx_speedmap_way ON speedmap(way_id)`,
		)
	},

	async getStats() {
		if (!conn) throw new Error("DuckDB not initialized")

		const result = await conn.query(`
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
		if (!conn || wayIds.length === 0) return []

		const idList = wayIds.flatMap((id) => [id, -id]).join(",")
		const result = await conn.query(`
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
		if (!conn) return []
		const result = await conn.query(`
			SELECT DISTINCT timeband::INT AS timeband FROM speedmap ORDER BY timeband
		`)
		const bands: number[] = []
		for (let i = 0; i < result.numRows; i++) {
			const row = result.get(i)
			if (row) bands.push(Number(row.timeband))
		}
		return bands
	},

	async isLoaded() {
		if (!conn) return false
		try {
			const result = await conn.query(
				`SELECT COUNT(*)::INT AS c FROM speedmap`,
			)
			return Number(result.get(0)?.c) > 0
		} catch {
			return false
		}
	},
}

export type DuckDBWorker = typeof worker

Comlink.expose(worker)
