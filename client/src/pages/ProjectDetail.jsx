import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi, apiCall } from '../hooks/useApi'
import VendorKanbanCard from '../components/VendorKanbanCard'
import EmailPreviewPanel from '../components/EmailPreviewPanel'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_COLUMNS = ['draft', 'sent', 'replied', 'shortlisted', 'rejected']
const STATUS_LABELS = {
  draft: 'Discovered',
  sent: 'Sent',
  replied: 'Replied',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected'
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, loading, error, refetch } = useApi(`/api/projects/${id}`, [id])
  const [selectedId, setSelectedId] = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  const [discoverProgress, setDiscoverProgress] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const outreachList = project?.outreach || []
  const selectedOutreach = outreachList.find(o => o.id === selectedId)

  const handleDiscover = async () => {
    setDiscovering(true)
    setDiscoverError(null)
    const vendorCount = outreachList.length || '...'
    setDiscoverProgress(`Scoring vendors...`)
    try {
      await apiCall(`/api/outreach/discover/${id}`, 'POST')
      await refetch()
      setDiscoverProgress('')
    } catch (err) {
      setDiscoverError(err.message)
      setDiscoverProgress('')
    } finally {
      setDiscovering(false)
    }
  }

  const handleOutreachUpdate = useCallback((updated) => {
    refetch()
  }, [refetch])

  const handleDelete = async () => {
    await apiCall(`/api/projects/${id}`, 'DELETE')
    navigate('/')
  }

  const handleEditSave = async () => {
    await apiCall(`/api/projects/${id}`, 'PUT', editForm)
    await refetch()
    setEditMode(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400 text-sm">Failed to load project: {error}</p>
      </div>
    )
  }

  const criteria = (() => {
    try { return JSON.parse(project.parsed_criteria || '[]') } catch { return [] }
  })()

  const WEIGHT_COLORS = { high: 'text-red-400 border-red-900/40 bg-red-950/20', medium: 'text-yellow-400 border-yellow-900/40 bg-yellow-950/20', low: 'text-[#777] border-[#333] bg-[#1a1a1a]' }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — project info */}
      <div className="w-64 flex-shrink-0 border-r border-[#222] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-[#222] flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#555] hover:text-[#888] mb-3 flex items-center gap-1"
          >
            ← Back
          </button>
          {editMode && editForm ? (
            <div className="space-y-2">
              <input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                value={editForm.category || ''}
                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Category"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="flex-1 py-1.5 text-xs text-[#888] border border-[#333] rounded">Cancel</button>
                <button onClick={handleEditSave} className="flex-1 py-1.5 text-xs text-black bg-amber-500 rounded">Save</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-white font-medium text-sm leading-snug">{project.name}</h2>
                <button
                  onClick={() => { setEditMode(true); setEditForm({ name: project.name, category: project.category, description: project.description, budget_range: project.budget_range, timeline: project.timeline, requirements: project.requirements, status: project.status }) }}
                  className="text-[#444] hover:text-[#888] text-xs flex-shrink-0 mt-0.5"
                >
                  Edit
                </button>
              </div>
              {project.category && <p className="text-[#555] text-xs mt-1">{project.category}</p>}
              <div className="mt-2"><StatusBadge status={project.status} /></div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {project.budget_range && (
            <div>
              <p className="text-[#444] text-xs mb-1">Budget</p>
              <p className="text-[#888] text-xs">{project.budget_range}</p>
            </div>
          )}
          {project.timeline && (
            <div>
              <p className="text-[#444] text-xs mb-1">Timeline</p>
              <p className="text-[#888] text-xs">{project.timeline}</p>
            </div>
          )}
          {project.requirements && (
            <div>
              <p className="text-[#444] text-xs mb-1">Requirements</p>
              <p className="text-[#666] text-xs leading-relaxed">{project.requirements}</p>
            </div>
          )}
          {criteria.length > 0 && (
            <div>
              <p className="text-[#444] text-xs mb-2">Parsed Criteria</p>
              <div className="space-y-1.5">
                {criteria.map((c, i) => (
                  <div key={i} className={`text-xs px-2 py-1.5 rounded border ${WEIGHT_COLORS[c.weight] || WEIGHT_COLORS.low}`}>
                    <span className="opacity-60 text-[10px] uppercase mr-1.5">{c.weight}</span>
                    {c.criterion}
                  </div>
                ))}
              </div>
            </div>
          )}
          {criteria.length === 0 && project.requirements && (
            <p className="text-[#333] text-xs italic">AI criteria parsing in progress...</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#222] flex-shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full py-1.5 text-xs text-[#555] hover:text-red-400 border border-[#222] hover:border-red-900/40 rounded transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>

      {/* Center panel — vendor pipeline */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#222]">
        <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between flex-shrink-0">
          <h3 className="text-[#888] text-xs uppercase tracking-wider">Vendor Pipeline</h3>
          <div className="flex items-center gap-3">
            {discoverError && (
              <span className="text-red-400 text-xs">{discoverError}</span>
            )}
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded disabled:opacity-50 transition-colors"
            >
              {discovering ? <Spinner size="sm" /> : <span>✦</span>}
              {discovering ? discoverProgress || 'Scoring vendors...' : outreachList.length ? 'Re-run Discovery' : 'Run Discovery'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {outreachList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-[#333] text-sm mb-2">No vendors discovered yet.</p>
              <p className="text-[#2a2a2a] text-xs">Click "Run Discovery" to score all vendors against your criteria.</p>
            </div>
          ) : (
            STATUS_COLUMNS.map(status => {
              const items = outreachList.filter(o => o.status === status)
              if (status === 'rejected' && items.length === 0) return null
              return (
                <div key={status} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#444] text-xs uppercase tracking-wider">{STATUS_LABELS[status]}</span>
                    <span className="text-[#333] font-mono text-xs">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="border border-dashed border-[#1e1e1e] rounded px-3 py-2">
                      <p className="text-[#2a2a2a] text-xs text-center">—</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map(o => (
                        <VendorKanbanCard
                          key={o.id}
                          outreach={o}
                          isSelected={o.id === selectedId}
                          onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel — selected vendor detail */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
        {selectedOutreach ? (
          <EmailPreviewPanel
            key={selectedOutreach.id}
            outreach={selectedOutreach}
            onUpdate={handleOutreachUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#2a2a2a] text-xs text-center px-6">Select a vendor from the pipeline to view details and draft emails.</p>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete project "${project.name}"? This will also remove all outreach records.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
