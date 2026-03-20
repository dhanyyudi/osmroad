import { create } from "zustand"
import type { Progress } from "@osmix/shared/progress"
import type { OsmDataset, SelectedEntity } from "../types"

interface OsmState {
	dataset: OsmDataset | null
	selectedEntity: SelectedEntity | null
	isLoading: boolean
	progress: Progress | null
	error: string | null
	highlightedWayIds: Set<number> // For AI query results

	setDataset: (dataset: OsmDataset | null) => void
	selectEntity: (entity: SelectedEntity | null) => void
	setLoading: (loading: boolean) => void
	setProgress: (progress: Progress | null) => void
	setError: (error: string | null) => void
	setHighlightedWayIds: (ids: Set<number>) => void
	clearHighlightedWayIds: () => void
}

export const useOsmStore = create<OsmState>((set) => ({
	dataset: null,
	selectedEntity: null,
	isLoading: false,
	progress: null,
	error: null,
	highlightedWayIds: new Set<number>(),

	setDataset: (dataset) => set({ dataset, error: null }),
	selectEntity: (entity) => set({ selectedEntity: entity }),
	setLoading: (isLoading) => set({ isLoading }),
	setProgress: (progress) => set({ progress }),
	setError: (error) => set({ error, isLoading: false }),
	setHighlightedWayIds: (ids) => set({ highlightedWayIds: ids }),
	clearHighlightedWayIds: () => set({ highlightedWayIds: new Set<number>() }),
}))
