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
	const [progress, setProgress] = useState(0)

	const syncData = useCallback(async () => {
		if (!dataset || !duckdb || isLimited) {
			setIsSynced(false)
			setProgress(0)
			return
		}

		setIsSyncing(true)
		setError(null)
		setProgress(0)

		try {
			const remote = getOsmRemote()
			if (!remote) {
				throw new Error('OSM remote not initialized')
			}

			const worker = remote.getWorker()
			
			// Export roads data from worker
			setProgress(10)
			const roads = await worker.exportRoadsData(dataset.osmId)
			setProgress(30)
			
			// Create roads table in DuckDB with BIGINT for IDs
			await duckdb.executeQuery(`
				CREATE OR REPLACE TABLE roads (
					id BIGINT,
					name VARCHAR,
					highway VARCHAR,
					length_meters DOUBLE,
					tags JSON
				)
			`)
			setProgress(40)

			// Insert roads data in batches
			const batchSize = 500
			const totalBatches = Math.ceil(roads.length / batchSize)
			
			for (let i = 0; i < roads.length; i += batchSize) {
				const batch = roads.slice(i, i + batchSize)
				const values = batch.map(r => {
					const name = r.name ? `'${r.name.replace(/'/g, "''")}'` : 'NULL'
					const highway = r.highway ? `'${r.highway}'` : 'NULL'
					const tags = JSON.stringify(r.tags).replace(/'/g, "''")
					return `(${r.id}::BIGINT, ${name}, ${highway}, ${r.length_meters}, '${tags}'::JSON)`
				}).join(',')

				await duckdb.executeQuery(`
					INSERT INTO roads VALUES ${values}
				`)
				
				const batchNum = Math.floor(i / batchSize) + 1
				setProgress(40 + Math.round((batchNum / totalBatches) * 50))
			}

			// Create indexes
			await duckdb.executeQuery('CREATE INDEX IF NOT EXISTS idx_roads_highway ON roads(highway)')
			await duckdb.executeQuery('CREATE INDEX IF NOT EXISTS idx_roads_name ON roads(name)')
			setProgress(100)

			setIsSynced(true)
			console.log(`[OsmDuckDBSync] Synced ${roads.length} roads to DuckDB`)
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

	return { isSyncing, isSynced, error, progress, syncData }
}
