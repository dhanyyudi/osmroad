import { useState, useCallback } from "react"
import { useOsmStore } from "../../stores/osm-store"
import { useOsm } from "../../hooks/use-osm"
import { Plus, Trash2, Save, Edit3, Loader2, CheckCircle } from "lucide-react"

export function EditPanel() {
	const entity = useOsmStore((s) => s.selectedEntity)
	const selectEntity = useOsmStore((s) => s.selectEntity)
	const { remote } = useOsm()
	const dataset = useOsmStore((s) => s.dataset)
	const [editingTags, setEditingTags] = useState<Record<string, string>>({})
	const [isEditing, setIsEditing] = useState(false)
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [newKey, setNewKey] = useState("")
	const [newValue, setNewValue] = useState("")

	const startEditing = useCallback(() => {
		if (entity) {
			setEditingTags({ ...entity.tags })
			setIsEditing(true)
			setSaved(false)
			setError(null)
		}
	}, [entity])

	const handleSave = useCallback(async () => {
		if (!entity || !remote || !dataset) return
		setSaving(true)
		setError(null)
		try {
			// Persist changes to the worker's Osm instance
			await remote
				.getWorker()
				.editEntityTags(
					dataset.osmId,
					entity.type,
					entity.id,
					editingTags,
				)

			// Update UI state
			selectEntity({ ...entity, tags: editingTags })
			setIsEditing(false)
			setSaved(true)
			setTimeout(() => setSaved(false), 3000)
		} catch (err) {
			console.error("Failed to save tags:", err)
			setError(String(err))
		} finally {
			setSaving(false)
		}
	}, [entity, remote, dataset, editingTags, selectEntity])

	const addTag = useCallback(() => {
		if (newKey.trim()) {
			setEditingTags((prev) => ({ ...prev, [newKey.trim()]: newValue }))
			setNewKey("")
			setNewValue("")
		}
	}, [newKey, newValue])

	const removeTag = useCallback((key: string) => {
		setEditingTags((prev) => {
			const next = { ...prev }
			delete next[key]
			return next
		})
	}, [])

	if (!entity) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500">
				<Edit3 className="h-8 w-8" />
				<span className="text-sm">Select an entity to edit tags</span>
			</div>
		)
	}

	if (!isEditing) {
		return (
			<div className="flex flex-col gap-3 p-4">
				<div className="text-sm text-zinc-300">
					{entity.type}/{entity.id}
				</div>
				{saved && (
					<div className="flex items-center gap-1.5 text-xs text-green-400">
						<CheckCircle className="h-3 w-3" />
						Tags saved — changes will be included in PBF export
					</div>
				)}
				<button
					onClick={startEditing}
					className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
				>
					<Edit3 className="h-4 w-4" />
					Edit Tags
				</button>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="text-sm font-semibold text-zinc-300">
				Editing: {entity.type}/{entity.id}
			</div>

			{error && (
				<div className="rounded bg-red-900/50 p-2 text-xs text-red-300">
					{error}
				</div>
			)}

			<div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
				{Object.entries(editingTags).map(([key, value]) => (
					<div key={key} className="flex items-center gap-1">
						<input
							className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700"
							value={key}
							readOnly
						/>
						<input
							className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700"
							value={value}
							onChange={(e) =>
								setEditingTags((prev) => ({
									...prev,
									[key]: e.target.value,
								}))
							}
						/>
						<button
							onClick={() => removeTag(key)}
							className="p-1 text-red-400 hover:text-red-300"
						>
							<Trash2 className="h-3 w-3" />
						</button>
					</div>
				))}
			</div>

			<div className="flex items-center gap-1 border-t border-zinc-700 pt-2">
				<input
					className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700"
					placeholder="key"
					value={newKey}
					onChange={(e) => setNewKey(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && addTag()}
				/>
				<input
					className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700"
					placeholder="value"
					value={newValue}
					onChange={(e) => setNewValue(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && addTag()}
				/>
				<button
					onClick={addTag}
					className="p-1 text-green-400 hover:text-green-300"
				>
					<Plus className="h-3 w-3" />
				</button>
			</div>

			<div className="flex gap-2">
				<button
					onClick={handleSave}
					disabled={saving}
					className="flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50 flex-1"
				>
					{saving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Save className="h-4 w-4" />
					)}
					{saving ? "Saving..." : "Save"}
				</button>
				<button
					onClick={() => setIsEditing(false)}
					className="rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600 flex-1"
				>
					Cancel
				</button>
			</div>
		</div>
	)
}
