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
	/**
	 * True once a tag edit has been applied to the in-memory dataset.
	 *
	 * Edits live only in the worker's Osm index until the user exports a PBF, so
	 * unloading a dataset throws them away. This flag is what makes the unload
	 * button ask before doing that.
	 */
	hasEdits: boolean

	setDataset: (dataset: OsmDataset | null) => void
	selectEntity: (entity: SelectedEntity | null) => void
	setLoading: (loading: boolean) => void
	setProgress: (progress: ExtendedProgress | null) => void
	setError: (error: string | null) => void
	setHighlightedWayIds: (ids: Set<number>) => void
	clearHighlightedWayIds: () => void
	setVectorTilesLoading: (loading: boolean) => void
	markEdited: () => void
	/** Drop the loaded dataset and everything the UI derived from it. */
	resetDataset: () => void
}

export const useOsmStore = create<OsmState>((set) => ({
	dataset: null,
	selectedEntity: null,
	isLoading: false,
	progress: null,
	error: null,
	highlightedWayIds: new Set<number>(),
	vectorTilesLoading: false,
	hasEdits: false,

	// A fresh dataset starts clean; the previous dataset's edits are gone.
	setDataset: (dataset) => set({ dataset, error: null, vectorTilesLoading: true, hasEdits: false }),
	selectEntity: (entity) => set({ selectedEntity: entity }),
	setLoading: (isLoading) => set({ isLoading }),
	setProgress: (progress) => set({ progress }),
	setError: (error) => set({ error, isLoading: false }),
	setHighlightedWayIds: (ids) => set({ highlightedWayIds: ids }),
	clearHighlightedWayIds: () => set({ highlightedWayIds: new Set<number>() }),
	setVectorTilesLoading: (loading) => set({ vectorTilesLoading: loading }),
	markEdited: () => set({ hasEdits: true }),
	resetDataset: () =>
		set({
			dataset: null,
			selectedEntity: null,
			isLoading: false,
			progress: null,
			error: null,
			highlightedWayIds: new Set<number>(),
			vectorTilesLoading: false,
			hasEdits: false,
		}),
}))
