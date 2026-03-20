/**
 * Map utility functions
 */

/**
 * Generate Google Street View URL from lat/lon
 * Format lengkap dengan /place/ dan koordinat DMS seperti Google Maps asli
 * 
 * @param lat Latitude
 * @param lon Longitude
 * @returns Google Maps Street View URL
 */
export function generateStreetViewURL(lat: number, lon: number): string {
	// Convert to DMS format for the title
	const latDMS = decimalToDMS(lat, lat >= 0 ? 'N' : 'S')
	const lonDMS = decimalToDMS(lon, lon >= 0 ? 'E' : 'W')
	
	// Encode for URL
	const locationTitle = encodeURIComponent(`${latDMS}+${lonDMS}`)
	
	// Format lengkap: /place/{DMS}/@lat,lon,3a,75y,heading,90t
	return `https://www.google.com/maps/place/${locationTitle}/@${lat.toFixed(7)},${lon.toFixed(7)},3a,75y,0h,90t`
}

/**
 * Generate Google Maps URL with coordinate in title (more detailed format)
 * This format shows the coordinate in the URL title
 */
export function generateStreetViewURLWithTitle(lat: number, lon: number): string {
	// Convert to DMS format for the title
	const latDMS = decimalToDMS(lat, lat >= 0 ? 'N' : 'S')
	const lonDMS = decimalToDMS(lon, lon >= 0 ? 'E' : 'W')
	
	// Encode for URL
	const latEncoded = encodeURIComponent(latDMS)
	const lonEncoded = encodeURIComponent(lonDMS)
	
	return `https://www.google.com/maps/place/${latEncoded}+${lonEncoded}/@${lat.toFixed(6)},${lon.toFixed(6)},3a,75y,0h,90t`
}

/**
 * Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
 */
function decimalToDMS(decimal: number, direction: 'N' | 'S' | 'E' | 'W'): string {
	const absolute = Math.abs(decimal)
	const degrees = Math.floor(absolute)
	const minutesFloat = (absolute - degrees) * 60
	const minutes = Math.floor(minutesFloat)
	const seconds = (minutesFloat - minutes) * 60
	
	return `${degrees}°${minutes}'${seconds.toFixed(1)}"${direction}`
}

/**
 * Format coordinate for display
 * Example: -8.7273584, 115.1777784 → "-8.7274°, 115.1778°"
 */
export function formatCoordinate(lat: number, lon: number, precision = 4): string {
	return `${lat.toFixed(precision)}°, ${lon.toFixed(precision)}°`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch (err) {
		console.error('Failed to copy:', err)
		return false
	}
}
