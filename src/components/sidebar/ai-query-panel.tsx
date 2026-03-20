import { useEffect, useRef } from 'react'
import { useAIQuery } from '@/hooks/use-ai-query'
import { ChatMessage } from '../ai-query/chat-message'
import { ChatInput } from '../ai-query/chat-input'
import { SuggestionChips } from '../ai-query/suggestion-chips'
import { SQLPreview } from '../ai-query/sql-preview'
import { Sparkles, Trash2 } from 'lucide-react'

export function AIQueryPanel() {
	const {
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

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
				<div className="flex items-center gap-2">
					<Sparkles className="w-4 h-4 text-purple-400" />
					<span className="text-sm font-medium text-zinc-200">Ask AI</span>
				</div>
				{messages.length > 0 && (
					<button
						onClick={clearChat}
						className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
						title="Clear chat"
					>
						<Trash2 className="w-3.5 h-3.5 text-zinc-500" />
					</button>
				)}
			</div>

			{/* Messages */}
			<div 
				ref={scrollRef}
				className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
			>
				{messages.length === 0 ? (
					<div className="text-center py-6 text-zinc-500">
						<div className="flex justify-center mb-3">
							<Sparkles className="w-8 h-8 text-purple-500/50" />
						</div>
						<p className="text-sm">
							Ask questions about your OSM data in natural language.
						</p>
						<p className="text-xs mt-2 text-zinc-600">
							Examples: "Show primary roads" or "Find roads longer than 5km"
						</p>
					</div>
				) : (
					messages.map((message) => (
						<ChatMessage key={message.id} message={message} />
					))
				)}

				{/* SQL Preview */}
				{status === 'confirming' && currentSQL && (
					<SQLPreview
						sql={currentSQL}
						onConfirm={confirmSQL}
						onReject={rejectSQL}
					/>
				)}
			</div>

			{/* Suggestions */}
			{status === 'idle' && messages.length === 0 && (
				<div className="border-t border-zinc-800 px-3 py-2">
					<p className="text-[10px] text-zinc-600 mb-2">Suggestions:</p>
					<SuggestionChips />
				</div>
			)}

			{/* Input */}
			<div className="border-t border-zinc-800 p-3">
				<ChatInput />
			</div>
		</div>
	)
}
