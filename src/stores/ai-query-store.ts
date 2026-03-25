// AI Query Store - Zustand state management
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MessageRole = 'user' | 'assistant' | 'system' | 'error'

export interface QueryMessage {
	id: string
	role: MessageRole
	content: string
	timestamp: Date
	sql?: string // For assistant messages with SQL
	results?: QueryResults // Query execution results
}

export interface QueryResults {
	rowCount: number
	executionTime: number
	sampleData?: unknown[]
	allData?: unknown[]
	error?: string
}

export type QueryStatus = 'idle' | 'generating' | 'confirming' | 'executing' | 'completed' | 'error'

interface AIQueryState {
	// UI State
	isOpen: boolean
	isMinimized: boolean

	// Messages
	messages: QueryMessage[]

	// Current Query State
	status: QueryStatus
	currentSQL: string | null
	currentPrompt: string | null

	// History
	queryHistory: string[]

	// Actions
	setOpen: (open: boolean) => void
	toggleOpen: () => void
	setMinimized: (minimized: boolean) => void

	// Message Actions
	addMessage: (message: Omit<QueryMessage, 'id' | 'timestamp'>) => void
	addUserMessage: (content: string) => void
	addAssistantMessage: (content: string, sql?: string) => void
	addSystemMessage: (content: string) => void
	addErrorMessage: (content: string) => void
	clearMessages: () => void

	// Query Actions
	setStatus: (status: QueryStatus) => void
	setCurrentSQL: (sql: string | null) => void
	setCurrentPrompt: (prompt: string | null) => void
	confirmSQL: () => void
	rejectSQL: () => void
	addToHistory: (prompt: string) => void
	setQueryResults: (messageId: string, results: QueryResults) => void
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15)

export const useAIQueryStore = create<AIQueryState>()(
	persist(
		(set, get) => ({
			// Initial State
			isOpen: false,
			isMinimized: false,
			messages: [],
			status: 'idle',
			currentSQL: null,
			currentPrompt: null,
			queryHistory: [],

			// UI Actions
			setOpen: (open) => set({ isOpen: open }),
			toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
			setMinimized: (minimized) => set({ isMinimized: minimized }),

			// Message Actions
			addMessage: (message) =>
				set((state) => ({
					messages: [
						...state.messages,
						{
							...message,
							id: generateId(),
							timestamp: new Date(),
						},
					],
				})),

			addUserMessage: (content) =>
				get().addMessage({ role: 'user', content }),

			addAssistantMessage: (content, sql, results) =>
				get().addMessage({ role: 'assistant', content, sql, results }),

			addSystemMessage: (content) =>
				get().addMessage({ role: 'system', content }),

			addErrorMessage: (content) =>
				get().addMessage({ role: 'error', content }),

			clearMessages: () => set({ messages: [] }),

			// Query Actions
			setStatus: (status) => set({ status }),
			setCurrentSQL: (sql) => set({ currentSQL: sql }),
			setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),

			confirmSQL: () => {
				const { currentPrompt } = get()
				if (currentPrompt) {
					get().addToHistory(currentPrompt)
				}
				set({ status: 'executing' })
			},

			rejectSQL: () => {
				set({ currentSQL: null, status: 'idle' })
			},

			addToHistory: (prompt) =>
				set((state) => ({
					queryHistory: [prompt, ...state.queryHistory].slice(0, 50), // Keep last 50
				})),

			setQueryResults: (messageId, results) =>
				set((state) => ({
					messages: state.messages.map((msg) =>
						msg.id === messageId ? { ...msg, results } : msg
					),
					status: results.error ? 'error' : 'completed',
				})),
		}),
		{
			name: 'osmroad-ai-query-storage',
			partialize: (state) => ({
				queryHistory: state.queryHistory,
				// Don't persist messages or current state
			}),
		}
	)
)

// Suggestion queries for quick access
export const SUGGESTION_QUERIES = [
	'Show all primary roads',
	'Find roads longer than 5km',
	'Show traffic lights',
	'Count roads by type',
	'Find unnamed roads',
	'Average road length',
	'Find one-way streets',
	'Show residential roads',
] as const
