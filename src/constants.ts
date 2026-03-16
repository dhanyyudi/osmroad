export const VECTOR_PROTOCOL_NAME = "@osmix/vector"
export const MIN_ZOOM = 2
export const MAX_ZOOM = 22
export const MIN_PICKABLE_ZOOM = 10
export const DEFAULT_ZOOM = 5

export const BASEMAP_DARK =
	"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export interface BasemapOption {
	id: string
	label: string
	url: string
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
	{
		id: "dark-matter",
		label: "Dark Matter",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
	},
	{
		id: "positron",
		label: "Positron",
		url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	},
	{
		id: "voyager",
		label: "Voyager",
		url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
	},
	{
		id: "osm-standard",
		label: "OpenStreetMap",
		url: "",
	},
	{
		id: "dark",
		label: "Dark",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
	},
	{
		id: "light",
		label: "Light",
		url: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
	},
	{
		id: "no-basemap",
		label: "No Basemap",
		url: "",
	},
]
