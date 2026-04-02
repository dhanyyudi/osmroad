// Chat Input Component - User input with send button
import { useState } from 'react'
import { useAIQuery } from '@/hooks/use-ai-query'
import { AIQueryComposer } from './ai-query-composer'

export function ChatInput() {
	const [input, setInput] = useState('')
	const { sendQuery, isLoading } = useAIQuery()

	const handleSubmit = async () => {
		if (!input.trim() || isLoading) return

		const query = input.trim()
		setInput('')
		await sendQuery(query)
	}

	return (
		<AIQueryComposer
			value={input}
			onChange={setInput}
			onSubmit={handleSubmit}
			placeholder="Ask about your data... (e.g., 'Show primary roads')"
			isLoading={isLoading}
			variant="sidebar"
		/>
	)
}
