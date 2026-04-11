import { useState } from 'react'
import { useApi, apiCall } from '../hooks/useApi'
import StatusBadge from '../components/StatusBadge'
import ScoreBadge from '../components/ScoreBadge'
import Spinner from '../components/Spinner'

function MiniDetailDrawer({ cell, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleStatus = async (status) => {
    setLoading(true)
    try {
      await apiCall(`/api/outreach/${cell.outreach_id}/status`, 'PUT', { status })
      onUpdate()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white font-medium text-sm">{cell.vendor_name}</p>
            <p className="text-[#555] text-xs mt-0.5">{cell.project_name}</p>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <ScoreBadge score={cell.fit_score} />
          <StatusBadge status={cell.status} />
        </div>

        {cell.fit_rationale && (
          <p className="text-[#666] text-xs mb-4 leading-relaxed">{cell.fit_rationale}</p>
        )}

        {cell.email_subject && (
          <div className="bg-[#111] border border-[#222] rounded p-3 mb-4">
            <p className="text-[#aaa] text-xs font-medium mb-1">{cell.email_subject}</p>
            <p className="text-[#555] text-xs line-clamp-3">{cell.email_body}</p>
          </div>
        )}

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleStatus('shortlisted')}
            disabled={loading || cell.status === 'shortlisted'}
            className="py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-green-500 hover:text-green-400 disabled:opacity-40"
          >
            Shortlist
          </button>
          <button
            onClick={() => handleStatus('rejected')}
            disabled={loading || cell.status === 'rejected'}
            className="py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-red-500 hover:text-red-400 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StatusBoard() {
  const { data: projects, loading: projectsLoading, refetch } = useApi('/api/projects', [])
  const { data: vendors } = useApi('/api/vendors', [])
  const [selectedCell, setSelectedCell] = useState(null)

  // Build outreach map: { [vendorId]: { [projectId]: outreach } }
  const outreachMap = {}
  if (projects) {
    for (const p of projects) {
      // We need the full project to get outreach; we'll use a combined view approach
    }
  }

  // Fetch all outreach via projects list — for status board we load all projects' data
  const { data: allOutreach, loading: outreachLoading } = useApi(
    projects ? '/api/outreach/all' : null,
    [projects?.length]
  )

  // Simpler: build from stats endpoint, or just show the project+vendor grid from what we have
  // We'll fetch outreach per project and merge
  const [outreachData, setOutreachData] = useState({})

  // Load outreach for all projects in one shot using a useEffect-style approach
  // We use a derived approach: map outreach from project detail calls
  // For simplicity, we'll call the board data from an aggregate query
  const { data: boardData, loading: boardLoading } = useApi('/api/status-board', [])

  const loading = projectsLoading || boardLoading

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-white text-xl font-semibold mb-6">Status Board</h1>
        <div className="flex items-center gap-2 text-[#555] text-sm">
          <Spinner />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!boardData?.length) {
    return (
      <div className="p-8">
        <h1 className="text-white text-xl font-semibold mb-2">Status Board</h1>
        <p className="text-[#555] text-sm mb-8">Cross-project vendor pipeline view</p>
        <div className="border border-dashed border-[#222] rounded-lg p-12 text-center">
          <p className="text-[#444] text-sm">No outreach data yet.</p>
          <p className="text-[#333] text-xs mt-1">Run vendor discovery on a project to populate this board.</p>
        </div>
      </div>
    )
  }

  // boardData = array of { vendor_id, vendor_name, vendor_category, project_id, project_name, outreach_id, fit_score, fit_rationale, status, email_subject, email_body }
  const vendorIds = [...new Set(boardData.map(r => r.vendor_id))]
  const projectIds = [...new Set(boardData.map(r => r.project_id))]

  const vendorNames = {}
  const projectNames = {}
  boardData.forEach(r => {
    vendorNames[r.vendor_id] = r.vendor_name
    projectNames[r.project_id] = r.project_name
  })

  const cellMap = {}
  boardData.forEach(r => {
    cellMap[`${r.vendor_id}_${r.project_id}`] = r
  })

  const STATUS_COLORS = {
    draft:       'bg-[#1a1a1a] text-[#555]',
    sent:        'bg-blue-950/40 text-blue-400',
    replied:     'bg-purple-950/40 text-purple-400',
    shortlisted: 'bg-green-950/40 text-green-400',
    rejected:    'bg-red-950/20 text-red-600',
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-white text-xl font-semibold">Status Board</h1>
        <p className="text-[#555] text-sm mt-0.5">Cross-project vendor pipeline — {vendorIds.length} vendors × {projectIds.length} projects</p>
      </div>

      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left text-[#444] font-medium px-3 py-2 bg-[#111] border border-[#222] min-w-36 sticky left-0 z-10">
                Vendor
              </th>
              {projectIds.map(pid => (
                <th key={pid} className="text-[#888] font-medium px-3 py-2 bg-[#111] border border-[#222] min-w-40 text-left">
                  {projectNames[pid]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendorIds.map(vid => (
              <tr key={vid}>
                <td className="px-3 py-2 border border-[#1e1e1e] bg-[#141414] sticky left-0 z-10">
                  <p className="text-white font-medium">{vendorNames[vid]}</p>
                </td>
                {projectIds.map(pid => {
                  const cell = cellMap[`${vid}_${pid}`]
                  if (!cell) return (
                    <td key={pid} className="px-3 py-2 border border-[#1a1a1a] bg-[#111]">
                      <span className="text-[#2a2a2a]">—</span>
                    </td>
                  )
                  return (
                    <td
                      key={pid}
                      className="px-3 py-2 border border-[#1e1e1e] cursor-pointer hover:bg-[#1e1e1e] transition-colors"
                      onClick={() => setSelectedCell(cell)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs capitalize border ${
                          cell.status === 'draft'       ? 'bg-[#1e1e1e] text-[#555] border-[#2a2a2a]' :
                          cell.status === 'sent'        ? 'bg-blue-950/30 text-blue-400 border-blue-900/30' :
                          cell.status === 'replied'     ? 'bg-purple-950/30 text-purple-400 border-purple-900/30' :
                          cell.status === 'shortlisted' ? 'bg-green-950/30 text-green-400 border-green-900/30' :
                          'bg-red-950/20 text-red-500 border-red-900/20'
                        }`}>{cell.status}</span>
                        {cell.fit_score != null && (
                          <span className="font-mono text-[#444]">{cell.fit_score}</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <MiniDetailDrawer
          cell={selectedCell}
          onClose={() => setSelectedCell(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  )
}
