import { Sidebar } from "./sidebar/sidebar"
import { MapViewer } from "./map/map-viewer"
import { BrowserWarning } from "./browser-warning"
import { MobileControls } from "./map/mobile-controls"
import { useUIStore } from "../stores/ui-store"
import { useIsMobile } from "../hooks/use-media-query"

function DesktopLayout() {
	return (
		<div className="flex h-full">
			<Sidebar />
			<div className="flex-1 relative">
				<MapViewer />
			</div>
		</div>
	)
}

function MobileLayout() {
	return (
		<div className="flex flex-col h-full">
			{/* Map takes full screen */}
			<div className="flex-1 relative">
				<MapViewer />
			</div>
			
			{/* Floating controls overlay */}
			<MobileControls />
			
			{/* Sidebar (renders as bottom sheet on mobile) */}
			<Sidebar />
		</div>
	)
}

export function App() {
	const theme = useUIStore((s) => s.theme)
	const isMobile = useIsMobile()

	return (
		<div className={`h-full bg-zinc-950 text-zinc-100 ${theme === "light" ? "theme-light" : ""}`}>
			<BrowserWarning />
			{isMobile ? <MobileLayout /> : <DesktopLayout />}
		</div>
	)
}
