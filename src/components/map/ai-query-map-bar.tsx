import { useCallback, useEffect, useMemo, useState } from 'react'
import { AIQueryComposer } from '@/components/ai-query/ai-query-composer'
import { useAIQuery } from '@/hooks/use-ai-query'
import { isOsmBackedFormat, OSM_BACKED_FORMAT_LABEL } from '@/lib/format-converter'
import { useIsMobile } from '@/hooks/use-media-query'
import { useOsmStore } from '@/stores/osm-store'
import { SUGGESTION_QUERIES, useAIQueryStore } from '@/stores/ai-query-store'
import { useUIStore } from '@/stores/ui-store'
import { ArrowUpRight, ChevronDown, Loader2, Sparkles } from 'lucide-react'

/** How long the expanded panel may sit untouched before collapsing to the pill. */
const IDLE_COLLAPSE_MS = 20_000

const PREFERENCE_KEY = 'osmroad:ai-query-bar'

type BarPreference = 'expanded' | 'collapsed'

/**
 * The bar remembers only an explicit choice.
 *
 * Auto-collapse is deliberately session-only: it happens because you stopped
 * looking at the bar, not because you decided you never want it. So walking away
 * does not rewrite the preference — clicking the pill or the chevron does.
 */
function readPreference(): BarPreference {
	try {
		return window.localStorage.getItem(PREFERENCE_KEY) === 'collapsed' ? 'collapsed' : 'expanded'
	} catch {
		// Private mode / storage disabled — fall back to the discoverable default.
		return 'expanded'
	}
}

function writePreference(preference: BarPreference): void {
	try {
		window.localStorage.setItem(PREFERENCE_KEY, preference)
	} catch {
		// Not fatal: the bar simply will not remember the choice.
	}
}

function getExampleQueries(history: string[]) {
	return Array.from(new Set([...history.slice(0, 1), ...SUGGESTION_QUERIES])).slice(0, 3)
}

export function AIQueryMapBar() {
	const [input, setInput] = useState('')
	const [expanded, setExpanded] = useState(() => readPreference() === 'expanded')
	/** Hover or focus inside the panel pauses auto-collapse. */
	const [interacting, setInteracting] = useState(false)

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

	const isOsmFormat = isOsmBackedFormat(dataset?.format)
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

	// Expanding by hand is an explicit "I want this here"; closing by hand is an
	// explicit "keep it out of the way". Both outlive the session.
	const expand = useCallback(() => {
		setExpanded(true)
		writePreference('expanded')
	}, [])

	const collapse = useCallback((remember: boolean) => {
		setExpanded(false)
		setInteracting(false)
		if (remember) writePreference('collapsed')
	}, [])

	// Auto-collapse. Skipped while a query runs, while a draft exists (collapsing
	// would hide a half-written question), and while the pointer or focus is on
	// the panel. Any of those changing restarts the timer.
	useEffect(() => {
		if (isMobile || !expanded) return
		if (isLoading || input.trim().length > 0 || interacting) return

		const timer = window.setTimeout(() => setExpanded(false), IDLE_COLLAPSE_MS)
		return () => window.clearTimeout(timer)
	}, [expanded, isMobile, isLoading, input, interacting])

	const statusLabel = useMemo(() => {
		if (!dataset) {
			return `Load an OSM dataset (${OSM_BACKED_FORMAT_LABEL}) to unlock AI road queries`
		}

		if (!isOsmFormat) {
			return `AI Query supports OSM-backed datasets only (${OSM_BACKED_FORMAT_LABEL}). Loaded format: ${dataset.format.toUpperCase()}`
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

	const busy = isSyncing || isLoading
	// A dataset that AI cannot use is worth flagging while the bar is collapsed —
	// otherwise the reason lives in a status line nobody can see.
	const unsupportedDataset = Boolean(dataset) && !isOsmFormat

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
			{expanded ? (
				<div
					onMouseEnter={() => setInteracting(true)}
					onMouseLeave={() => setInteracting(false)}
					onFocusCapture={() => setInteracting(true)}
					onBlurCapture={() => setInteracting(false)}
					className="pointer-events-auto w-full max-w-[720px]"
				>
					<div className="rounded-[28px] border border-zinc-800/80 bg-zinc-950/38 p-2 backdrop-blur-sm">
						<div className="rounded-[24px] border border-zinc-800/80 bg-zinc-950/58 p-3">
							<div className="mb-3 flex items-center gap-2 px-1">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/90 text-zinc-200">
									{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-zinc-100">Ask AI</p>
									<p className="truncate text-xs text-zinc-400">{statusLabel}</p>
								</div>
								<button
									type="button"
									onClick={() => collapse(true)}
									title="Collapse — the bar stays out of the way until you reopen it"
									aria-label="Collapse AI query bar"
									className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
								>
									<ChevronDown className="h-4 w-4" />
								</button>
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
			) : (
				<button
					type="button"
					onClick={expand}
					aria-expanded={false}
					aria-label="Expand AI query bar"
					className={`pointer-events-auto flex w-full max-w-[22rem] items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors ${
						canQuery
							? 'border-zinc-700/70 bg-zinc-950/80 hover:border-zinc-500/80 hover:bg-zinc-900/88'
							: 'border-zinc-800/80 bg-zinc-950/76'
					}`}
				>
					<span
						className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${
							canQuery ? 'border-zinc-700 bg-zinc-900/90 text-zinc-200' : 'border-zinc-800 bg-zinc-900/70 text-zinc-500'
						}`}
					>
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
					</span>

					<span className="min-w-0 flex-1">
						<span className={`block text-sm font-medium ${canQuery ? 'text-zinc-100' : 'text-zinc-400'}`}>
							Ask AI
						</span>
						<span className="mt-0.5 block truncate text-xs text-zinc-400">{statusLabel}</span>
					</span>

					{unsupportedDataset && (
						<span
							title={statusLabel}
							className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
							aria-hidden="true"
						/>
					)}
					<ArrowUpRight className={`h-4 w-4 shrink-0 ${canQuery ? 'text-zinc-300' : 'text-zinc-600'}`} />
				</button>
			)}
		</div>
	)
}
