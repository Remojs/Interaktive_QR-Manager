"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, X, LogOut, ExternalLink, Download } from "lucide-react"
import { api, type QR, type Group } from "@/lib/api"

export default function HomePage() {
  const router = useRouter()
  const [qrs, setQrs] = useState<QR[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number | "ungrouped">>(new Set(["ungrouped"]))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Create form
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newGroupId, setNewGroupId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editUrl, setEditUrl] = useState("")
  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // New group modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  useEffect(() => {
    if (!localStorage.getItem("qr-auth")) {
      router.push("/")
      return
    }
    loadData()
  }, [router])

  async function loadData() {
    try {
      setLoading(true)
      setLoadError(null)
      const [fetchedQrs, fetchedGroups] = await Promise.all([api.getQrs(), api.getGroups()])
      setQrs(fetchedQrs)
      setGroups(fetchedGroups)
      // expand all groups by default
      setExpandedGroups(new Set(["ungrouped", ...fetchedGroups.map(g => g.id as number | "ungrouped")]))
    } catch {
      setLoadError("No se pudo conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQR = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newUrl) return
    try {
      setCreating(true)
      const created = await api.createQr(newName, newUrl, newGroupId)
      setQrs(prev => [created, ...prev])
      setNewName("")
      setNewUrl("")
      setNewGroupId(null)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al crear QR")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este código QR?")) return
    try {
      await api.deleteQr(id)
      setQrs(prev => prev.filter(q => q.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al eliminar")
    }
  }

  const handleEdit = (qr: QR) => {
    setEditingId(qr.id)
    setEditUrl(qr.destination_url)
    setEditGroupId(qr.group_id)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      setSaving(true)
      const current = qrs.find(q => q.id === editingId)!
      let updated = current
      if (editUrl !== current.destination_url) {
        updated = await api.updateQr(editingId, editUrl)
      }
      if (editGroupId !== current.group_id) {
        updated = await api.assignGroup(editingId, editGroupId)
      }
      setQrs(prev => prev.map(q => q.id === editingId ? updated : q))
      setEditingId(null)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const created = await api.createGroup(newGroupName.trim())
      setGroups(prev => [...prev, created])
      setExpandedGroups(prev => new Set([...prev, created.id]))
      setNewGroupName("")
      setShowNewGroupModal(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al crear grupo")
    }
  }

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("¿Eliminar este grupo? Los QR quedarán sin grupo.")) return
    try {
      await api.deleteGroup(id)
      setGroups(prev => prev.filter(g => g.id !== id))
      setQrs(prev => prev.map(q => q.group_id === id ? { ...q, group_id: null } : q))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al eliminar grupo")
    }
  }

  const toggleGroup = (key: number | "ungrouped") => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleLogout = () => {
    localStorage.removeItem("qr-auth")
    router.push("/")
  }

  const downloadQR = async (qr: QR) => {
    try {
      const res = await fetch(api.qrImageUrl(qr.id))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.download = `${qr.name}-qr.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("No se pudo descargar el QR")
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" })

  const thClass = "text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
  const inputClass = "bg-[#1a1a24] border border-[#2a2a3c] rounded px-2 py-1 text-sm w-full text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"

  const renderQRTable = (groupQrs: QR[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2a3c]">
            <th className={thClass}>#</th>
            <th className={thClass}>Nombre</th>
            <th className={thClass}>URL de destino</th>
            <th className={thClass}>QR</th>
            <th className={thClass}>Creado</th>
            <th className={thClass}>Grupo</th>
            <th className={thClass}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {groupQrs.map((qr, index) => (
            <tr key={qr.id} className="border-b border-[#2a2a3c] last:border-b-0 hover:bg-[#1a1a24] transition-colors">
              <td className="px-4 py-4 text-muted-foreground text-sm">{index + 1}</td>

              {/* Name — read-only (backend doesn't support rename) */}
              <td className="px-4 py-4">
                <span className="font-medium text-white">{qr.name}</span>
              </td>

              {/* URL */}
              <td className="px-4 py-4">
                {editingId === qr.id ? (
                  <input
                    type="url"
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    className={inputClass}
                  />
                ) : (
                  <a
                    href={qr.destination_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 text-sm"
                  >
                    {qr.destination_url.length > 35 ? qr.destination_url.substring(0, 35) + "…" : qr.destination_url}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </td>

              {/* QR image */}
              <td className="px-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={api.qrImageUrl(qr.id)}
                  alt={`QR ${qr.name}`}
                  width={48}
                  height={48}
                  className="rounded cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => downloadQR(qr)}
                  title="Click para descargar"
                />
              </td>

              {/* Created at */}
              <td className="px-4 py-4 text-muted-foreground text-sm">{formatDate(qr.created_at)}</td>

              {/* Group */}
              <td className="px-4 py-4">
                {editingId === qr.id ? (
                  <select
                    value={editGroupId ?? ""}
                    onChange={e => setEditGroupId(e.target.value ? Number(e.target.value) : null)}
                    className={inputClass}
                  >
                    <option value="">Sin grupo</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                    {groups.find(g => g.id === qr.group_id)?.name ?? "Sin grupo"}
                  </span>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  {editingId === qr.id ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground hover:text-white text-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => downloadQR(qr)}
                        className="p-1.5 text-muted-foreground hover:text-purple-400 transition-colors"
                        title="Descargar QR"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(qr)}
                        className="p-1.5 text-muted-foreground hover:text-purple-400 transition-colors"
                        title="Editar URL / grupo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(qr.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderGroup = (
    key: number | "ungrouped",
    title: string,
    groupQrs: QR[],
    groupId?: number,
  ) => {
    const isExpanded = expandedGroups.has(key)
    return (
      <div key={String(key)} className="border border-[#2a2a3c] rounded-lg overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 bg-[#1a1a24] cursor-pointer hover:bg-[#1e1e2e] transition-colors"
          onClick={() => toggleGroup(key)}
        >
          <div className="flex items-center gap-3">
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-purple-400" />
              : <ChevronRight className="w-4 h-4 text-purple-400" />}
            <span className="font-medium text-white">{title}</span>
            <span className="text-xs bg-[#2a2a3c] text-muted-foreground px-2 py-0.5 rounded">{groupQrs.length}</span>
          </div>
          {groupId !== undefined && (
            <button
              onClick={e => { e.stopPropagation(); handleDeleteGroup(groupId) }}
              className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
              title="Eliminar grupo"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="bg-[#151520]">
            {groupQrs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No hay códigos QR en este grupo
              </div>
            ) : renderQRTable(groupQrs)}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d0d12] relative">
      <div className="grid-background" />

      {/* Header */}
      <header className="border-b border-[#2a2a3c] bg-[#0d0d12]/80 backdrop-blur-sm sticky top-0 z-50 relative">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="Interaktive Logo" width={40} height={40} />
            <h1 className="text-xl font-semibold text-white">Interaktive QR Manager</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Salir</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {/* Create QR */}
        <div className="bg-[#151520] border border-[#2a2a3c] rounded-lg p-6 mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Crear nuevo código QR
          </h2>
          <form onSubmit={handleCreateQR} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="ej. Menu Pizzeria"
                className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-2.5 px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">URL de destino</label>
              <input
                type="url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-2.5 px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                required
              />
            </div>
            <div className="md:w-48">
              <label className="text-xs text-muted-foreground mb-1 block">Grupo</label>
              <select
                value={newGroupId ?? ""}
                onChange={e => setNewGroupId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Sin grupo</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="md:self-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-6 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {creating ? "Creando…" : "Crear QR"}
              </button>
            </div>
          </form>
        </div>

        {/* QR List */}
        <div className="bg-[#151520] border border-[#2a2a3c] rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-medium text-purple-400 uppercase tracking-wider">Códigos QR</h2>
              <span className="text-xs bg-[#2a2a3c] text-muted-foreground px-2 py-0.5 rounded">{qrs.length}</span>
            </div>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-1.5 px-4 rounded-md transition-all flex items-center gap-2"
            >
              <Plus className="w-3 h-3" />
              Nuevo Grupo
            </button>
          </div>

          {loadError && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-3 rounded-md mb-4">
              {loadError} —{" "}
              <button onClick={loadData} className="underline hover:text-red-300">reintentar</button>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Cargando…</div>
          ) : (
            <div className="space-y-4">
              {groups.map(g =>
                renderGroup(g.id, g.name, qrs.filter(q => q.group_id === g.id), g.id)
              )}
              {renderGroup("ungrouped", "Sin grupo", qrs.filter(q => q.group_id === null))}
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#151520] border border-[#2a2a3c] rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Crear nuevo grupo</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateGroup()}
              placeholder="Nombre del grupo"
              className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-2.5 px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowNewGroupModal(false); setNewGroupName("") }}
                className="px-4 py-2 text-muted-foreground hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateGroup}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-all"
              >
                Crear grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
