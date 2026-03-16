import { useEffect, useState, useMemo } from "react"
import { Layer, Source } from "react-map-gl/maplibre"
import { useUIStore } from "../../stores/ui-store"
import { useOsm } from "../../hooks/use-osm"
import { useOsmStore } from "../../stores/osm-store"

interface RestrictionLayerProps {
	osmId: string
}

export function RestrictionLayer({ osmId }: RestrictionLayerProps) {
	const visible = useUIStore((s) => s.layers.restrictions)
	const dataset = useOsmStore((s) => s.dataset)
	const { remote } = useOsm()
	const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null)

	useEffect(() => {
		if (!remote || !dataset || !visible) {
			setGeojson(null)
			return
		}

		let cancelled = false
		;(async () => {
			try {
				const restrictions = await remote
					.getWorker()
					.getRestrictions(osmId)

				if (cancelled) return

				const features: GeoJSON.Feature[] = []

				for (const r of restrictions) {
					// "from" way
					if (r.fromWayCoords.length >= 2) {
						features.push({
							type: "Feature",
							properties: {
								role: "from",
								restrictionType: r.tags.restriction ?? "unknown",
								id: r.id,
							},
							geometry: {
								type: "LineString",
								coordinates: r.fromWayCoords,
							},
						})
					}

					// "to" way
					if (r.toWayCoords.length >= 2) {
						features.push({
							type: "Feature",
							properties: {
								role: "to",
								restrictionType: r.tags.restriction ?? "unknown",
								id: r.id,
							},
							geometry: {
								type: "LineString",
								coordinates: r.toWayCoords,
							},
						})
					}

					// "via" node
					if (r.viaCoords) {
						features.push({
							type: "Feature",
							properties: {
								role: "via",
								restrictionType: r.tags.restriction ?? "unknown",
								id: r.id,
							},
							geometry: {
								type: "Point",
								coordinates: r.viaCoords,
							},
						})
					}
				}

				setGeojson({
					type: "FeatureCollection",
					features,
				})
			} catch (err) {
				console.error("Failed to load restrictions:", err)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [remote, dataset, osmId, visible])

	const sourceData = useMemo(
		() => geojson ?? { type: "FeatureCollection" as const, features: [] },
		[geojson],
	)

	if (!visible) return null

	return (
		<Source id="restrictions" type="geojson" data={sourceData}>
			{/* From way (orange) */}
			<Layer
				id="restrictions-from"
				type="line"
				filter={["==", ["get", "role"], "from"]}
				paint={{
					"line-color": "#f59e0b",
					"line-width": 4,
					"line-opacity": 0.8,
				}}
				layout={{ "line-cap": "round" }}
			/>
			{/* To way (red) */}
			<Layer
				id="restrictions-to"
				type="line"
				filter={["==", ["get", "role"], "to"]}
				paint={{
					"line-color": "#ef4444",
					"line-width": 4,
					"line-opacity": 0.8,
				}}
				layout={{ "line-cap": "round" }}
			/>
			{/* Via node */}
			<Layer
				id="restrictions-via"
				type="circle"
				filter={["==", ["get", "role"], "via"]}
				paint={{
					"circle-color": "#ef4444",
					"circle-radius": 8,
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 2,
				}}
			/>
			{/* Via label */}
			<Layer
				id="restrictions-via-label"
				type="symbol"
				filter={["==", ["get", "role"], "via"]}
				layout={{
					"text-field": [
						"match",
						["get", "restrictionType"],
						"no_left_turn",
						"L",
						"no_right_turn",
						"R",
						"no_u_turn",
						"U",
						"no_straight_on",
						"S",
						"only_left_turn",
						"l",
						"only_right_turn",
						"r",
						"only_straight_on",
						"s",
						"X",
					],
					"text-size": 10,
					"text-font": ["Open Sans Bold"],
					"text-allow-overlap": true,
				}}
				paint={{
					"text-color": "#ffffff",
				}}
			/>
		</Source>
	)
}
