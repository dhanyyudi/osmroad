import { create } from "zustand"

export type SidebarTab =
	| "file"
	| "search"
	| "inspect"
	| "edit"
	| "routing"
	| "speed"
	| "layers"
	| "export"

interface LayerVisibility {
	roads: boolean
	nodes: boolean
	speed: boolean
	restrictions: boolean
	access: boolean
}

/** Basemaps considered "light" — UI will switch to light theme */
const LIGHT_BASEMAPS = new Set(["positron", "voyager", "osm-standard", "light"])

export type AppTheme = "dark" | "light"

interface UIState {
	activeTab: SidebarTab
	sidebarOpen: boolean
	layers: LayerVisibility
	basemapId: string
	legendOpen: boolean
	theme: AppTheme

	setActiveTab: (tab: SidebarTab) => void
	toggleSidebar: () => void
	toggleLayer: (layer: keyof LayerVisibility) => void
	setBasemapId: (id: string) => void
	setLegendOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
	activeTab: "file",
	sidebarOpen: true,
	layers: {
		roads: true,
		nodes: true,
		speed: false,
		restrictions: false,
		access: false,
	},
	basemapId: "dark-matter",
	legendOpen: false,
	theme: "dark",

	setActiveTab: (tab) => set({ activeTab: tab }),
	toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
	toggleLayer: (layer) =>
		set((s) => ({
			layers: { ...s.layers, [layer]: !s.layers[layer] },
		})),
	setBasemapId: (id) =>
		set({
			basemapId: id,
			theme: LIGHT_BASEMAPS.has(id) ? "light" : "dark",
		}),
	setLegendOpen: (open) => set({ legendOpen: open }),
}))
