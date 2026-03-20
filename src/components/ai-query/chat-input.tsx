// Chat Input Component - User input with send button
import { useState, useRef } from 'react'
import { useAIQuery } from '@/hooks/use-ai-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'

export function ChatInput() {
	const [input, setInput] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { sendQuery, isLoading } = useAIQuery()

	const handleSubmit = async () => {
		if (!input.trim() || isLoading) return

		const query = input.trim()
		setInput('')
		await sendQuery(query)

		// Reset textarea height
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto'
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value)

		// Auto-resize textarea
		const textarea = e.target
		textarea.style.height = 'auto'
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
	}

	return (
		<div className="flex items-end gap-2">
			<Textarea
				ref={textareaRef}
				value={input}
				onChange={handleInputChange}
				onKeyDown={handleKeyDown}
				placeholder="Ask about your data... (e.g., 'Show primary roads')"
				className="min-h-[44px] max-h-[120px] resize-none"
				rows={1}
				disabled={isLoading}
			/>
			<Button
				onClick={handleSubmit}
				disabled={!input.trim() || isLoading}
				size="icon"
				className="h-11 w-11 shrink-0"
			>
				{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
			</Button>
		</div>
	)
}
