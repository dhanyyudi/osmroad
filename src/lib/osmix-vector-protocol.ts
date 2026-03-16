import type { Tile } from "@osmix/shared/types"
import maplibre from "maplibre-gl"
import { VECTOR_PROTOCOL_NAME } from "../constants"
import { getOsmRemote } from "../hooks/use-osm"

const VECTOR_URL_PATTERN =
	/^@osmix\/vector:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.mvt$/

let registered = false

export function osmixIdToTileUrl(osmId: string) {
	return `${VECTOR_PROTOCOL_NAME}://${encodeURIComponent(osmId)}/{z}/{x}/{y}.mvt`
}

export function addOsmixVectorProtocol() {
	if (registered) return
	maplibre.addProtocol(
		VECTOR_PROTOCOL_NAME,
		async (
			req,
			abortController,
		): Promise<maplibregl.GetResourceResponse<ArrayBuffer | null>> => {
			const match = VECTOR_URL_PATTERN.exec(req.url)
			if (!match) throw new Error(`Bad @osmix/vector URL: ${req.url}`)
			const [, osmId, zStr, xStr, yStr] = match
			const tileIndex: Tile = [+xStr!, +yStr!, +zStr!]
			const remote = getOsmRemote()
			if (!remote || abortController.signal.aborted) return { data: null }
			const data = await remote.getVectorTile(
				decodeURIComponent(osmId!),
				tileIndex,
			)

			return {
				data: abortController.signal.aborted ? null : data,
				cacheControl: "max-age=3600",
			}
		},
	)
	registered = true
}

export function removeOsmixVectorProtocol() {
	if (!registered) return
	maplibre.removeProtocol(VECTOR_PROTOCOL_NAME)
	registered = false
}
