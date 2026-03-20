// Vertex AI / Gemini API Service
// Client-side implementation using Google Generative AI SDK

import { GoogleGenerativeAI, type GenerationConfig, type SafetySetting } from '@google/generative-ai'
import { AI_CONFIG, isAIEnabled } from '@/lib/ai-config'
import { buildPrompt, buildCorrectionPrompt } from './prompt-builder'
import { validatePrompt, validateSQL, sanitizeSQL, ensureLimit, checkRateLimit, type ValidationResult } from './guardrails'

// API Key from environment (Google AI Studio key for client-side)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

// Initialize Gemini API client
let genAI: GoogleGenerativeAI | null = null
let model: any = null

/**
 * Initialize the AI client
 */
export function initAI(): boolean {
	if (!API_KEY) {
		console.warn('Gemini API key not configured')
		return false
	}

	try {
		genAI = new GoogleGenerativeAI(API_KEY)
		model = genAI.getGenerativeModel({
			model: AI_CONFIG.model,
			generationConfig: AI_CONFIG.generationConfig as GenerationConfig,
			safetySettings: AI_CONFIG.safetySettings as SafetySetting[],
		})
		console.log('AI client initialized with model:', AI_CONFIG.model)
		return true
	} catch (error) {
		console.error('Failed to initialize AI client:', error)
		return false
	}
}

/**
 * Check if AI is ready
 */
export function isAIReady(): boolean {
	return !!model
}

export interface NL2SQLResult {
	sql: string
	explanation?: string
	error?: string
}

/**
 * Convert natural language to SQL
 */
export async function naturalLanguageToSQL(query: string): Promise<NL2SQLResult> {
	// Check if AI is enabled
	if (!isAIReady()) {
		return { sql: '', error: 'AI not configured. Please add API key.' }
	}

	// Rate limiting
	const rateCheck = checkRateLimit()
	if (!rateCheck.valid) {
		return { sql: '', error: rateCheck.reason }
	}

	// Validate prompt
	const promptCheck = validatePrompt(query)
	if (!promptCheck.valid) {
		return { sql: '', error: promptCheck.reason }
	}

	try {
		// Build prompt
		const prompt = buildPrompt(query)

		// Call Gemini API
		const result = await model.generateContent(prompt)
		const response = await result.response
		const text = response.text()

		// Extract SQL from response
		let sql = text.trim()

		// Remove markdown code blocks if present
		sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()

		// Validate generated SQL
		const sqlCheck = validateSQL(sql)
		if (!sqlCheck.valid) {
			return { sql: '', error: sqlCheck.reason }
		}

		// Sanitize and add limit
		sql = sanitizeSQL(sql)
		sql = ensureLimit(sql, AI_CONFIG.queryLimits.maxResults)

		return { sql }
	} catch (error: any) {
		console.error('AI generation error:', error)

		// Handle specific errors
		if (error.message?.includes('429')) {
			return { sql: '', error: 'API rate limit reached. Please try again in a moment.' }
		}

		if (error.message?.includes('401') || error.message?.includes('403')) {
			return { sql: '', error: 'API authentication failed. Please check your API key.' }
		}

		return { sql: '', error: `AI generation failed: ${error.message || 'Unknown error'}` }
	}
}

/**
 * Retry SQL generation with error correction
 */
export async function correctSQL(
	originalQuery: string,
	failedSQL: string,
	errorMessage: string
): Promise<NL2SQLResult> {
	if (!isAIReady()) {
		return { sql: '', error: 'AI not configured' }
	}

	try {
		const prompt = buildCorrectionPrompt(originalQuery, failedSQL, errorMessage)

		const result = await model.generateContent(prompt)
		const response = await result.response
		const text = response.text()

		let sql = text.trim().replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()

		const sqlCheck = validateSQL(sql)
		if (!sqlCheck.valid) {
			return { sql: '', error: sqlCheck.reason }
		}

		sql = sanitizeSQL(sql)
		sql = ensureLimit(sql, AI_CONFIG.queryLimits.maxResults)

		return { sql }
	} catch (error: any) {
		console.error('SQL correction error:', error)
		return { sql: '', error: `Correction failed: ${error.message || 'Unknown error'}` }
	}
}

/**
 * Get query statistics for cost tracking
 */
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

// Track stats on each query
export function trackQuery(tokensUsed: number): void {
	stats.queriesToday++
	stats.totalTokens += tokensUsed
	// Gemini 2.0 Flash: ~$0.000004 per 1K characters (approximate)
	stats.estimatedCost += (tokensUsed / 1000) * 0.000004
}
