// AI Query Hook - Main logic for AI-powered queries
import { useState, useCallback } from 'react'
import { useAIQueryStore, type QueryResults } from '@/stores/ai-query-store'
import { naturalLanguageToSQL } from '@/services/ai/vertex-ai'
import { useDuckDB } from './use-duckdb'
import { useOsmDuckDBSync } from './use-osm-duckdb-sync'

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

	// Actions
	toggleOpen: () => void
	sendQuery: (prompt: string) => Promise<void>
	clearChat: () => void

	// Status
	isAIConfigured: boolean
}

export function useAIQuery(): UseAIQueryReturn {
	const store = useAIQueryStore()
	const duckDBState = useDuckDB()
	const { isSynced: isDataReady, isSyncing } = useOsmDuckDBSync()
	const [isAIConfigured] = useState(true) // Always true with Edge Function

	// Execute SQL on DuckDB
	const executeSQL = useCallback(
		async (sql: string): Promise<QueryResults> => {
			if (!duckDBState.duckdb) {
				return {
					rowCount: 0,
					executionTime: 0,
					error: 'Database not initialized',
				}
			}

			const startTime = performance.now()

			try {
				const result = await duckDBState.duckdb.executeQuery(sql)
				
				if (result.error) {
					return {
						rowCount: 0,
						executionTime: performance.now() - startTime,
						error: result.error,
					}
				}

				return {
					rowCount: result.rows.length,
					executionTime: performance.now() - startTime,
					sampleData: result.rows.slice(0, 5),
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
		[duckDBState]
	)

	// Send natural language query - AUTO EXECUTE without confirmation
	const sendQuery = useCallback(
		async (prompt: string) => {
			if (!prompt.trim()) return
			if (!isDataReady) {
				store.addErrorMessage('Please load OSM data first before using AI Query.')
				return
			}

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

				// Auto-execute immediately
				const execResult = await executeSQL(result.sql)

				if (execResult.error) {
					store.addErrorMessage(`Query failed: ${execResult.error}`)
					store.setStatus('error')
				} else {
					// Show success message with results summary
					const summary = execResult.rowCount > 0
						? `Found ${execResult.rowCount} roads matching your query.`
						: 'No roads found matching your query.'
					
					store.addAssistantMessage(
						summary,
						result.sql,
						execResult
					)
					store.setStatus('completed')
				}
			} catch (error) {
				store.addErrorMessage('Failed to process query. Please try again.')
				store.setStatus('error')
			}
		},
		[store, executeSQL, isDataReady]
	)

	// Clear chat
	const clearChat = useCallback(() => {
		store.clearMessages()
		store.setCurrentSQL(null)
		store.setStatus('idle')
	}, [store])

	return {
		isOpen: store.isOpen,
		isLoading: store.status === 'generating' || store.status === 'executing',
		status: store.status,
		currentSQL: store.currentSQL,
		messages: store.messages,
		isDataReady,
		isSyncing,
		toggleOpen: store.toggleOpen,
		sendQuery,
		clearChat,
		isAIConfigured,
	}
}
