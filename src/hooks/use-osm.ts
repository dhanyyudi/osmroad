import { useEffect, useState } from "react"
import { OsmixRemote } from "osmix"
import * as Comlink from "comlink"
import type { Progress } from "@osmix/shared/progress"
import type { VizWorker } from "../workers/osm.worker"
import { useOsmStore } from "../stores/osm-store"

// Module-level singleton
let _remote: OsmixRemote<VizWorker> | null = null
let _initPromise: Promise<OsmixRemote<VizWorker>> | null = null

export function getOsmRemote(): OsmixRemote<VizWorker> | null {
	return _remote
}

/**
 * Create the VizWorker using the `new Worker(new URL(...))` pattern
 * so Vite bundles it for production. Then initialize OsmixRemote
 * with the pre-created worker.
 */
async function initRemote(): Promise<OsmixRemote<VizWorker>> {
	if (_remote) return _remote
	if (_initPromise) return _initPromise

	_initPromise = (async () => {
		// Vite detects this pattern and bundles the worker as a separate chunk
		const rawWorker = new Worker(
			new URL("../workers/osm.worker.ts", import.meta.url),
			{ type: "module" },
		)
		const workerProxy = Comlink.wrap<VizWorker>(rawWorker)

		// Register progress listener
		await workerProxy.addProgressListener(
			Comlink.proxy((progress: Progress) => {
				useOsmStore.getState().setProgress(progress)
			}),
		)

		// Build OsmixRemote that delegates everything to our single worker
		const remote = new Proxy(
			new OsmixRemote<VizWorker>(),
			{
				get(target, prop, receiver) {
					// Override getWorker to return our pre-created worker
					if (prop === "getWorker") {
						return () => workerProxy
					}

					// For all standard OsmixRemote methods that need a worker,
					// check if target has the method, and if so wrap it to use
					// our worker. But many methods internally call nextWorker()
					// which won't work. So we override the key methods directly.

					const value = Reflect.get(target, prop, receiver)
					return value
				},
			},
		) as unknown as OsmixRemote<VizWorker>

		// Monkey-patch the remote to use our worker for all operations
		const r = remote as unknown as Record<string, unknown>

		// Core data operations
		r.fromPbf = async (
			data: ArrayBufferLike | ReadableStream | Uint8Array | File,
			options: Record<string, unknown> = {},
		) => {
			const transferable = await fileToBuffer(data)
			const info = await workerProxy.fromPbf(
				Comlink.transfer({ data: transferable, options }, [
					transferable as ArrayBuffer,
				]),
			)
			return info as Awaited<ReturnType<OsmixRemote<VizWorker>["fromPbf"]>>
		}

		r.getVectorTile = (osmId: unknown, tile: [number, number, number]) => {
			return workerProxy.getVectorTile(toId(osmId), tile)
		}

		r.toPbfData = (osmId: unknown) => {
			return workerProxy.toPbf(toId(osmId))
		}

		r.search = (osmId: unknown, key: string, val?: string) => {
			return workerProxy.search(toId(osmId), key, val)
		}

		r.waysGetById = (osmId: unknown, wayId: number) => {
			return workerProxy.waysGetById(toId(osmId), wayId)
		}

		r.nodesGetById = (osmId: unknown, nodeId: number) => {
			return workerProxy.nodesGetById(toId(osmId), nodeId)
		}

		r.relationsGetById = (osmId: unknown, relId: number) => {
			return workerProxy.relationsGetById(toId(osmId), relId)
		}

		// Routing
		r.findNearestRoutableNode = (
			osmId: unknown,
			point: [number, number],
			maxDistanceM: number,
		) => {
			return workerProxy.findNearestRoutableNode(
				toId(osmId),
				point,
				maxDistanceM,
			)
		}

		r.route = (
			osmId: unknown,
			fromIndex: number,
			toIndex: number,
			options?: Record<string, unknown>,
		) => {
			return workerProxy.route(toId(osmId), fromIndex, toIndex, options)
		}

		r.buildRoutingGraph = (osmId: unknown) => {
			return workerProxy.buildRoutingGraph(toId(osmId))
		}

		r.getWorker = () => workerProxy

		_remote = remote as OsmixRemote<VizWorker>
		return _remote
	})()

	return _initPromise
}

function toId(osmId: unknown): string {
	if (typeof osmId === "string") return osmId
	if (osmId && typeof osmId === "object" && "id" in osmId)
		return (osmId as { id: string }).id
	return String(osmId)
}

async function fileToBuffer(
	data: ArrayBufferLike | ReadableStream | Uint8Array | File,
): Promise<ArrayBufferLike> {
	if (data instanceof ArrayBuffer || data instanceof SharedArrayBuffer)
		return data
	if (data instanceof Uint8Array) return data.buffer as ArrayBuffer
	if (data instanceof File) return data.arrayBuffer()
	const reader = (data as ReadableStream<Uint8Array>).getReader()
	const chunks: Uint8Array[] = []
	for (;;) {
		const { value, done } = await reader.read()
		if (value) chunks.push(value)
		if (done) break
	}
	const total = chunks.reduce((s, c) => s + c.length, 0)
	const buf = new Uint8Array(total)
	let off = 0
	for (const c of chunks) {
		buf.set(c, off)
		off += c.length
	}
	return buf.buffer as ArrayBuffer
}

export function useOsm() {
	const [remote, setRemote] = useState<OsmixRemote<VizWorker> | null>(_remote)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		initRemote()
			.then(setRemote)
			.catch((err) => setError(String(err)))
	}, [])

	return { remote, error }
}
