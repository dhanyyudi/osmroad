// AI Query Hook - Main logic for AI-powered queries
import { useState, useCallback } from 'react'
import { useAIQueryStore, type QueryResults } from '@/stores/ai-query-store'
import { naturalLanguageToSQL } from '@/services/ai/vertex-ai'
import { useDuckDB } from './use-duckdb'
import { useOsmDuckDBSync } from './use-osm-duckdb-sync'
import { useAIMapHighlight } from './use-ai-map-highlight'
import { detectQueryIntent, mapRoadType } from '@/services/ai/prompt-builder'
import { getOsmRemote } from './use-osm'
import { useOsmStore } from '@/stores/osm-store'
import type { QueryFilter } from '@/workers/query-processor'

export interface UseAIQueryReturn {
	// State
	isOpen: boolean
	isLoading: boolean
	status: 'idle' | 'generating' | 'executing' | 'completed' | 'error'
	currentSQL: string | null
	messages: import('@/stores/ai-query-store').QueryMessage[]

	// Data availability
	isDataReady: boolean
	isSyncing: boolean
	syncProgress: number
	syncStatusMessage: string

	// Actions
	toggleOpen: () => void
	sendQuery: (prompt: string) => Promise<void>
	clearChat: () => void

	// Status
	isAIConfigured: boolean
}

// Detect query type from SQL
function detectQueryType(sql: string): 'count' | 'aggregate' | 'select' | 'group' {
	const upperSQL = sql.toUpperCase()
	if (upperSQL.includes('GROUP BY')) {
		return 'group'
	}
	if (upperSQL.includes('COUNT(*)') || upperSQL.includes('COUNT(')) {
		return 'count'
	}
	if (upperSQL.includes('AVG(') || upperSQL.includes('SUM(') || upperSQL.includes('MIN(') || upperSQL.includes('MAX(')) {
		return 'aggregate'
	}
	return 'select'
}

// Extract highway type from SQL for user-friendly messages
function extractRoadType(sql: string): string | null {
	const match = sql.match(/highway\s*=\s*['"]([^'"]+)['"]/i)
	return match ? (match[1] ?? null) : null
}

// Detect if a query is in Indonesian
function isIndonesian(query: string): boolean {
	const idKeywords = [
		'berapa', 'jumlah', 'tampilkan', 'cari', 'daftar', 'semua', 'jalan', 'tol',
		'rata-rata', 'panjang', 'terpanjang', 'terpendek', 'ada', 'yang', 'dengan',
		'lebih', 'kurang', 'dari', 'per', 'tipe', 'statistik', 'jalur', 'trotoar',
		'sepeda', 'perumahan', 'utama', 'sekunder', 'tersier', 'setapak', 'tanah',
		'banyak', 'silakan', 'lihat', 'kelompokkan', 'masing',
	]
	const lower = query.toLowerCase()
	return idKeywords.some(k => lower.includes(k))
}

// Format road type for display
function formatRoadType(type: string | null, lang: 'en' | 'id'): string {
	if (!type) return lang === 'id' ? 'jalan' : 'road'

	const typeNames: Record<string, { en: string; id: string }> = {
		'motorway': { en: 'motorway', id: 'jalan tol' },
		'trunk': { en: 'trunk road', id: 'jalan trunk' },
		'primary': { en: 'primary road', id: 'jalan utama' },
		'secondary': { en: 'secondary road', id: 'jalan sekunder' },
		'tertiary': { en: 'tertiary road', id: 'jalan tersier' },
		'residential': { en: 'residential road', id: 'jalan perumahan' },
		'service': { en: 'service road', id: 'jalan service' },
		'unclassified': { en: 'unclassified road', id: 'jalan tak terklasifikasi' },
		'track': { en: 'track', id: 'jalan tanah' },
		'path': { en: 'path', id: 'jalur setapak' },
		'footway': { en: 'footway', id: 'trotoar' },
		'cycleway': { en: 'cycleway', id: 'jalur sepeda' },
		'steps': { en: 'steps', id: 'tangga' },
	}

	return typeNames[type]?.[lang] ?? type
}

// Format result message based on query type with bilingual support
function formatResultMessage(queryType: 'count' | 'aggregate' | 'select' | 'group', results: QueryResults, sql: string, prompt: string): string {
	if (results.error) {
		return `Query failed: ${results.error}`
	}

	const lang = isIndonesian(prompt) ? 'id' : 'en'
	const roadType = formatRoadType(extractRoadType(sql), lang)

	if (queryType === 'count') {
		// Extract count from result - DuckDB might return as 'total', 'count', 'count_star()', etc
		const row = results.sampleData?.[0] as Record<string, number> | undefined
		let count = 0
		if (row) {
			count = row.total ?? row.count ?? row.count_star?.() ?? Object.values(row)[0] ?? 0
		}
		if (lang === 'id') {
			return count === 0 ? `Tidak ditemukan ${roadType}.` : `Ditemukan ${count} ${roadType}.`
		}
		return count === 0 ? `No ${roadType} found.` : `Found ${count} ${roadType}.`
	}

	if (queryType === 'group') {
		const count = results.rowCount
		if (lang === 'id') {
			return count === 0 ? `Tidak ada data yang ditemukan.` : `Menampilkan statistik untuk **${count}** kategori jalan.`
		}
		return count === 0 ? `No data found.` : `Showing statistics for **${count}** road categories.`
	}

	if (queryType === 'aggregate') {
		if (results.sampleData && results.sampleData.length > 0) {
			const row = results.sampleData[0] as Record<string, number | string>
			const entries = Object.entries(row)
				.filter(([key]) => key !== 'id' && key !== 'name' && key !== 'highway')
				.map(([key, value]) => {
					const numVal = Number(value)
					if (!isNaN(numVal)) {
						if (numVal > 1000) {
							return `${key}: ${(numVal / 1000).toFixed(2)} km`
						}
						return `${key}: ${numVal.toFixed(2)}`
					}
					return `${key}: ${value}`
				})
				.join(', ')
			return lang === 'id' ? `Hasil: ${entries}` : `Result: ${entries}`
		}
		return lang === 'id'
			? `Query selesai dengan ${results.rowCount} hasil.`
			: `Query completed with ${results.rowCount} result(s).`
	}

	// For SELECT queries
	if (lang === 'id') {
		if (results.rowCount === 0) return `Tidak ditemukan ${roadType} yang sesuai.`
		if (results.rowCount === 1) return `Ditemukan 1 ${roadType}.`
		return `Ditemukan ${results.rowCount} ${roadType}.`
	}
	if (results.rowCount === 0) return `No matching ${roadType} found.`
	if (results.rowCount === 1) return `Found 1 ${roadType}.`
	return `Found ${results.rowCount} ${roadType}.`
}

export function useAIQuery(): UseAIQueryReturn {
	const store = useAIQueryStore()
	const duckDBState = useDuckDB()
	const { isSynced: isDataReady, isSyncing, useWorkerOnly, progress: syncProgress, statusMessage: syncStatusMessage } = useOsmDuckDBSync()
	const { highlightAndZoom, clearHighlight } = useAIMapHighlight()
	const [isAIConfigured] = useState(true)

	// Execute query on DuckDB or Worker (fallback)
	const executeQuery = useCallback(
		async (sql: string, filter?: QueryFilter): Promise<QueryResults> => {
			const startTime = performance.now()
			
			// Try DuckDB first (for small files only)
			if (duckDBState.duckdb && !duckDBState.isLimited && !useWorkerOnly) {
				try {
					const result = await duckDBState.duckdb.executeQuery(sql)
					
					if (!result.error) {
						return {
							rowCount: result.rows.length,
							executionTime: performance.now() - startTime,
							sampleData: result.rows.slice(0, 10),
							allData: result.rows,
						}
					}
				} catch (e) {
					console.log('[AI Query] DuckDB query failed, trying worker...')
				}
			}
			
			// Fallback to worker query (for large files)
			const remote = getOsmRemote()
			if (!remote) {
				return {
					rowCount: 0,
					executionTime: 0,
					error: 'Query engine not available',
				}
			}
			
			try {
				const worker = remote.getWorker()
				const osmId = useOsmStore.getState().dataset?.osmId
				
				if (!osmId) {
					return {
						rowCount: 0,
						executionTime: 0,
						error: 'No OSM data loaded',
					}
				}

				const datasetFormat = useOsmStore.getState().dataset?.format
				if (datasetFormat && datasetFormat !== 'pbf' && datasetFormat !== 'osm') {
					return {
						rowCount: 0,
						executionTime: 0,
						error: 'AI queries are only available for OSM data (.pbf or .osm). This dataset uses ' + datasetFormat.toUpperCase() + ' format.',
					}
				}

				// Use provided filter or parse from SQL
				const queryFilter = filter || await worker.parseQuery(sql)
				
				// Check if it's a count query
				const upperSQL = sql.toUpperCase()
				if (upperSQL.includes('COUNT(*)')) {
					const count = await worker.executeCount(osmId, queryFilter)
					return {
						rowCount: 1,
						executionTime: performance.now() - startTime,
						sampleData: [{ count }],
						allData: [{ count }],
					}
				}
				
				// Regular query
				const result = await worker.executeQuery(osmId, queryFilter, { limit: 100 })
				
				return {
					rowCount: result.filteredCount,
					executionTime: performance.now() - startTime,
					sampleData: result.rows,
					allData: result.rows,
				}
			} catch (error: any) {
				return {
					rowCount: 0,
					executionTime: performance.now() - startTime,
					error: error.message || 'Query execution failed',
				}
			}
		},
		[duckDBState, useWorkerOnly]
	)

	// Send natural language query - AUTO EXECUTE without confirmation
	const sendQuery = useCallback(
		async (prompt: string) => {
			if (!prompt.trim()) return
			if (!isDataReady) {
				store.addErrorMessage(
				isIndonesian(prompt)
					? 'Silakan load data OSM terlebih dahulu sebelum menggunakan AI Query.'
					: 'Please load OSM data first before using AI Query.'
			)
				return
			}

			// Pre-detect intent for logging/debugging
			const intent = detectQueryIntent(prompt)
			console.log('[AI Query] Detected intent:', intent)

			// Add user message
			store.addUserMessage(prompt)
			store.setCurrentPrompt(prompt)
			store.setStatus('generating')

			try {
				// Generate SQL
				const result = await naturalLanguageToSQL(prompt)

				if (result.error) {
					store.addErrorMessage(result.error)
					store.setStatus('error')
					store.setCurrentSQL(null)
					return
				}

				// Store SQL and auto-execute
				store.setCurrentSQL(result.sql)
				store.setStatus('executing')

				// Detect query type
				const queryType = detectQueryType(result.sql)
				console.log('[AI Query] Query type:', queryType)

				// Auto-execute immediately
				const execResult = await executeQuery(result.sql)

				if (execResult.error) {
					store.addErrorMessage(
					isIndonesian(prompt) ? `Query gagal: ${execResult.error}` : `Query failed: ${execResult.error}`
				)
					store.setStatus('error')
				} else {
					// Format message based on query type
					const summary = formatResultMessage(queryType, execResult, result.sql, prompt)
					
					store.addAssistantMessage(
						summary,
						result.sql,
						execResult
					)
					store.setStatus('completed')
					
					// Highlight and zoom to results on map
					highlightAndZoom(execResult, queryType, result.sql)
				}
			} catch (error) {
				store.addErrorMessage(
				isIndonesian(prompt) ? 'Gagal memproses query. Silakan coba lagi.' : 'Failed to process query. Please try again.'
			)
				store.setStatus('error')
			}
		},
		[store, executeQuery, isDataReady]
	)

	// Clear chat
	const clearChat = useCallback(() => {
		store.clearMessages()
		store.setCurrentSQL(null)
		store.setStatus('idle')
		clearHighlight()
	}, [store, clearHighlight])

	return {
		isOpen: store.isOpen,
		isLoading: store.status === 'generating' || store.status === 'executing',
		status: store.status,
		currentSQL: store.currentSQL,
		messages: store.messages,
		isDataReady,
		isSyncing,
		syncProgress,
		syncStatusMessage,
		toggleOpen: store.toggleOpen,
		sendQuery,
		clearChat,
		isAIConfigured,
	}
}
