import { Workbox } from "workbox-window"

/**
 * Service Worker registration and management
 */

let wb: Workbox | null = null

interface SWCallbacks {
	onUpdateAvailable?: () => void
	onCachedDataAvailable?: (url: string) => void
	onError?: (error: Error) => void
}

/**
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
	// Check for Vite's development indicators
	if (typeof import.meta !== "undefined" && import.meta.env) {
		return import.meta.env.DEV === true
	}
	// Fallback: check hostname
	if (typeof window !== "undefined") {
		return window.location.hostname === "localhost" || 
		       window.location.hostname === "127.0.0.1"
	}
	return false
}

/**
 * Check if running with disabled cache (hard refresh)
 */
function isHardRefresh(): boolean {
	if (typeof window === "undefined") return false
	
	const urlParams = new URLSearchParams(window.location.search)
	if (urlParams.has("nocache") || urlParams.has("fresh") || urlParams.has("nosw")) {
		return true
	}
	
	return false
}

/**
 * Register the service worker
 */
export function registerServiceWorker(callbacks: SWCallbacks = {}): void {
	if (typeof window === "undefined") return
	
	if (!("serviceWorker" in navigator)) {
		console.log("[SW] Service workers not supported")
		return
	}

	// Skip in development mode (SW only available after build)
	if (isDevelopment()) {
		console.log("[SW] Development mode detected - skipping SW registration (SW only works after build)")
		return
	}

	// Check for hard refresh
	if (isHardRefresh()) {
		console.log("[SW] Hard refresh detected, skipping SW registration")
		return
	}

	try {
		wb = new Workbox("/sw.js")

		// Listen for updates
		wb.addEventListener("waiting", () => {
			console.log("[SW] New version waiting")
			callbacks.onUpdateAvailable?.()
		})

		wb.addEventListener("controlling", () => {
			console.log("[SW] Now controlling page")
			// Reload to use new service worker
			window.location.reload()
		})

		// Listen for messages from SW
		wb.addEventListener("message", (event) => {
			if (event.data?.type === "CACHED_DATA_AVAILABLE") {
				console.log("[SW] Cached data available:", event.data.url)
				callbacks.onCachedDataAvailable?.(event.data.url)
			}
		})

		// Register
		wb.register()
			.then((registration) => {
				console.log("[SW] Registered:", registration)
			})
			.catch((error) => {
				// Silently ignore 404 errors (expected in dev mode)
				if (error instanceof Error && error.message.includes("404")) {
					console.log("[SW] Service worker not found (expected in development)")
				} else {
					console.error("[SW] Registration failed:", error)
					callbacks.onError?.(error)
				}
			})
	} catch (error) {
		console.error("[SW] Error:", error)
	}
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaiting(): void {
	if (wb) {
		wb.messageSkipWaiting()
	}
}

/**
 * Check if service worker is controlling the page
 */
export function isSWControlling(): boolean {
	if (typeof navigator === "undefined") return false
	return navigator.serviceWorker?.controller != null
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorkers(): Promise<void> {
	if (typeof navigator === "undefined") return
	
	const registrations = await navigator.serviceWorker.getRegistrations()
	for (const registration of registrations) {
		await registration.unregister()
	}
}
