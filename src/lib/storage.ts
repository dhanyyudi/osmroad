/**
 * IndexedDB wrapper for OSMRoad data persistence
 * Stores metadata about cached datasets for reload functionality
 */

const DB_NAME = "osmroad-cache-v1"
const DB_VERSION = 1
const STORE_NAME = "datasets"

export interface CachedDataset {
	id: string
	fileName: string
	fileUrl?: string
	cachedAt: number
	fileSize: number
	stats: {
		nodes: number
		ways: number
		relations: number
	}
	bbox?: [number, number, number, number]
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result
			
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
				store.createIndex("cachedAt", "cachedAt", { unique: false })
				store.createIndex("fileName", "fileName", { unique: false })
			}
		}
	})

	return dbPromise
}

/**
 * Save dataset metadata to IndexedDB
 */
export async function saveDatasetMetadata(dataset: CachedDataset): Promise<void> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		
		const request = store.put(dataset)
		
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

/**
 * Get dataset metadata by ID
 */
export async function getDatasetMetadata(id: string): Promise<CachedDataset | null> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readonly")
		const store = transaction.objectStore(STORE_NAME)
		
		const request = store.get(id)
		
		request.onsuccess = () => resolve(request.result || null)
		request.onerror = () => reject(request.error)
	})
}

/**
 * Get the most recently cached dataset
 */
export async function getLastDataset(): Promise<CachedDataset | null> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readonly")
		const store = transaction.objectStore(STORE_NAME)
		const index = store.index("cachedAt")
		
		const request = index.openCursor(null, "prev")
		
		request.onsuccess = () => {
			const cursor = request.result
			if (cursor) {
				resolve(cursor.value)
			} else {
				resolve(null)
			}
		}
		request.onerror = () => reject(request.error)
	})
}

/**
 * Get all cached datasets
 */
export async function getAllDatasets(): Promise<CachedDataset[]> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readonly")
		const store = transaction.objectStore(STORE_NAME)
		
		const request = store.getAll()
		
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

/**
 * Delete dataset metadata
 */
export async function deleteDatasetMetadata(id: string): Promise<void> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		
		const request = store.delete(id)
		
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

/**
 * Clear all dataset metadata
 */
export async function clearAllDatasets(): Promise<void> {
	const db = await openDB()
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		
		const request = store.clear()
		
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

/**
 * Check if running with disabled cache (hard refresh)
 */
export function isHardRefresh(): boolean {
	// Check for hard refresh indicators
	if (typeof window === "undefined") return false
	
	// Check URL params
	const urlParams = new URLSearchParams(window.location.search)
	if (urlParams.has("nocache") || urlParams.has("fresh")) {
		return true
	}
	
	// Check performance navigation type
	if (performance.navigation && performance.navigation.type === 1) {
		// TYPE_RELOAD - could be hard refresh
		// Additional check: see if service worker is controlling
		return false // Let SW handle this
	}
	
	return false
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000)
	
	if (seconds < 60) return "just now"
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
	return `${Math.floor(seconds / 86400)}d ago`
}
