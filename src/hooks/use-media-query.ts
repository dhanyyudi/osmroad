import { useState, useEffect } from "react"

/**
 * Hook to detect if viewport matches a media query
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() => {
		if (typeof window === "undefined") return false
		return window.matchMedia(query).matches
	})

	useEffect(() => {
		if (typeof window === "undefined") return

		const media = window.matchMedia(query)
		
		const updateMatch = () => setMatches(media.matches)
		
		// Modern browsers
		if (media.addEventListener) {
			media.addEventListener("change", updateMatch)
		} else {
			// Legacy support
			media.addListener(updateMatch)
		}

		return () => {
			if (media.removeEventListener) {
				media.removeEventListener("change", updateMatch)
			} else {
				media.removeListener(updateMatch)
			}
		}
	}, [query])

	return matches
}

/**
 * Hook to detect mobile viewport (< 768px)
 */
export function useIsMobile(): boolean {
	return useMediaQuery("(max-width: 767px)")
}

/**
 * Hook to detect tablet viewport (768px - 1024px)
 */
export function useIsTablet(): boolean {
	return useMediaQuery("(min-width: 768px) and (max-width: 1024px)")
}

/**
 * Hook to detect desktop viewport (> 1024px)
 */
export function useIsDesktop(): boolean {
	return useMediaQuery("(min-width: 1024px)")
}

/**
 * Hook to detect touch device
 */
export function useIsTouchDevice(): boolean {
	const [isTouch, setIsTouch] = useState(false)

	useEffect(() => {
		setIsTouch(
			"ontouchstart" in window || 
			navigator.maxTouchPoints > 0
		)
	}, [])

	return isTouch
}

/**
 * Hook to detect screen orientation
 */
export function useOrientation(): "portrait" | "landscape" {
	const [orientation, setOrientation] = useState<"portrait" | "landscape">(() => {
		if (typeof window === "undefined") return "portrait"
		return window.innerWidth > window.innerHeight ? "landscape" : "portrait"
	})

	useEffect(() => {
		if (typeof window === "undefined") return

		const updateOrientation = () => {
			setOrientation(window.innerWidth > window.innerHeight ? "landscape" : "portrait")
		}

		window.addEventListener("resize", updateOrientation)
		window.addEventListener("orientationchange", updateOrientation)

		return () => {
			window.removeEventListener("resize", updateOrientation)
			window.removeEventListener("orientationchange", updateOrientation)
		}
	}, [])

	return orientation
}
