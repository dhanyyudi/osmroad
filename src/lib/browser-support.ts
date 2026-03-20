/**
 * Browser capability detection
 * Used for graceful degradation on browsers without full support
 */

export interface BrowserCapabilities {
	sharedArrayBuffer: boolean
	webWorkers: boolean
	serviceWorkers: boolean
	wasm: boolean
}

export interface BrowserSupport {
	fullySupported: boolean
	partiallySupported: boolean
	missingFeatures: string[]
	mode: "full" | "limited" | "unsupported"
}

/**
 * Detect browser capabilities
 */
export function detectCapabilities(): BrowserCapabilities {
	return {
		sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
		webWorkers: typeof Worker !== "undefined",
		serviceWorkers: "serviceWorker" in navigator,
		wasm: typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function",
	}
}

/**
 * Check full browser support
 */
export function checkBrowserSupport(): BrowserSupport {
	const caps = detectCapabilities()
	const missingFeatures: string[] = []

	if (!caps.webWorkers) missingFeatures.push("Web Workers")
	if (!caps.wasm) missingFeatures.push("WebAssembly")

	// Web Workers and WASM are required for any functionality
	if (!caps.webWorkers || !caps.wasm) {
		return {
			fullySupported: false,
			partiallySupported: false,
			missingFeatures,
			mode: "unsupported",
		}
	}

	// SharedArrayBuffer is required for full mode (DuckDB + multi-worker)
	if (!caps.sharedArrayBuffer) {
		return {
			fullySupported: false,
			partiallySupported: true,
			missingFeatures: ["SharedArrayBuffer (SQL features limited)"],
			mode: "limited",
		}
	}

	return {
		fullySupported: true,
		partiallySupported: true,
		missingFeatures: [],
		mode: "full",
	}
}

/**
 * Check if running in limited mode
 */
export function isLimitedMode(): boolean {
	return checkBrowserSupport().mode === "limited"
}

/**
 * Check if browser is fully supported
 */
export function isFullMode(): boolean {
	return checkBrowserSupport().mode === "full"
}

/**
 * Get browser support description
 */
export function getSupportDescription(): string {
	const support = checkBrowserSupport()

	switch (support.mode) {
		case "full":
			return "Full support - all features available"
		case "limited":
			return "Limited mode - core features work, SQL queries unavailable"
		case "unsupported":
			return `Unsupported - missing: ${support.missingFeatures.join(", ")}`
	}
}
