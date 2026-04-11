import { useState } from 'react'
import { apiCall } from '../hooks/useApi'
import Spinner from './Spinner'

const CATEGORIES = ['LMS', 'Video Production', 'Assessment Tools', 'Content Writing', 'Design Agency', 'Other']

export default function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', category: '', budget_range: '', timeline: '', requirements: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Project name is required')
    setLoading(true)
    setError(null)
    try {
      const project = await apiCall('/api/projects', 'POST', form)
      onCreated(project)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
          <h2 className="text-white font-semibold text-sm">New Project</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Project Name *</label>
            <input
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
              placeholder="e.g. LMS Platform Evaluation Q2"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Category</label>
              <select
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Budget Range</label>
              <input
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
                placeholder="e.g. ₹5–10L / year"
                value={form.budget_range}
                onChange={e => set('budget_range', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Timeline</label>
            <input
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
              placeholder="e.g. Decision by end of April"
              value={form.timeline}
              onChange={e => set('timeline', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Description</label>
            <textarea
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              rows={2}
              placeholder="Brief overview of the project"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Requirements</label>
            <textarea
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              rows={4}
              placeholder="Describe what you need from the vendor: features, integrations, team size, deliverables, etc."
              value={form.requirements}
              onChange={e => set('requirements', e.target.value)}
            />
            <p className="text-xs text-[#444] mt-1">AI will parse this into scored criteria.</p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#888] hover:text-white border border-[#333] rounded hover:border-[#555] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-black bg-amber-500 hover:bg-amber-400 rounded font-medium transition-colors disabled:opacity-50"
            >
              {loading && <Spinner />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
