import { useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'

export default function ProjectCard({ project }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-[#1a1a1a] border border-[#222] rounded-lg p-4 cursor-pointer hover:border-[#333] hover:bg-[#1e1e1e] transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-medium truncate group-hover:text-amber-400 transition-colors">
            {project.name}
          </h3>
          {project.category && (
            <p className="text-[#555] text-xs mt-0.5">{project.category}</p>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.description && (
        <p className="text-[#666] text-xs mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs font-mono text-[#555]">
        <span>{project.vendor_count || 0} vendors</span>
        <span>{project.sent_count || 0} sent</span>
        {project.replied_count > 0 && (
          <span className="text-purple-400">{project.replied_count} replied</span>
        )}
        {project.shortlisted_count > 0 && (
          <span className="text-green-400">{project.shortlisted_count} shortlisted</span>
        )}
      </div>
    </div>
  )
}
