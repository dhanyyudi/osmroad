import { useEffect, useState, useMemo } from "react"
import { Layer, Source } from "react-map-gl/maplibre"
import { useUIStore } from "../../stores/ui-store"
import { useOsm } from "../../hooks/use-osm"
import { useOsmStore } from "../../stores/osm-store"

interface AccessLayerProps {
	osmId: string
}

export function AccessLayer({ osmId }: AccessLayerProps) {
	const visible = useUIStore((s) => s.layers.access)
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
				const [blockedWays, barriers] = await Promise.all([
					remote.getWorker().getAccessBlockedWays(osmId),
					remote.getWorker().getBarrierNodes(osmId),
				])

				if (cancelled) return

				const features: GeoJSON.Feature[] = []

				for (const way of blockedWays) {
					if (way.coords.length >= 2) {
						features.push({
							type: "Feature",
							properties: {
								entityType: "way",
								id: way.id,
								accessTag: way.accessTag,
							},
							geometry: {
								type: "LineString",
								coordinates: way.coords,
							},
						})
					}
				}

				for (const node of barriers) {
					features.push({
						type: "Feature",
						properties: {
							entityType: "barrier",
							id: node.id,
							barrierType: node.tags.barrier ?? "unknown",
						},
						geometry: {
							type: "Point",
							coordinates: node.coords,
						},
					})
				}

				setGeojson({ type: "FeatureCollection", features })
			} catch (err) {
				console.error("Failed to load access data:", err)
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
		<Source id="access-blocked" type="geojson" data={sourceData}>
			{/* Blocked ways - dashed red */}
			<Layer
				id="access-blocked-ways"
				type="line"
				filter={["==", ["get", "entityType"], "way"]}
				paint={{
					"line-color": "#ef4444",
					"line-width": 3,
					"line-opacity": 0.7,
					"line-dasharray": [2, 2],
				}}
			/>
			{/* Barrier nodes */}
			<Layer
				id="access-barriers"
				type="circle"
				filter={["==", ["get", "entityType"], "barrier"]}
				paint={{
					"circle-color": "#ef4444",
					"circle-radius": 5,
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 1.5,
				}}
			/>
		</Source>
	)
}
