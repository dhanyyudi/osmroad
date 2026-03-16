import { useMemo } from "react"
import { Layer, Source } from "react-map-gl/maplibre"
import { useSearchStore } from "../../stores/search-store"

export function SearchHighlightLayer() {
	const highlights = useSearchStore((s) => s.highlights)

	const geojson = useMemo(() => {
		const features: GeoJSON.Feature[] = []
		for (const h of highlights) {
			if (h.type === "node" && h.coords.length === 1) {
				features.push({
					type: "Feature",
					properties: { id: h.id, type: h.type, label: h.label },
					geometry: { type: "Point", coordinates: h.coords[0]! },
				})
			} else if (h.coords.length >= 2) {
				features.push({
					type: "Feature",
					properties: { id: h.id, type: h.type, label: h.label },
					geometry: { type: "LineString", coordinates: h.coords },
				})
			}
		}
		return { type: "FeatureCollection" as const, features }
	}, [highlights])

	return (
		<Source id="search-highlights" type="geojson" data={geojson}>
			{/* Highlighted ways — bright red with glow effect */}
			<Layer
				id="search-highlight-lines-glow"
				type="line"
				filter={["==", ["geometry-type"], "LineString"]}
				paint={{
					"line-color": "#ff0000",
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						8,
						6,
						14,
						12,
						18,
						20,
					],
					"line-opacity": 0.3,
				}}
				layout={{ "line-cap": "round", "line-join": "round" }}
			/>
			<Layer
				id="search-highlight-lines"
				type="line"
				filter={["==", ["geometry-type"], "LineString"]}
				paint={{
					"line-color": "#ff2222",
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						8,
						3,
						14,
						5,
						18,
						10,
					],
					"line-opacity": 0.95,
				}}
				layout={{ "line-cap": "round", "line-join": "round" }}
			/>
			{/* Highlighted nodes */}
			<Layer
				id="search-highlight-points"
				type="circle"
				filter={["==", ["geometry-type"], "Point"]}
				paint={{
					"circle-color": "#ff3333",
					"circle-radius": 8,
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 2,
				}}
			/>
		</Source>
	)
}
