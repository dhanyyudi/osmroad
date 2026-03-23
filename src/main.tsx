import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./components/app"
import { registerServiceWorker } from "./lib/service-worker"
import "./main.css"

// Register service worker for offline caching
registerServiceWorker({
	onUpdateAvailable: () => {
		console.log("[SW] Update available - reload to update")
		// Could show a toast notification here
	},
	onCachedDataAvailable: (url: string) => {
		console.log("[SW] Cached data available:", url)
	},
	onError: (error) => {
		console.error("[SW] Error:", error)
	},
})

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
