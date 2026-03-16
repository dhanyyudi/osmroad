import { useUIStore, type SidebarTab } from "../../stores/ui-store"
import { FilePanel } from "./file-panel"
import { InspectPanel } from "./inspect-panel"
import { EditPanel } from "./edit-panel"
import { SearchPanel } from "./search-panel"
import { RoutingPanel } from "./routing-panel"
import { SpeedPanel } from "./speed-panel"
import { LayersPanel } from "./layers-panel"
import { ExportPanel } from "./export-panel"
import {
	FileText,
	Search,
	Eye,
	Edit3,
	Navigation,
	Gauge,
	Layers,
	Download,
	PanelLeftClose,
	PanelLeft,
} from "lucide-react"

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof FileText }> = [
	{ id: "file", label: "File", icon: FileText },
	{ id: "search", label: "Search", icon: Search },
	{ id: "inspect", label: "Inspect", icon: Eye },
	{ id: "edit", label: "Edit", icon: Edit3 },
	{ id: "routing", label: "Route", icon: Navigation },
	{ id: "speed", label: "Speed", icon: Gauge },
	{ id: "layers", label: "Layers", icon: Layers },
	{ id: "export", label: "Export", icon: Download },
]

const PANELS: Record<SidebarTab, () => React.JSX.Element> = {
	file: FilePanel,
	search: SearchPanel,
	inspect: InspectPanel,
	edit: EditPanel,
	routing: RoutingPanel,
	speed: SpeedPanel,
	layers: LayersPanel,
	export: ExportPanel,
}

export function Sidebar() {
	const { activeTab, sidebarOpen, setActiveTab, toggleSidebar } = useUIStore()

	if (!sidebarOpen) {
		return (
			<div className="absolute left-0 top-0 bottom-0 z-10 flex flex-col bg-zinc-900/95 backdrop-blur border-r border-zinc-800">
				<button
					onClick={toggleSidebar}
					className="p-2.5 text-zinc-400 hover:text-zinc-200 border-b border-zinc-800"
				>
					<PanelLeft className="h-5 w-5" />
				</button>
				{/* Icon-only tab bar when collapsed */}
				{TABS.map(({ id, label, icon: Icon }) => (
					<button
						key={id}
						onClick={() => {
							setActiveTab(id)
							toggleSidebar()
						}}
						className={`p-2.5 transition-colors ${
							activeTab === id
								? "text-blue-400 bg-zinc-800"
								: "text-zinc-500 hover:text-zinc-300"
						}`}
						title={label}
					>
						<Icon className="h-4 w-4" />
					</button>
				))}
			</div>
		)
	}

	const PanelComponent = PANELS[activeTab]

	return (
		<div className="flex h-full">
			{/* Icon rail */}
			<div className="flex w-11 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
				<button
					onClick={toggleSidebar}
					className="p-2.5 text-zinc-400 hover:text-zinc-200 border-b border-zinc-800"
				>
					<PanelLeftClose className="h-4.5 w-4.5" />
				</button>
				{TABS.map(({ id, label, icon: Icon }) => (
					<button
						key={id}
						onClick={() => setActiveTab(id)}
						className={`p-2.5 transition-colors ${
							activeTab === id
								? "text-blue-400 bg-zinc-800/80"
								: "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
						}`}
						title={label}
					>
						<Icon className="h-4 w-4" />
					</button>
				))}
			</div>

			{/* Panel */}
			<div className="flex w-72 shrink-0 flex-col bg-zinc-900">
				<div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
					<span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
						{TABS.find((t) => t.id === activeTab)?.label}
					</span>
					<span className="text-[10px] text-zinc-600">RoadLens</span>
				</div>
				<div className="flex-1 overflow-y-auto">
					<PanelComponent />
				</div>
			</div>
		</div>
	)
}
