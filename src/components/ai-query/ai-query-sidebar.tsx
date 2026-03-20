// AI Query Sidebar - DEPRECATED: Now integrated into main sidebar
// This component is kept for backward compatibility but no longer renders floating button
// Use AIQueryPanel in sidebar instead

import { useEffect, useRef } from 'react'
import { useAIQuery } from '@/hooks/use-ai-query'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { SuggestionChips } from './suggestion-chips'
import { SQLPreview } from './sql-preview'
import { Sparkles, X, Trash2 } from 'lucide-react'

/** 
 * @deprecated Use AIQueryPanel in the main sidebar instead
 */
export function AIQuerySidebar() {
	const {
		isOpen,
		toggleOpen,
		messages,
		status,
		currentSQL,
		clearChat,
		confirmSQL,
		rejectSQL,
	} = useAIQuery()

	const scrollRef = useRef<HTMLDivElement>(null)

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	// This component no longer renders anything
	// The AI Query feature is now integrated into the main sidebar
	return null
}
