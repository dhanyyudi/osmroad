/**
 * Overpass proxy.
 *
 * The browser used to call overpass-api.de directly. That has three problems:
 *
 *   1. CORS. The page is cross-origin isolated (COEP: require-corp), so a
 *      response without the right CORS headers fails with an opaque error the
 *      user cannot act on. Measured from a real client: overpass-api.de answers
 *      `406 Not Acceptable` — even for `/api/status` with no query — and a 406
 *      carries no `Access-Control-Allow-Origin`, so the browser only ever
 *      reports a generic network failure.
 *   2. No fallback. One endpoint, one chance. If it is rate limiting or down,
 *      the feature is down.
 *   3. An open proxy is not the goal: the query is built here, not accepted from
 *      the client, so this route cannot be used as a free Overpass gateway.
 *
 * Requests go through Cloudflare's network rather than the user's, which is also
 * a different path to Overpass when the client's own network is refused.
 */

/**
 * Mirrors, tried in order. Each is an independent Overpass instance; the second
 * and third exist because the first is the busiest and the most likely to be
 * rate limited or to refuse a client outright.
 */
export const OVERPASS_MIRRORS = [
	"https://overpass-api.de/api/interpreter",
	"https://overpass.kumi.systems/api/interpreter",
	"https://overpass.private.coffee/api/interpreter",
]

/** Per-mirror wait. Kept below the query's own `[timeout:]` so we give up first. */
const MIRROR_TIMEOUT_MS = 45_000

/**
 * Server-side area cap, in km². Mirrors the limit the UI shows, and is enforced
 * here because this endpoint is public: without it anyone could drive arbitrary
 * load through our Worker into a free, donation-funded service.
 */
export const MAX_AREA_KM2 = 50

/** Overpass asks that clients identify themselves. */
const USER_AGENT = "OSMRoad/0.2 (+https://osmroad.gislabs.workers.dev)"

export interface OverpassBbox {
	minLon: number
	minLat: number
	maxLon: number
	maxLat: number
}

export function parseBbox(input: unknown): OverpassBbox | null {
	if (!Array.isArray(input) || input.length !== 4) return null
	const nums = input.map((v) => (typeof v === "number" ? v : Number.NaN))
	if (nums.some((n) => !Number.isFinite(n))) return null

	const [minLon, minLat, maxLon, maxLat] = nums as [number, number, number, number]
	if (minLon >= maxLon || minLat >= maxLat) return null
	if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return null

	return { minLon, minLat, maxLon, maxLat }
}

/** Equirectangular approximation, which is ample for a yes/no area check. */
export function bboxAreaKm2(bbox: OverpassBbox): number {
	const R = 6371
	const toRad = (deg: number) => (deg * Math.PI) / 180
	const meanLat = toRad((bbox.minLat + bbox.maxLat) / 2)
	const widthKm = toRad(bbox.maxLon - bbox.minLon) * Math.cos(meanLat) * R
	const heightKm = toRad(bbox.maxLat - bbox.minLat) * R
	return Math.abs(widthKm * heightKm)
}

/**
 * The query is fixed here rather than taken from the client.
 *
 * `[out:xml]` is deliberate: the browser already has a working OSM XML parser,
 * and switching formats would be a larger change than this fix needs.
 */
export function buildRoadsQuery(bbox: OverpassBbox): string {
	const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
	return `[out:xml][timeout:40][maxsize:134217728][bbox:${b}];
way["highway"];
out geom;`
}

export interface OverpassAttempt {
	endpoint: string
	status?: number
	error?: string
}

export interface OverpassOutcome {
	xml: string
	/** The mirror that actually answered. */
	endpoint: string
	/** Every mirror tried before that one, for diagnostics. */
	attempts: OverpassAttempt[]
}

/**
 * Overpass signals failures inside a 200 response.
 *
 * A query that times out or exceeds `maxsize` comes back as HTTP 200 whose body
 * carries a `<remark>`. Reading that body as data is how "Query timed out"
 * becomes "No roads found in selected area" — a misleading error the user cannot
 * act on. Detect it and report what Overpass actually said.
 */
export function overpassRemark(xml: string): string | null {
	const match = /<remark>\s*([\s\S]*?)\s*<\/remark>/i.exec(xml)
	if (!match?.[1]) return null
	const remark = match[1].trim()
	return remark.length > 0 ? remark : null
}

async function tryMirror(endpoint: string, query: string): Promise<{ xml: string } | { error: string; status?: number }> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS)
	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": USER_AGENT,
			},
			body: new URLSearchParams({ data: query }).toString(),
			signal: controller.signal,
		})

		if (!response.ok) {
			// Drain the body so the connection can be reused.
			await response.text().catch(() => "")
			return { error: `HTTP ${response.status} ${response.statusText}`, status: response.status }
		}

		const xml = await response.text()
		const remark = overpassRemark(xml)
		if (remark) return { error: `Overpass error: ${remark}` }

		return { xml }
	} catch (err) {
		const aborted = err instanceof Error && err.name === "AbortError"
		return { error: aborted ? `timed out after ${MIRROR_TIMEOUT_MS / 1000}s` : String(err) }
	} finally {
		clearTimeout(timer)
	}
}

/** Try each mirror until one returns a usable document. */
export async function fetchFromOverpass(query: string): Promise<OverpassOutcome | { attempts: OverpassAttempt[] }> {
	const attempts: OverpassAttempt[] = []

	for (const endpoint of OVERPASS_MIRRORS) {
		const result = await tryMirror(endpoint, query)
		if ("xml" in result) {
			return { xml: result.xml, endpoint, attempts }
		}
		attempts.push({ endpoint, status: result.status, error: result.error })
		console.error("Overpass mirror failed", { endpoint, error: result.error })
	}

	return { attempts }
}
