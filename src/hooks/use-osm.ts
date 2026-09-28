import { useEffect, useState } from "react"
import type { OsmInfo } from "@osmix/core"
import * as Comlink from "comlink"
import type { Progress } from "@osmix/shared/progress"
import type {
	QueryFilter,
	QueryOptions,
	QueryResult,
	RoadRecord,
} from "../workers/query-processor"
import { useOsmStore, type ExtendedProgress, type LoadingStage } from "../stores/osm-store"

type AggregateOp = "sum" | "avg" | "min" | "max"
type AggregateField = "length_meters"

/**
 * The main thread talks to the worker through Comlink only.
 *
 * It deliberately does NOT import `osmix` here: that package's entry point
 * re-exports every @osmix/* subpackage (pbf, vt, raster, router, change,
 * geoparquet, shapefile, gtfs…) plus the worker implementation, which pulled
 * roughly a third of the production bundle onto the main thread for a class
 * whose methods this file overrode anyway. Only `OsmInfo` is imported, and only
 * as a type, so it is erased at build time.
 */

export interface GeoParquetExportOptions {
	/** Export only highway ways instead of every way. Defaults to true. */
	roadsOnly?: boolean
	/** Include tagged standalone nodes as Point features. Defaults to true. */
	includeNodes?: boolean
	compression?: "SNAPPY" | "UNCOMPRESSED" | "GZIP"
}

export interface GeoParquetExportResult {
	bytes: Uint8Array
	rowCount: number
	skipped: number
}

// ── Domain shapes returned by the worker ─────────────────────────────────────
// Declared structurally so the main thread never has to import osmix.

export interface WorkerOsmEntity {
	id: number
	tags?: Record<string, string>
	/** Present on node results only. */
	lon?: number
	lat?: number
}

export interface SearchHits {
	nodes: WorkerOsmEntity[]
	ways: WorkerOsmEntity[]
	relations: WorkerOsmEntity[]
}

export interface RestrictionRecord {
	id: number
	tags: Record<string, string>
	members: Array<{ type: "node" | "way" | "relation"; ref: number; role: string }>
	viaCoords: [number, number] | null
	fromWayCoords: Array<[number, number]>
	toWayCoords: Array<[number, number]>
}

export interface AccessBlockedWay {
	id: number
	tags: Record<string, string>
	coords: Array<[number, number]>
	accessTag: string
}

export interface BarrierNode {
	id: number
	tags: Record<string, string>
	coords: [number, number]
}

export interface RoutableNode {
	nodeIndex: number
	coordinates: [number, number]
	distance: number
}

export interface RouteSegment {
	name?: string
	highway?: string
	distance: number
	time: number
}

export interface RouteResultShape {
	coordinates: Array<[number, number]>
	segments: RouteSegment[]
	distance: number
	time: number
}

/** The subset of VizWorker the UI actually calls. */
interface VizWorkerApi {
	fromPbf(input: {
		data: ArrayBufferLike | ReadableStream<Uint8Array>
		options?: Record<string, unknown>
	}): Promise<OsmInfo>
	fromGeoJSON(input: {
		data: ArrayBufferLike | ReadableStream<Uint8Array>
		options?: Record<string, unknown>
	}): Promise<OsmInfo>
	fromGeoParquet(input: {
		data: ArrayBuffer | string | URL
		options?: Record<string, unknown>
	}): Promise<OsmInfo>
	getVectorTile(id: string, tile: [number, number, number]): ArrayBuffer
	/**
	 * `opts` mirrors osmix's DrawToRasterTileOptions (tile size, line/point
	 * colours). Declared structurally on purpose: importing the real type would
	 * mean pulling `osmix` onto the main thread, which is what this module
	 * exists to avoid. osmix accepts an RGBA tuple or a Uint8ClampedArray.
	 */
	getRasterTile(
		id: string,
		tile: [number, number, number],
		opts?: {
			tileSize?: number
			lineColor?: [number, number, number, number] | Uint8ClampedArray
			pointColor?: [number, number, number, number] | Uint8ClampedArray
		},
	): Uint8ClampedArray<ArrayBuffer>
	toPbf(id: string): Uint8Array
	exportRoadsPbf(id: string): Uint8Array
	exportGeoParquet(id: string, options?: GeoParquetExportOptions): GeoParquetExportResult
	search(id: string, key: string, val?: string): SearchHits
	getEntityTags(
		osmId: string,
		entityType: "node" | "way" | "relation",
		entityId: number,
	): Record<string, string> | null
	editEntityTags(
		osmId: string,
		entityType: "node" | "way" | "relation",
		entityId: number,
		newTags: Record<string, string>,
	): OsmInfo
	getRestrictions(osmId: string): RestrictionRecord[]
	getAccessBlockedWays(osmId: string): AccessBlockedWay[]
	getBarrierNodes(osmId: string): BarrierNode[]
	getHighwayWayIds(osmId: string): number[]
	getWayGeometries(
		osmId: string,
		wayIds: number[],
	): Array<{ wayId: number; coords: Array<[number, number]>; highway: string }>
	getBatchWayCoords(
		osmId: string,
		wayIds: number[],
	): Array<{ id: number; coords: Array<[number, number]> }>
	getWayCoords(osmId: string, wayId: number): Array<[number, number]> | null
	getNodeCoords(osmId: string, nodeId: number): [number, number] | null
	exportRoadsData(osmId: string): RoadRecord[]
	executeQuery(osmId: string, filter: QueryFilter, options?: QueryOptions): QueryResult
	executeCount(osmId: string, filter: QueryFilter): number
	executeAggregate(
		osmId: string,
		filter: QueryFilter,
		aggregate: AggregateOp,
		field: AggregateField,
	): number
	parseQuery(query: string): QueryFilter
	findNearestRoutableNode(
		osmId: string,
		point: [number, number],
		maxDistanceM: number,
	): RoutableNode | null
	route(
		osmId: string,
		fromIndex: number,
		toIndex: number,
		options?: Record<string, unknown>,
	): RouteResultShape | null
	buildRoutingGraph(osmId: string): { nodeCount: number; edgeCount: number }
	/** Releases the dataset and every cache the worker holds for it. */
	delete(osmId: string): void
	addProgressListener(listener: (progress: Progress) => void): void
}

/** Comlink turns every worker method into an async call. */
export type VizWorkerProxy = {
	[K in keyof VizWorkerApi]: VizWorkerApi[K] extends (...args: infer A) => infer R
		? (...args: A) => Promise<Awaited<R>>
		: never
}

export type OsmInput = ArrayBufferLike | ReadableStream<Uint8Array> | Uint8Array | File

/** Convenience shape used by panels: `remote.getWorker().anything()`. */
export interface VizRemote {
	fromPbf(data: OsmInput, options?: Record<string, unknown>): Promise<OsmInfo>
	fromGeoJSON(data: OsmInput, options?: Record<string, unknown>): Promise<OsmInfo>
	fromGeoParquet(data: ArrayBuffer | File, options?: Record<string, unknown>): Promise<OsmInfo>
	getVectorTile(osmId: unknown, tile: [number, number, number]): Promise<ArrayBuffer>
	toPbfData(osmId: unknown): Promise<Uint8Array>
	exportRoadsPbf(osmId: unknown): Promise<Uint8Array>
	exportGeoParquet(
		osmId: unknown,
		options?: GeoParquetExportOptions,
	): Promise<GeoParquetExportResult>
	search(osmId: unknown, key: string, val?: string): Promise<SearchHits>
	deleteDataset(osmId: unknown): Promise<void>
	findNearestRoutableNode(
		osmId: unknown,
		point: [number, number],
		maxDistanceM: number,
	): Promise<RoutableNode | null>
	route(
		osmId: unknown,
		fromIndex: number,
		toIndex: number,
		options?: Record<string, unknown>,
	): Promise<RouteResultShape | null>
	getWorker(): VizWorkerProxy
}

// ── Module-level singleton ───────────────────────────────────────────────────

let _remote: VizRemote | null = null
let _initPromise: Promise<VizRemote> | null = null

/** Byte size of the file currently loading, used for ETA maths. */
let _bytesTotal: number | undefined

export function getOsmRemote(): VizRemote | null {
	return _remote
}

// ── Progress plumbing ────────────────────────────────────────────────────────

let progressHistory: Array<{ timestamp: number; bytes: number }> = []
const MAX_HISTORY = 10

/**
 * Identifies the load that currently owns the progress channel. Progress
 * events from a superseded load are dropped so a slow abandoned parse cannot
 * overwrite the live one's UI.
 */
let activeLoadToken: symbol | null = null

function detectStage(msg: string | undefined): LoadingStage {
	if (!msg) return "parsing"
	const lower = msg.toLowerCase()
	if (lower.includes("download") || lower.includes("fetch")) return "downloading"
	if (lower.includes("parse") || lower.includes("read") || lower.includes("decoding")) return "parsing"
	if (lower.includes("index") || lower.includes("build") || lower.includes("spatial")) return "indexing"
	if (lower.includes("tile") || lower.includes("vector") || lower.includes("encoder")) return "building-tiles"
	if (lower.includes("complete") || lower.includes("done") || lower.includes("finished")) return "complete"
	return "parsing"
}

function calculatePercent(msg: string | undefined, stage: LoadingStage): number {
	if (msg) {
		const percentMatch = msg.match(/(\d+(?:\.\d+)?)%/)
		if (percentMatch?.[1]) return Math.min(100, Math.max(0, parseFloat(percentMatch[1])))

		const ofMatch = msg.match(/(\d+)\s*\/\s*(\d+)/)
		if (ofMatch?.[1] && ofMatch[2]) {
			const current = parseInt(ofMatch[1], 10)
			const total = parseInt(ofMatch[2], 10)
			if (total > 0) return Math.min(100, Math.max(0, (current / total) * 100))
		}
	}

	const stageDefaults: Record<LoadingStage, number> = {
		downloading: 30,
		parsing: 50,
		indexing: 70,
		"building-tiles": 90,
		complete: 100,
	}
	return stageDefaults[stage]
}

function calculateETA(bytesLoaded: number, bytesTotal: number): number | undefined {
	if (!bytesTotal || bytesTotal <= 0 || bytesLoaded <= 0) return undefined

	progressHistory.push({ timestamp: Date.now(), bytes: bytesLoaded })
	if (progressHistory.length > MAX_HISTORY) progressHistory.shift()
	if (progressHistory.length < 2) return undefined

	const first = progressHistory[0]
	const last = progressHistory[progressHistory.length - 1]
	if (!first || !last) return undefined

	const seconds = (last.timestamp - first.timestamp) / 1000
	const delta = last.bytes - first.bytes
	if (seconds <= 0 || delta <= 0) return undefined

	return Math.ceil((bytesTotal - bytesLoaded) / (delta / seconds))
}

function transformProgress(progress: Progress, bytesTotal?: number): ExtendedProgress {
	const stage = detectStage(progress.msg)
	const percent = calculatePercent(progress.msg, stage)

	let bytesLoaded: number | undefined
	const bytesMatch = progress.msg.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)/i)
	if (bytesMatch?.[1] && bytesMatch[2]) {
		const value = parseFloat(bytesMatch[1])
		const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
		bytesLoaded = value * (multipliers[bytesMatch[2].toUpperCase()] ?? 1)
	}

	return {
		...progress,
		stage,
		percent,
		bytesLoaded,
		bytesTotal,
		etaSeconds: bytesTotal && bytesLoaded ? calculateETA(bytesLoaded, bytesTotal) : undefined,
	}
}

// ── Transfer helpers ─────────────────────────────────────────────────────────

/** Feature-detect transferable ReadableStreams (fails without cross-origin isolation). */
function supportsStreamTransfer(): boolean {
	if (typeof ReadableStream === "undefined" || typeof MessageChannel === "undefined") return false
	try {
		const { port1, port2 } = new MessageChannel()
		const stream = new ReadableStream()
		port1.postMessage(stream, [stream])
		port1.close()
		port2.close()
		return true
	} catch {
		return false
	}
}

const STREAM_TRANSFER_OK = supportsStreamTransfer()

/** Comlink.transfer with transferables collected from a nested payload. */
function transferOf(value: unknown): never {
	const transferables: Transferable[] = []
	const collect = (item: unknown): void => {
		if (item instanceof ArrayBuffer || item instanceof ReadableStream) {
			transferables.push(item as Transferable)
		} else if (ArrayBuffer.isView(item)) {
			transferables.push(item.buffer as ArrayBuffer)
		} else if (Array.isArray(item)) {
			for (const child of item) collect(child)
		} else if (item && typeof item === "object") {
			for (const child of Object.values(item)) collect(child)
		}
	}
	collect(value)
	return Comlink.transfer(value, transferables) as never
}

function toId(osmId: unknown): string {
	if (typeof osmId === "string") return osmId
	if (osmId && typeof osmId === "object" && "id" in osmId) return String((osmId as { id: string }).id)
	return String(osmId)
}

// ── Worker bootstrap ─────────────────────────────────────────────────────────

async function initRemote(): Promise<VizRemote> {
	if (_remote) return _remote
	if (_initPromise) return _initPromise

	_initPromise = (async () => {
		// Vite detects this pattern and bundles the worker as a separate chunk.
		const rawWorker = new Worker(new URL("../workers/osm.worker.ts", import.meta.url), {
			type: "module",
		})
		const worker = Comlink.wrap<VizWorkerApi>(rawWorker) as unknown as VizWorkerProxy

		// Registered exactly once. The previous implementation re-registered a
		// listener on every load, so the Nth load ran N callbacks per progress
		// event — each with its own ETA history against a different total.
		await worker.addProgressListener(
			Comlink.proxy((progress: Progress) => {
				if (activeLoadToken === null) return
				useOsmStore.getState().setProgress(transformProgress(progress, _bytesTotal))
			}),
		)

		/** Owns the progress channel for the duration of one load. */
		const withLoad = async <T>(
			byteLength: number | undefined,
			run: () => Promise<T>,
		): Promise<T> => {
			const token: symbol = Symbol("load")
			activeLoadToken = token
			progressHistory = []
			_bytesTotal = byteLength
			try {
				return await run()
			} finally {
				if (activeLoadToken === token) {
					activeLoadToken = null
					progressHistory = []
					_bytesTotal = undefined
				}
			}
		}

		/**
		 * Hand a File to the worker as a transferable stream when the browser
		 * supports it, so the main thread never materialises the whole extract.
		 * Returns the payload plus whether it was streamed.
		 */
		const streamedPayload = (data: OsmInput): {
			payload: ArrayBufferLike | ReadableStream<Uint8Array>
			byteLength?: number
			streamed: boolean
		} => {
			if (data instanceof File) {
				if (STREAM_TRANSFER_OK) {
					const stream = data.stream()
					return { payload: stream, byteLength: data.size, streamed: true }
				}
				return { payload: undefined as never, byteLength: data.size, streamed: false }
			}
			if (data instanceof ReadableStream) {
				return { payload: data, streamed: true }
			}
			if (
				data instanceof ArrayBuffer ||
				(typeof SharedArrayBuffer !== "undefined" && data instanceof SharedArrayBuffer)
			) {
				return { payload: data, byteLength: data.byteLength, streamed: false }
			}
			if (ArrayBuffer.isView(data)) {
				return { payload: data.buffer as ArrayBuffer, byteLength: data.byteLength, streamed: false }
			}
			return { payload: data as ArrayBufferLike, streamed: false }
		}

		const remote: VizRemote = {
			async fromPbf(data, options = {}) {
				const prepared = streamedPayload(data)
				return withLoad(prepared.byteLength, async () => {
					if (prepared.streamed) {
						return worker.fromPbf(transferOf({ data: prepared.payload, options }))
					}
					// Buffered path: File without stream transfer, or a plain buffer.
					const buffer = data instanceof File ? await data.arrayBuffer() : prepared.payload
					return worker.fromPbf(transferOf({ data: buffer, options }))
				})
			},

			async fromGeoJSON(data, options = {}) {
				const prepared = streamedPayload(data)
				return withLoad(prepared.byteLength, async () => {
					if (prepared.streamed) {
						return worker.fromGeoJSON(transferOf({ data: prepared.payload, options }))
					}
					const buffer = data instanceof File ? await data.arrayBuffer() : prepared.payload
					return worker.fromGeoJSON(transferOf({ data: buffer, options }))
				})
			},

			async fromGeoParquet(data, options = {}) {
				// hyparquet reads parquet by random access, so it needs a real
				// ArrayBuffer rather than a stream.
				const buffer = data instanceof File ? await data.arrayBuffer() : data
				return withLoad(buffer.byteLength, () =>
					worker.fromGeoParquet(transferOf({ data: buffer, options })),
				)
			},

			getVectorTile: (osmId, tile) => worker.getVectorTile(toId(osmId), tile),
			toPbfData: (osmId) => worker.toPbf(toId(osmId)),
			exportRoadsPbf: (osmId) => worker.exportRoadsPbf(toId(osmId)),
			exportGeoParquet: (osmId, options) => worker.exportGeoParquet(toId(osmId), options),
			search: (osmId, key, val) => worker.search(toId(osmId), key, val),
			deleteDataset: (osmId) => worker.delete(toId(osmId)),
			findNearestRoutableNode: (osmId, point, maxDistanceM) =>
				worker.findNearestRoutableNode(toId(osmId), point, maxDistanceM),
			route: (osmId, fromIndex, toIndex, options) =>
				worker.route(toId(osmId), fromIndex, toIndex, options),
			getWorker: () => worker,
		}

		_remote = remote
		return remote
	})()

	return _initPromise
}

export function useOsm() {
	const [remote, setRemote] = useState<VizRemote | null>(_remote)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		initRemote()
			.then(setRemote)
			.catch((err) => setError(String(err)))
	}, [])

	return { remote, error }
}
