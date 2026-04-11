import ScoreBadge from './ScoreBadge'
import StatusBadge from './StatusBadge'

export default function VendorKanbanCard({ outreach, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`px-3 py-3 rounded border cursor-pointer transition-all ${
        isSelected
          ? 'border-amber-500/50 bg-amber-950/20'
          : 'border-[#222] bg-[#1a1a1a] hover:border-[#333] hover:bg-[#1e1e1e]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-white text-xs font-medium truncate">{outreach.vendor_name}</span>
        <ScoreBadge score={outreach.fit_score} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[#555] text-xs truncate flex-1">
          {outreach.fit_rationale || outreach.vendor_category || '—'}
        </p>
        <StatusBadge status={outreach.status} />
      </div>
    </div>
  )
}
