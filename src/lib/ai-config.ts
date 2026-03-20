// AI Query Configuration
// Security: Service account JSON stored in environment variables only

export const AI_CONFIG = {
	// Vertex AI Configuration
	projectId: import.meta.env.VITE_GOOGLE_PROJECT_ID || 'clean-respect-484413-u9',
	location: import.meta.env.VITE_GOOGLE_LOCATION || 'us-central1',
	model: 'gemini-2.0-flash-001', // Using stable version first, can upgrade to 3-flash later

	// Generation Parameters
	generationConfig: {
		temperature: 0.1, // Low for deterministic SQL
		maxOutputTokens: 1024,
		topP: 0.95,
		topK: 40,
	},

	// Safety Settings
	safetySettings: [
		{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM' },
		{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM' },
		{ category: 'HARM_CATEGORY_SEXUAL', threshold: 'BLOCK_MEDIUM' },
		{ category: 'HARM_CATEGORY_DANGEROUS', threshold: 'BLOCK_MEDIUM' },
	],

	// Rate Limiting
	rateLimit: {
		maxQueriesPerMinute: 10,
		maxPromptLength: 1000,
	},

	// Result Limits
	queryLimits: {
		maxResults: 10000,
		maxExecutionTime: 5000, // 5 seconds
	},
} as const

// Check if AI is enabled
export const isAIEnabled = !!import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON

// Service Account JSON (from environment)
export const getServiceAccountJSON = (): object | null => {
	const json = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON
	if (!json) return null
	try {
		return JSON.parse(json)
	} catch {
		console.error('Invalid service account JSON')
		return null
	}
}
