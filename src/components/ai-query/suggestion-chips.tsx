// Suggestion Chips - Quick query buttons for common queries
import { useAIQuery } from '@/hooks/use-ai-query'
import { useAIQueryStore, SUGGESTION_QUERIES } from '@/stores/ai-query-store'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { History, Sparkles } from 'lucide-react'

export function SuggestionChips() {
	const { sendQuery, isLoading } = useAIQuery()
	const queryHistory = useAIQueryStore((state) => state.queryHistory)

	// Combine suggestions with history
	const suggestions = [...queryHistory.slice(0, 3), ...SUGGESTION_QUERIES].slice(0, 8)

	const handleClick = (query: string) => {
		if (!isLoading) {
			sendQuery(query)
		}
	}

	return (
		<div className="border-t px-4 py-3">
			<ScrollArea className="w-full whitespace-nowrap">
				<div className="flex gap-2">
					{suggestions.map((query, index) => {
						const isFromHistory = index < queryHistory.length

						return (
							<Button
								key={`${query}-${index}`}
								variant="outline"
								size="sm"
								onClick={() => handleClick(query)}
								disabled={isLoading}
								className="shrink-0 text-xs h-8"
							>
								{isFromHistory ? (
									<History className="w-3 h-3 mr-1 text-muted-foreground" />
								) : (
									<Sparkles className="w-3 h-3 mr-1 text-primary" />
								)}
								{query.length > 30 ? `${query.slice(0, 30)}...` : query}
							</Button>
						)
					})}
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	)
}
