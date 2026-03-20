import { useEffect, useState, useCallback } from 'react'
import { useOsmStore } from '@/stores/osm-store'
import { getOsmRemote } from './use-osm'
import { useDuckDB } from './use-duckdb'

/**
 * Sync OSM data to DuckDB for AI Query
 * This runs automatically when OSM data is loaded
 */
export function useOsmDuckDBSync() {
	const { dataset } = useOsmStore()
	const { duckdb, isLimited } = useDuckDB()
	const [isSyncing, setIsSyncing] = useState(false)
	const [isSynced, setIsSynced] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const syncData = useCallback(async () => {
		if (!dataset || !duckdb || isLimited) {
			setIsSynced(false)
			return
		}

		setIsSyncing(true)
		setError(null)

		try {
			const remote = getOsmRemote()
			if (!remote) {
				throw new Error('OSM remote not initialized')
			}

			const worker = remote.getWorker()
			
			// Export roads data from worker
			const roads = await worker.exportRoadsData(dataset.osmId)
			
			// Create roads table in DuckDB
			await duckdb.executeQuery(`
				CREATE OR REPLACE TABLE roads (
					id INTEGER,
					name VARCHAR,
					highway VARCHAR,
					length_meters DOUBLE,
					tags JSON,
					node_ids INTEGER[]
				)
			`)

			// Insert roads data in batches
			const batchSize = 1000
			for (let i = 0; i < roads.length; i += batchSize) {
				const batch = roads.slice(i, i + batchSize)
				const values = batch.map(r => 
					`(${r.id}, ${r.name ? `'${r.name.replace(/'/g, "''")}'` : 'NULL'}, ` +
					`${r.highway ? `'${r.highway}'` : 'NULL'}, ${r.length_meters}, ` +
					`'${JSON.stringify(r.tags)}', [${r.node_ids.join(',')}])`
				).join(',')

				await duckdb.executeQuery(`
					INSERT INTO roads VALUES ${values}
				`)
			}

			// Export nodes data
			const nodes = await worker.exportNodesData(dataset.osmId)
			
			// Create nodes table
			await duckdb.executeQuery(`
				CREATE OR REPLACE TABLE nodes (
					id INTEGER,
					lat DOUBLE,
					lon DOUBLE,
					tags JSON
				)
			`)

			// Insert nodes in batches
			for (let i = 0; i < nodes.length; i += batchSize) {
				const batch = nodes.slice(i, i + batchSize)
				const values = batch.map(n => 
					`(${n.id}, ${n.lat}, ${n.lon}, '${JSON.stringify(n.tags)}')`
				).join(',')

				await duckdb.executeQuery(`
					INSERT INTO nodes VALUES ${values}
				`)
			}

			// Create indexes
			await duckdb.executeQuery('CREATE INDEX IF NOT EXISTS idx_roads_highway ON roads(highway)')
			await duckdb.executeQuery('CREATE INDEX IF NOT EXISTS idx_roads_name ON roads(name)')
			await duckdb.executeQuery('CREATE INDEX IF NOT EXISTS idx_nodes_id ON nodes(id)')

			setIsSynced(true)
			console.log(`[OsmDuckDBSync] Synced ${roads.length} roads and ${nodes.length} nodes to DuckDB`)
		} catch (err) {
			console.error('[OsmDuckDBSync] Failed to sync:', err)
			setError(String(err))
			setIsSynced(false)
		} finally {
			setIsSyncing(false)
		}
	}, [dataset, duckdb, isLimited])

	useEffect(() => {
		syncData()
	}, [syncData])

	return { isSyncing, isSynced, error, syncData }
}
