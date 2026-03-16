import { create } from "zustand"

interface SearchHighlight {
	id: number
	type: "node" | "way" | "relation"
	coords: Array<[number, number]>
	tags: Record<string, string>
	label: string
}

interface SearchState {
	highlights: SearchHighlight[]
	setHighlights: (highlights: SearchHighlight[]) => void
	clearHighlights: () => void
}

export type { SearchHighlight }

export const useSearchStore = create<SearchState>((set) => ({
	highlights: [],
	setHighlights: (highlights) => set({ highlights }),
	clearHighlights: () => set({ highlights: [] }),
}))
