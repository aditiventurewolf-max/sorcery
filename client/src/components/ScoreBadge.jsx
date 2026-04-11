export default function ScoreBadge({ score }) {
  if (score == null) return <span className="font-mono text-xs text-[#555]">—</span>

  const color =
    score >= 80
      ? 'bg-green-900/40 text-green-400 border-green-800/50'
      : score >= 60
      ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50'
      : 'bg-red-900/40 text-red-400 border-red-800/50'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-mono text-xs font-medium ${color}`}>
      {score}
    </span>
  )
}
