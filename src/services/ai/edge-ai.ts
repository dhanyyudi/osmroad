// Edge AI client - Calls the Cloudflare Worker endpoint (POST /api/ai/query)
// This file runs in the browser. There are NO API keys here: the Worker holds
// the provider credential (a SumoPod key, or the Workers AI binding).

import { validatePrompt } from './guardrails'
import { naturalLanguageToSQLLocal } from './local-nl2sql'

export interface NL2SQLResult {
	sql: string
	error?: string
}

// API endpoint (relative, works in both dev and production)
const API_ENDPOINT = '/api/ai/query'

/**
 * Response body of POST /api/ai/query, as implemented in worker/index.ts.
 *
 * Success is `{ sql, success: true, source, model? }`. `source` names whichever
 * backend actually produced the SQL: "sumopod" (OpenAI-compatible provider),
 * "workers-ai" (the Cloudflare binding), or "heuristic" when the Worker
 * substituted its own deterministic fallback.
 *
 * Failure is `{ error, success: false }` with 400 (bad prompt), 403 (origin not
 * allowed), 429 (rate limited), 500 (worker crash) or 503 (no provider produced
 * usable SQL). A failure body is never guaranteed to carry a usable `sql`.
 */
export interface NL2SQLResponse {
	sql?: string
	error?: string
	success?: boolean
	source?: string
	model?: string
}

/**
 * Convert natural language to SQL via the edge Worker.
 *
 * Falls back to the offline parser whenever the Worker cannot answer, so the
 * common questions keep working with no network at all.
 */
export async function naturalLanguageToSQL(query: string): Promise<NL2SQLResult> {
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
			body: JSON.stringify({ prompt: query }),
		})

		const data = (await response.json()) as NL2SQLResponse

		if (!response.ok) {
			// 400 (bad prompt), 403 (origin rejected) and 429 (rate limited) are
			// terminal for this call: the Worker's message is the actionable part,
			// and retrying a rate limit immediately only spends the next window.
			if (response.status === 400 || response.status === 403 || response.status === 429) {
				return {
					sql: '',
					error: data.error ?? `HTTP ${response.status}: ${response.statusText}`,
				}
			}

			// 503 and other 5xx: no provider produced usable SQL. The offline
			// parser still covers the common questions, so degrade instead of
			// surfacing an error the user cannot act on.
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
	} catch (error) {
		console.error('AI query error:', error)

		// Any error - fall back to local parser
		console.log('[AI Query] Network/parse error, using local parser...')
		return naturalLanguageToSQLLocal(query)
	}
}
