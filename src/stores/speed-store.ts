import { create } from "zustand"
import type { SpeedRecord, SpeedStats } from "../types"

interface SpeedState {
	isLoaded: boolean
	fileName: string | null
	stats: SpeedStats | null
	isLoading: boolean
	timebands: number[]
	selectedTimeband: number | null
	/** Map from way_id → SpeedRecord[] (cached for current viewport) */
	speedData: Map<number, SpeedRecord[]>

	setLoaded: (fileName: string, stats: SpeedStats) => void
	setLoading: (loading: boolean) => void
	setTimebands: (timebands: number[]) => void
	setSelectedTimeband: (timeband: number | null) => void
	setSpeedData: (data: Map<number, SpeedRecord[]>) => void
	reset: () => void
}

export const useSpeedStore = create<SpeedState>((set) => ({
	isLoaded: false,
	fileName: null,
	stats: null,
	isLoading: false,
	timebands: [],
	selectedTimeband: null,
	speedData: new Map(),

	setLoaded: (fileName, stats) =>
		set({ isLoaded: true, fileName, stats, isLoading: false }),
	setLoading: (isLoading) => set({ isLoading }),
	setTimebands: (timebands) => set({ timebands }),
	setSelectedTimeband: (selectedTimeband) => set({ selectedTimeband }),
	setSpeedData: (speedData) => set({ speedData }),
	reset: () =>
		set({
			isLoaded: false,
			fileName: null,
			stats: null,
			timebands: [],
			selectedTimeband: null,
			speedData: new Map(),
		}),
}))
