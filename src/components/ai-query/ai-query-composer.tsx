import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Sparkles } from 'lucide-react'

type ComposerVariant = 'sidebar' | 'map'

interface AIQueryComposerProps {
	value: string
	onChange: (value: string) => void
	onSubmit: () => void | Promise<void>
	placeholder: string
	disabled?: boolean
	isLoading?: boolean
	variant?: ComposerVariant
	onFocus?: () => void
}

export function AIQueryComposer({
	value,
	onChange,
	onSubmit,
	placeholder,
	disabled = false,
	isLoading = false,
	variant = 'sidebar',
	onFocus,
}: AIQueryComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		const textarea = textareaRef.current
		if (!textarea) return

		textarea.style.height = 'auto'
		textarea.style.height = `${Math.min(textarea.scrollHeight, variant === 'map' ? 96 : 120)}px`
	}, [value, variant])

	const handleSubmit = () => {
		if (!value.trim() || disabled || isLoading) return
		onSubmit()
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const mapVariant = variant === 'map'

	return (
		<div className={`flex items-end gap-2 ${mapVariant ? 'rounded-[22px] border border-zinc-700/70 bg-zinc-950/78 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl' : ''}`}>
			{mapVariant && (
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/90 text-zinc-300">
					<Sparkles className="h-4 w-4" />
				</div>
			)}

			<Textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				onFocus={onFocus}
				placeholder={placeholder}
				className={mapVariant
					? 'min-h-[48px] max-h-[96px] resize-none border-0 bg-transparent px-0 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0'
					: 'min-h-[44px] max-h-[120px] resize-none'}
				rows={1}
				disabled={disabled || isLoading}
			/>

			<Button
				onClick={handleSubmit}
				disabled={!value.trim() || disabled || isLoading}
				size="icon"
				className={mapVariant
					? 'h-11 w-11 shrink-0 rounded-2xl bg-zinc-100 text-zinc-950 hover:bg-white'
					: 'h-11 w-11 shrink-0'}
			>
				{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
			</Button>
		</div>
	)
}
