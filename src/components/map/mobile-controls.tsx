import { useState } from "react"
import { useMap } from "react-map-gl/maplibre"
import { 
	Plus, 
	Minus, 
	Navigation,
	X,
	Map as MapIcon,
} from "lucide-react"
import { useUIStore } from "../../stores/ui-store"
import { BASEMAP_OPTIONS } from "../../constants"

export function MobileControls() {
	const { current: map } = useMap()
	const { basemapId, setBasemapId, layers, toggleLayer } = useUIStore()
	const [showBasemapMenu, setShowBasemapMenu] = useState(false)
	const [showLayersMenu, setShowLayersMenu] = useState(false)

	const handleZoomIn = () => {
		map?.zoomIn()
	}

	const handleZoomOut = () => {
		map?.zoomOut()
	}

	const handleLocate = () => {
		if (!map) return
		
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords
					map.flyTo({
						center: [longitude, latitude],
						zoom: 16,
						duration: 1000,
					})
				},
				(error) => {
					console.error("Geolocation error:", error)
				},
				{ enableHighAccuracy: true, timeout: 5000 }
			)
		}
	}



	return (
		<>
			{/* Main Controls - Bottom Right */}
			<div className="absolute bottom-6 right-4 z-30 flex flex-col gap-2">
				{/* Zoom Controls */}
				<div className="flex flex-col rounded-xl bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-lg overflow-hidden">
					<button
						onClick={handleZoomIn}
						className="p-3 hover:bg-zinc-800 active:bg-zinc-700 transition-colors border-b border-zinc-700"
						aria-label="Zoom in"
					>
						<Plus className="h-5 w-5 text-zinc-300" />
					</button>
					<button
						onClick={handleZoomOut}
						className="p-3 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
						aria-label="Zoom out"
					>
						<Minus className="h-5 w-5 text-zinc-300" />
					</button>
				</div>

				{/* Locate Button */}
				<button
					onClick={handleLocate}
					className="p-3 rounded-xl bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-lg hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
					aria-label="My location"
				>
					<Navigation className="h-5 w-5 text-blue-400" />
				</button>

				{/* Basemap Button */}
				<button
					onClick={() => {
						setShowBasemapMenu(true)
						setShowLayersMenu(false)
					}}
					className="p-3 rounded-xl bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-lg hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
					aria-label="Change basemap"
				>
					<MapIcon className="h-5 w-5 text-zinc-300" />
				</button>

				{/* Layers Button */}
				<button
					onClick={() => {
						setShowLayersMenu(true)
						setShowBasemapMenu(false)
					}}
					className="p-3 rounded-xl bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-lg hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
					aria-label="Toggle layers"
				>
					<Layers className="h-5 w-5 text-zinc-300" />
				</button>
			</div>

			{/* Basemap Menu Modal */}
			{showBasemapMenu && (
				<div 
					className="absolute inset-0 z-40 bg-black/50 flex items-end"
					onClick={() => setShowBasemapMenu(false)}
				>
					<div 
						className="w-full bg-zinc-900 rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-sm font-semibold text-zinc-200">Basemap</h3>
							<button 
								onClick={() => setShowBasemapMenu(false)}
								className="p-1 rounded-full hover:bg-zinc-800"
							>
								<X className="h-4 w-4 text-zinc-400" />
							</button>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{BASEMAP_OPTIONS.map((basemap) => (
								<button
									key={basemap.id}
									onClick={() => {
										setBasemapId(basemap.id)
										setShowBasemapMenu(false)
									}}
									className={`p-3 rounded-xl border text-left transition-colors ${
										basemapId === basemap.id
											? "border-blue-500 bg-blue-500/10"
											: "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
									}`}
								>
									<div className="text-xs font-medium text-zinc-200">{basemap.name}</div>
									{basemapId === basemap.id && (
										<div className="mt-1 text-[10px] text-blue-400">Active</div>
									)}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Layers Menu Modal */}
			{showLayersMenu && (
				<div 
					className="absolute inset-0 z-40 bg-black/50 flex items-end"
					onClick={() => setShowLayersMenu(false)}
				>
					<div 
						className="w-full bg-zinc-900 rounded-t-2xl p-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-sm font-semibold text-zinc-200">Layers</h3>
							<button 
								onClick={() => setShowLayersMenu(false)}
								className="p-1 rounded-full hover:bg-zinc-800"
							>
								<X className="h-4 w-4 text-zinc-400" />
							</button>
						</div>
						<div className="space-y-2">
							{[
								{ key: "roads" as const, label: "Roads", icon: "🛣️" },
								{ key: "nodes" as const, label: "Nodes", icon: "📍" },
								{ key: "restrictions" as const, label: "Restrictions", icon: "🚫" },
								{ key: "access" as const, label: "Access", icon: "🔒" },
							].map(({ key, label, icon }) => (
								<button
									key={key}
									onClick={() => toggleLayer(key)}
									className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
										layers[key]
											? "border-blue-500 bg-blue-500/10"
											: "border-zinc-700 bg-zinc-800"
									}`}
								>
									<div className="flex items-center gap-3">
										<span>{icon}</span>
										<span className="text-sm text-zinc-200">{label}</span>
									</div>
									<div className={`w-10 h-5 rounded-full relative transition-colors ${
										layers[key] ? "bg-blue-500" : "bg-zinc-600"
									}`}>
										<div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
											layers[key] ? "translate-x-5" : "translate-x-0.5"
										}`} />
									</div>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
