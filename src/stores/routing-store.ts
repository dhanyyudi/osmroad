import { create } from "zustand"

interface SnappedNode {
	nodeIndex: number
	nodeId: number
	coordinates: [number, number]
	distance: number
}

interface RouteSegment {
	wayIds: number[]
	name: string
	highway: string
	distance: number
	time: number
}

interface RouteResult {
	coordinates: Array<[number, number]>
	distance?: number
	time?: number
	segments?: RouteSegment[]
	turnPoints?: Array<[number, number]>
}

interface RoutingState {
	fromPoint: [number, number] | null
	toPoint: [number, number] | null
	fromNode: SnappedNode | null
	toNode: SnappedNode | null
	result: RouteResult | null
	isRouting: boolean
	isActive: boolean
	noNodeNearby: boolean
	clickPhase: "from" | "to"

	setActive: (active: boolean) => void
	setFromPoint: (
		point: [number, number],
		node: SnappedNode,
	) => void
	setToPointAndResult: (
		point: [number, number],
		node: SnappedNode,
		result: RouteResult | null,
	) => void
	setIsRouting: (routing: boolean) => void
	setNoNodeNearby: (nearby: boolean) => void
	reset: () => void
}

export type { SnappedNode, RouteResult, RouteSegment }

export const useRoutingStore = create<RoutingState>((set) => ({
	fromPoint: null,
	toPoint: null,
	fromNode: null,
	toNode: null,
	result: null,
	isRouting: false,
	isActive: false,
	noNodeNearby: false,
	clickPhase: "from",

	setActive: (isActive) =>
		set({
			isActive,
			fromPoint: null,
			toPoint: null,
			fromNode: null,
			toNode: null,
			result: null,
			clickPhase: "from",
		}),
	setFromPoint: (point, node) =>
		set({
			fromPoint: point,
			fromNode: node,
			toPoint: null,
			toNode: null,
			result: null,
			clickPhase: "to",
		}),
	setToPointAndResult: (point, node, result) =>
		set({
			toPoint: point,
			toNode: node,
			result,
			clickPhase: "from",
		}),
	setIsRouting: (isRouting) => set({ isRouting }),
	setNoNodeNearby: (noNodeNearby) => set({ noNodeNearby }),
	reset: () =>
		set({
			fromPoint: null,
			toPoint: null,
			fromNode: null,
			toNode: null,
			result: null,
			clickPhase: "from",
			noNodeNearby: false,
		}),
}))
