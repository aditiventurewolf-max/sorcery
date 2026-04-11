const STATUS_STYLES = {
  draft:       'bg-[#1e1e1e] text-[#888] border-[#333]',
  sent:        'bg-blue-900/30 text-blue-400 border-blue-800/40',
  replied:     'bg-purple-900/30 text-purple-400 border-purple-800/40',
  shortlisted: 'bg-green-900/30 text-green-400 border-green-800/40',
  rejected:    'bg-red-900/20 text-red-500 border-red-900/40',
  active:      'bg-amber-900/30 text-amber-400 border-amber-800/40',
  closed:      'bg-[#1e1e1e] text-[#555] border-[#333]',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  )
}
