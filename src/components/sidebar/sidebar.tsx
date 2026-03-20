import { useUIStore, type SidebarTab } from "../../stores/ui-store"
import { FilePanel } from "./file-panel"
import { InspectPanel } from "./inspect-panel"
import { EditPanel } from "./edit-panel"
import { SearchPanel } from "./search-panel"
import { RoutingPanel } from "./routing-panel"
import { SpeedPanel } from "./speed-panel"
import { LayersPanel } from "./layers-panel"
import { ExportPanel } from "./export-panel"
import { AIQueryPanel } from "./ai-query-panel"
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
	Sparkles,
} from "lucide-react"

const MAIN_TABS: Array<{ id: SidebarTab; label: string; icon: typeof FileText }> = [
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
	ai: AIQueryPanel,
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
				
				{/* AI Tab - Highlighted at top */}
				<button
					onClick={() => {
						setActiveTab("ai")
						toggleSidebar()
					}}
					className={`p-2.5 transition-colors border-b border-zinc-800 ${
						activeTab === "ai"
							? "text-purple-400 bg-purple-500/10"
							: "text-zinc-400 hover:text-purple-300 hover:bg-purple-500/5"
					}`}
					title="AI Query"
				>
					<Sparkles className="h-4 w-4 mx-auto" />
				</button>

				{/* Divider */}
				<div className="border-b border-zinc-800 my-1" />

				{/* Main tabs */}
				<div className="flex-1 overflow-y-auto">
					{MAIN_TABS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							onClick={() => {
								setActiveTab(id)
								toggleSidebar()
							}}
							className={`w-full p-2.5 transition-colors ${
								activeTab === id
									? "text-blue-400 bg-zinc-800"
									: "text-zinc-500 hover:text-zinc-300"
							}`}
							title={label}
						>
							<Icon className="h-4 w-4 mx-auto" />
						</button>
					))}
				</div>
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

				{/* AI Tab - Highlighted at top */}
				<button
					onClick={() => setActiveTab("ai")}
					className={`p-2.5 transition-colors border-b border-zinc-800 ${
						activeTab === "ai"
							? "text-purple-400 bg-purple-500/20"
							: "text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10"
					}`}
					title="AI Query"
				>
					<Sparkles className="h-4 w-4 mx-auto" />
				</button>

				{/* Divider */}
				<div className="border-b border-zinc-800 my-1" />

				{/* Main tabs */}
				<div className="flex-1 overflow-y-auto">
					{MAIN_TABS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							onClick={() => setActiveTab(id)}
							className={`w-full p-2.5 transition-colors ${
								activeTab === id
									? "text-blue-400 bg-zinc-800/80"
									: "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
							}`}
							title={label}
						>
							<Icon className="h-4 w-4 mx-auto" />
						</button>
					))}
				</div>
			</div>

			{/* Panel */}
			<div className="flex w-72 shrink-0 flex-col bg-zinc-900">
				<div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
					<span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
						{activeTab === "ai" ? "AI Query" : MAIN_TABS.find((t) => t.id === activeTab)?.label}
					</span>
					<span className="text-[10px] text-zinc-600">OSMRoad</span>
				</div>
				<div className="flex-1 overflow-hidden">
					<PanelComponent />
				</div>
			</div>
		</div>
	)
}
