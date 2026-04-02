import { useMemo, useState } from 'react'
import { AIQueryComposer } from '@/components/ai-query/ai-query-composer'
import { useAIQuery } from '@/hooks/use-ai-query'
import { useIsMobile } from '@/hooks/use-media-query'
import { useOsmStore } from '@/stores/osm-store'
import { SUGGESTION_QUERIES, useAIQueryStore } from '@/stores/ai-query-store'
import { useUIStore } from '@/stores/ui-store'
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react'

function getExampleQueries(history: string[]) {
	return Array.from(new Set([...history.slice(0, 1), ...SUGGESTION_QUERIES])).slice(0, 3)
}

export function AIQueryMapBar() {
	const [input, setInput] = useState('')
	const isMobile = useIsMobile()
	const dataset = useOsmStore((s) => s.dataset)
	const queryHistory = useAIQueryStore((s) => s.queryHistory)
	const openAIPanel = useUIStore((s) => s.openAIPanel)
	const {
		sendQuery,
		isLoading,
		status,
		messages,
		isDataReady,
		isSyncing,
		syncProgress,
		syncStatusMessage,
	} = useAIQuery()

	const isOsmFormat = !dataset?.format || dataset.format === 'pbf' || dataset.format === 'osm'
	const canQuery = isDataReady && isOsmFormat && !isSyncing
	const exampleQueries = useMemo(() => getExampleQueries(queryHistory), [queryHistory])

	const handleSubmit = async (nextQuery?: string) => {
		const query = (nextQuery ?? input).trim()
		if (!query || !canQuery || isLoading) return

		openAIPanel()
		if (!nextQuery) {
			setInput('')
		}
		await sendQuery(query)
	}

	const statusLabel = useMemo(() => {
		if (!dataset) {
			return 'Load an OSM dataset (.pbf or .osm) to unlock AI road queries'
		}

		if (!isOsmFormat) {
			return `AI Query currently supports OSM datasets only. Loaded format: ${dataset.format.toUpperCase()}`
		}

		if (isSyncing) {
			return syncStatusMessage
				? `${syncStatusMessage}${syncProgress > 0 ? ` (${syncProgress}%)` : ''}`
				: 'Preparing dataset for AI query...'
		}

		if (isLoading) {
			return 'Running query and opening AI results...'
		}

		if (messages.length > 0) {
			return 'Ask another question or open the AI panel for previous results'
		}

		return 'Ask about road types, tags, routing insights, or network statistics'
	}, [dataset, isLoading, isOsmFormat, isSyncing, messages.length, syncProgress, syncStatusMessage])

	if (isMobile) {
		return (
			<div className="pointer-events-none absolute inset-x-0 bottom-[max(4rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3">
				<button
					type="button"
					onClick={() => {
						if (canQuery) openAIPanel()
					}}
					disabled={!canQuery}
					className={`pointer-events-auto flex w-full max-w-[15rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors ${
						canQuery
							? 'border-zinc-700/70 bg-zinc-950/80 text-zinc-100 hover:border-zinc-500/80 hover:bg-zinc-900/88'
							: 'border-zinc-800/80 bg-zinc-950/76 text-zinc-500'
					}`}
					aria-label="Open AI query"
				>
					<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${canQuery ? 'border-zinc-700 bg-zinc-900/90 text-zinc-200' : 'border-zinc-800 bg-zinc-900/70 text-zinc-500'}`}>
						{isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">
							{canQuery ? 'Ask AI about roads, tags, or routing' : 'AI query unavailable'}
						</p>
						<p className="mt-0.5 truncate text-xs text-zinc-400">
							{statusLabel}
						</p>
					</div>
					<ArrowUpRight className={`h-4 w-4 shrink-0 ${canQuery ? 'text-zinc-300' : 'text-zinc-600'}`} />
				</button>
			</div>
		)
	}

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-4">
			<div className="pointer-events-auto w-full max-w-[720px]">
				<div className="rounded-[28px] border border-zinc-800/80 bg-zinc-950/38 p-2 backdrop-blur-sm">
					<div className="rounded-[24px] border border-zinc-800/80 bg-zinc-950/58 p-3">
						<div className="mb-3 flex items-center gap-2 px-1">
							<div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/90 text-zinc-200">
								{isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
							</div>
							<div className="min-w-0">
								<p className="text-sm font-medium text-zinc-100">Ask AI</p>
								<p className="truncate text-xs text-zinc-400">{statusLabel}</p>
							</div>
						</div>

						<AIQueryComposer
							value={input}
							onChange={setInput}
							onSubmit={() => handleSubmit()}
							placeholder={canQuery ? 'Ask AI about roads, tags, or routing insights...' : 'Load OSM data to ask AI'}
							disabled={!canQuery}
							isLoading={isLoading}
							variant="map"
						/>

						{canQuery && status === 'idle' && (
							<div className="mt-3 flex flex-wrap gap-2 px-1">
								{exampleQueries.map((query) => (
									<button
										key={query}
										type="button"
										onClick={() => handleSubmit(query)}
										disabled={isLoading}
										className="rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50"
									>
										{query}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
