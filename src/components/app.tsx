import { Sidebar } from "./sidebar/sidebar"
import { MapViewer } from "./map/map-viewer"
import { BrowserWarning } from "./browser-warning"
import { AIQuerySidebar } from "./ai-query"
import { useUIStore } from "../stores/ui-store"

export function App() {
	const theme = useUIStore((s) => s.theme)

	return (
		<div className={`flex h-full bg-zinc-950 text-zinc-100 ${theme === "light" ? "theme-light" : ""}`}>
			<BrowserWarning />
			<Sidebar />
			<div className="flex-1 relative">
				<MapViewer />
			</div>
			<AIQuerySidebar />
		</div>
	)
}
