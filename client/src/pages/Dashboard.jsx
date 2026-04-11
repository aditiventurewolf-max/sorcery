import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import { useNavigate } from 'react-router-dom'

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#222] rounded-lg px-5 py-4">
      <p className="text-[#555] text-xs mb-1">{label}</p>
      <p className={`font-mono text-2xl font-medium ${accent || 'text-white'}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: stats, loading: statsLoading } = useApi('/api/stats', [])
  const { data: projects, loading: projectsLoading, refetch } = useApi('/api/projects', [])
  const [showModal, setShowModal] = useState(false)

  const handleCreated = (project) => {
    setShowModal(false)
    refetch()
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-xl font-semibold">Dashboard</h1>
          <p className="text-[#555] text-sm mt-0.5">Vendor sourcing overview</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Project
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#222] rounded-lg px-5 py-4 animate-pulse h-20" />
          ))
        ) : stats ? (
          <>
            <StatCard label="Active Projects" value={stats.activeProjects} accent="text-amber-400" />
            <StatCard label="Vendors in DB" value={stats.totalVendors} />
            <StatCard label="Emails Sent (7d)" value={stats.sentThisWeek} accent="text-blue-400" />
            <StatCard label="Pending Replies" value={stats.pendingReplies} accent="text-purple-400" />
          </>
        ) : null}
      </div>

      {/* Projects list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#888] text-xs font-medium uppercase tracking-wider">Projects</h2>
        <span className="text-[#444] text-xs font-mono">{projects?.length || 0} total</span>
      </div>

      {projectsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#222] rounded-lg p-4 animate-pulse h-28" />
          ))}
        </div>
      ) : projects?.length ? (
        <div className="grid grid-cols-2 gap-3">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="border border-dashed border-[#222] rounded-lg p-12 text-center">
          <p className="text-[#444] text-sm">No projects yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-amber-500 text-sm hover:text-amber-400"
          >
            Create your first project →
          </button>
        </div>
      )}

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
