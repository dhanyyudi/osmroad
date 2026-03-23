import { create } from "zustand"
import type { Progress as OsmixProgress } from "@osmix/shared/progress"
import type { OsmDataset, SelectedEntity } from "../types"

// Extended progress type with stages for enhanced UX
export type LoadingStage = 
  | "downloading" 
  | "parsing" 
  | "indexing" 
  | "building-tiles" 
  | "complete"

export interface ExtendedProgress extends OsmixProgress {
	stage?: LoadingStage
	percent?: number
	bytesLoaded?: number
	bytesTotal?: number
	etaSeconds?: number
}

interface OsmState {
	dataset: OsmDataset | null
	selectedEntity: SelectedEntity | null
	isLoading: boolean
	progress: ExtendedProgress | null
	error: string | null
	highlightedWayIds: Set<number> // For AI query results
	vectorTilesLoading: boolean // For vector tile generation progress

	setDataset: (dataset: OsmDataset | null) => void
	selectEntity: (entity: SelectedEntity | null) => void
	setLoading: (loading: boolean) => void
	setProgress: (progress: ExtendedProgress | null) => void
	setError: (error: string | null) => void
	setHighlightedWayIds: (ids: Set<number>) => void
	clearHighlightedWayIds: () => void
	setVectorTilesLoading: (loading: boolean) => void
}

export const useOsmStore = create<OsmState>((set) => ({
	dataset: null,
	selectedEntity: null,
	isLoading: false,
	progress: null,
	error: null,
	highlightedWayIds: new Set<number>(),
	vectorTilesLoading: false,

	setDataset: (dataset) => set({ dataset, error: null, vectorTilesLoading: true }),
	selectEntity: (entity) => set({ selectedEntity: entity }),
	setLoading: (isLoading) => set({ isLoading }),
	setProgress: (progress) => set({ progress }),
	setError: (error) => set({ error, isLoading: false }),
	setHighlightedWayIds: (ids) => set({ highlightedWayIds: ids }),
	clearHighlightedWayIds: () => set({ highlightedWayIds: new Set<number>() }),
	setVectorTilesLoading: (loading) => set({ vectorTilesLoading: loading }),
}))
