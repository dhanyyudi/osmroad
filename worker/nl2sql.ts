/**
 * Natural-language -> DuckDB SQL prompt for the OSMRoad AI query panel.
 *
 * The schema string must stay byte-for-byte in step with the CREATE TABLE in
 * src/hooks/use-osm-duckdb-sync.ts: the model is only ever told about the
 * `roads` table, and a mismatch here produces confidently wrong SQL.
 */

export const SCHEMA_CONTEXT = `You are an expert SQL assistant for OpenStreetMap data.
Convert the user's question into a single DuckDB SQL query.

DATABASE SCHEMA:

Table: roads
- id (BIGINT): Unique OSM way identifier
- name (VARCHAR): Road name (may be NULL if unnamed)
- highway (VARCHAR): Road type classification. Valid values:
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'residential', 'unclassified', 'service', 'track', 'path',
  'footway', 'cycleway', 'steps',
  and link variants: 'motorway_link', 'trunk_link', 'primary_link', etc.
- length_meters (DOUBLE): Road segment length in meters
- tags (JSON): Additional OSM tags. Access with tags->>'key', e.g.:
  tags->>'oneway' = 'yes'   -- one-way street
  tags->>'maxspeed'         -- speed limit
  tags->>'surface'          -- 'asphalt', 'concrete', 'unpaved', etc.
  tags->>'lanes'            -- number of lanes

Only this one table exists. Do NOT reference nodes, intersections, or any other table.

RULES:
1. Only use tables and columns from the schema above.
2. Use length_meters for length comparisons.
3. Use tags->>'key' for JSON extraction.
4. Reply with the SQL query and nothing else. No markdown fences, no explanation.
5. The user may write in English or Indonesian; classify road types to the
   English OSM values above ("jalan tol" -> 'motorway', "trotoar" -> 'footway',
   "jalur sepeda" -> 'cycleway').`

/**
 * Few-shot examples.
 *
 * Kept deliberately short: the offline parser in src/services/ai/local-nl2sql.ts
 * already covers the common bilingual phrasings, so these only need to anchor
 * the output shape rather than enumerate every road type.
 */
export const EXAMPLES = `EXAMPLES:
"Find primary roads longer than 5km" -> SELECT * FROM roads WHERE highway = 'primary' AND length_meters > 5000;
"Count roads by type" -> SELECT highway, COUNT(*) AS count FROM roads GROUP BY highway ORDER BY count DESC;
"Berapa jalan tol?" -> SELECT COUNT(*) AS total FROM roads WHERE highway = 'motorway';
"Total panjang semua jalan" -> SELECT SUM(length_meters) AS total_meters FROM roads;`

export function buildNl2SqlPrompt(userQuery: string): string {
	return `${EXAMPLES}

QUESTION:
${JSON.stringify(userQuery)}

SQL:`
}

/**
 * Strip whatever wrapping the model added.
 *
 * Chat models routinely ignore "no markdown", so fences and a leading label are
 * removed here rather than trusted away in the prompt.
 */
export function cleanSql(raw: string): string {
	let sql = raw.trim()

	// ```sql ... ``` or ``` ... ```
	const fence = sql.match(/```(?:sql)?\s*([\s\S]*?)```/i)
	if (fence?.[1]) sql = fence[1].trim()

	// "SQL: SELECT ..." and friends.
	sql = sql.replace(/^(?:sql|query|answer)\s*:\s*/i, "").trim()

	// Keep only the first statement, so a chatty model cannot append a second.
	const semicolon = sql.indexOf(";")
	if (semicolon !== -1) sql = sql.slice(0, semicolon + 1)

	// Drop trailing prose on a line after the statement.
	sql = sql.split("\n").filter((line) => !/^\s*(?:--|#)/.test(line) || line.trim().length > 0).join(" ").trim()

	if (sql.length === 0) return ""
	if (!/^(select|with)\b/i.test(sql)) return ""
	return sql.endsWith(";") ? sql : `${sql};`
}

/**
 * Deterministic last resort when the model returns nothing usable.
 * Mirrors the keyword mapping the client-side parser uses; returning SQL the
 * user can inspect beats returning an error for these very common questions.
 */
export function LOCAL_FALLBACK_SQL(prompt: string): string | null {
	const lower = prompt.toLowerCase()
	const count = /\b(berapa|how many|count|jumlah)\b/.test(lower)

	if (/sepeda|bike|bicycle|cycleway/.test(lower)) {
		return count
			? "SELECT COUNT(*) AS total FROM roads WHERE highway = 'cycleway' OR tags->>'bicycle' = 'yes';"
			: "SELECT * FROM roads WHERE highway = 'cycleway' OR tags->>'bicycle' = 'yes';"
	}
	if (/pejalan|walk|foot|trotoar|pedestrian/.test(lower)) {
		return count
			? "SELECT COUNT(*) AS total FROM roads WHERE highway = 'footway';"
			: "SELECT * FROM roads WHERE highway = 'footway';"
	}
	if (/jalan tol|motorway|tol\b/.test(lower)) {
		return count
			? "SELECT COUNT(*) AS total FROM roads WHERE highway = 'motorway';"
			: "SELECT * FROM roads WHERE highway = 'motorway';"
	}
	if (/total panjang|total length|panjang semua|sum of length/.test(lower)) {
		return "SELECT SUM(length_meters) AS total_meters FROM roads;"
	}

	return null
}
