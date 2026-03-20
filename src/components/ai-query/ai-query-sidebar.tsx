// AI Query Sidebar - Main chat interface for natural language queries
import { useEffect, useRef } from 'react'
import { useAIQuery } from '@/hooks/use-ai-query'
import { useAIQueryStore } from '@/stores/ai-query-store'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { SuggestionChips } from './suggestion-chips'
import { SQLPreview } from './sql-preview'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sparkles, X, Trash2, MessageSquare, AlertCircle } from 'lucide-react'

export function AIQuerySidebar() {
	const {
		isOpen,
		toggleOpen,
		messages,
		status,
		currentSQL,
		isAIConfigured,
		clearChat,
		confirmSQL,
		rejectSQL,
	} = useAIQuery()

	const scrollRef = useRef<HTMLDivElement>(null)

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	// Show warning if AI not configured
	if (!isAIConfigured && isOpen) {
		return (
			<Sheet open={isOpen} onOpenChange={toggleOpen}>
				<SheetContent className="w-[420px] sm:w-[540px] flex flex-col">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<Sparkles className="w-5 h-5 text-primary" />
							AI Query Assistant
						</SheetTitle>
					</SheetHeader>
					<div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
						<AlertCircle className="w-12 h-12 text-muted-foreground" />
						<div>
							<h3 className="font-medium text-lg">AI Not Configured</h3>
							<p className="text-sm text-muted-foreground mt-2">
								To use the AI query feature, please configure your Google AI API key in the environment
								variables.
							</p>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<>
			{/* Floating Button */}
			{!isOpen && (
				<Button
					onClick={toggleOpen}
					className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
					size="icon"
				>
					<MessageSquare className="w-6 h-6" />
				</Button>
			)}

			{/* Sidebar */}
			<Sheet open={isOpen} onOpenChange={toggleOpen}>
				<SheetContent className="w-[420px] sm:w-[540px] flex flex-col p-0">
					{/* Header */}
					<SheetHeader className="px-4 py-3 border-b">
						<div className="flex items-center justify-between">
							<SheetTitle className="flex items-center gap-2 text-base">
								<Sparkles className="w-5 h-5 text-primary" />
								AI Query Assistant
							</SheetTitle>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={clearChat}
									title="Clear chat"
								>
									<Trash2 className="w-4 h-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={toggleOpen}
								>
									<X className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</SheetHeader>

					{/* Messages */}
					<ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
						<div className="space-y-4">
							{messages.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<p className="text-sm">
										Ask questions about your OSM data in natural language.
									</p>
									<p className="text-xs mt-2">
										Examples: "Show primary roads" or "Find roads longer than 5km"
									</p>
								</div>
							) : (
								messages.map((message) => <ChatMessage key={message.id} message={message} />)
							)}

							{/* SQL Preview for confirmation */}
							{status === 'confirming' && currentSQL && (
								<SQLPreview
									sql={currentSQL}
									onConfirm={confirmSQL}
									onReject={rejectSQL}
								/>
							)}
						</div>
					</ScrollArea>

					{/* Suggestion Chips */}
					{status === 'idle' && messages.length === 0 && <SuggestionChips />}

					{/* Input */}
					<div className="border-t p-4">
						<ChatInput />
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}
