// Edge AI client - Calls the Cloudflare Worker endpoint (POST /api/ai/query)
// This file runs in browser, NO API keys here! The Worker holds the AI binding.

import { validatePrompt } from './guardrails'
import { naturalLanguageToSQLLocal } from './local-nl2sql'

export interface NL2SQLResult {
	sql: string
	error?: string
}

export interface QueryHistoryItem {
	role: 'user' | 'assistant'
	content: string
}

// API endpoint (relative, works in both dev and production)
const API_ENDPOINT = '/api/ai/query'

/**
 * Response body of POST /api/ai/query, as implemented in worker/index.ts.
 *
 * Success is `{ sql, success: true, source, model? }`: `source` is "workers-ai"
 * when the model produced the SQL and "heuristic" when the Worker substituted
 * its own deterministic fallback.
 *
 * Failure is `{ error, success: false }` with 400 (bad prompt), 429 (rate
 * limited), 500 (worker crash) or 503 (model produced nothing usable). A
 * failure body is never guaranteed to carry a usable `sql`.
 */
export interface NL2SQLResponse {
	sql?: string
	error?: string
	success?: boolean
	source?: 'workers-ai' | 'heuristic'
	model?: string
}

/**
 * Check if AI is configured (always true for the Worker approach)
 */
export function isAIReady(): boolean {
	return true // The Worker handles the configuration
}

/**
 * Initialize AI (no-op for the Worker approach)
 */
export function initAI(): boolean {
	return true
}

/**
 * Convert natural language to SQL via the edge Worker
 */
export async function naturalLanguageToSQL(
	query: string,
	history?: QueryHistoryItem[]
): Promise<NL2SQLResult> {
	// Validate prompt client-side (double protection)
	const validation = validatePrompt(query)
	if (!validation.valid) {
		return { sql: '', error: validation.reason }
	}

	try {
		const response = await fetch(API_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: query,
				history,
			}),
		})

		const data = (await response.json()) as NL2SQLResponse

		if (!response.ok) {
			// 400 (bad prompt) and 429 (rate limited) are terminal for this call:
			// the Worker's message is the actionable part, and retrying a rate
			// limit immediately would only spend the next window.
			if (response.status === 400 || response.status === 429) {
				return {
					sql: '',
					error: data.error ?? `HTTP ${response.status}: ${response.statusText}`,
				}
			}

			// 503 and other 5xx: the model was unavailable or returned nothing
			// usable. The offline parser still covers the common questions, so
			// degrade instead of surfacing an error the user cannot act on.
			console.log('[AI Query] Edge AI unavailable, using local parser...')
			return naturalLanguageToSQLLocal(query)
		}

		// A 200 can still carry `success: false` with an error and no usable SQL.
		if (data.success === false) {
			return {
				sql: '',
				error: data.error ?? 'AI query failed',
			}
		}

		if (typeof data.sql !== 'string' || data.sql.length === 0) {
			return {
				sql: '',
				error: data.error ?? 'No SQL returned from server',
			}
		}

		return { sql: data.sql }
	} catch (error: any) {
		console.error('AI query error:', error)

		// Any error - fall back to local parser
		console.log('[AI Query] Network/parse error, using local parser...')
		return naturalLanguageToSQLLocal(query)
	}
}

/**
 * Retry SQL generation with error correction (simplified version)
 */
export async function correctSQL(
	originalQuery: string,
	failedSQL: string,
	errorMessage: string
): Promise<NL2SQLResult> {
	// Build a correction prompt
	const correctionPrompt = `The following SQL query failed:

Original request: "${originalQuery}"
Generated SQL: ${failedSQL}
Error: ${errorMessage}

Please fix the SQL query.`

	return naturalLanguageToSQL(correctionPrompt)
}

// Query stats (client-side tracking)
export interface QueryStats {
	queriesToday: number
	totalTokens: number
	estimatedCost: number
}

const stats: QueryStats = {
	queriesToday: 0,
	totalTokens: 0,
	estimatedCost: 0,
}

export function getQueryStats(): QueryStats {
	return { ...stats }
}

export function resetQueryStats(): void {
	stats.queriesToday = 0
	stats.totalTokens = 0
	stats.estimatedCost = 0
}

/**
 * A nominal per-1K-character figure, NOT derived from Workers AI pricing.
 *
 * The endpoint runs at most two Workers AI models
 * (@cf/qwen/qwen2.5-coder-32b-instruct, falling back to
 * @cf/meta/llama-3.1-8b-instruct-fp8), which are billed per neuron rather than
 * per character, so a token count cannot be converted to currency honestly.
 * This exists only to keep the shape of the counter and is explicitly unreliable.
 */
const NOMINAL_COST_PER_1K_CHARS = 0.000001

export function trackQuery(tokensUsed: number): void {
	stats.queriesToday++
	stats.totalTokens += tokensUsed
	stats.estimatedCost += (tokensUsed / 1000) * NOMINAL_COST_PER_1K_CHARS
}
