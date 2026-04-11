import { useState, useEffect } from 'react'
import { apiCall } from '../hooks/useApi'
import Spinner from './Spinner'

const CATEGORIES = ['LMS', 'Video Production', 'Assessment Tools', 'Content Writing', 'Design Agency', 'Other']

const EMPTY = { name: '', email: '', phone: '', website: '', category: '', description: '', past_work: '', notes: '' }

export default function AddVendorDrawer({ vendor, onClose, onSaved }) {
  const [form, setForm] = useState(vendor ? { ...vendor } : EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const isEdit = !!vendor

  useEffect(() => {
    setForm(vendor ? { ...vendor } : EMPTY)
  }, [vendor])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Vendor name is required')
    setLoading(true)
    setError(null)
    try {
      const saved = isEdit
        ? await apiCall(`/api/vendors/${vendor.id}`, 'PUT', form)
        : await apiCall('/api/vendors', 'POST', form)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="bg-[#181818] border-l border-[#222] w-full max-w-md flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] flex-shrink-0">
          <h2 className="text-white font-semibold text-sm">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Vendor Name *</label>
            <input
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
              placeholder="e.g. PixelFrame Studios"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Email</label>
              <input
                type="email"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
                placeholder="contact@vendor.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Phone</label>
              <input
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
                placeholder="+91-98..."
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Website</label>
            <input
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
              placeholder="https://vendor.com"
              value={form.website}
              onChange={e => set('website', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Description</label>
            <textarea
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              rows={3}
              placeholder="What does this vendor do?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Past Work</label>
            <textarea
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              rows={3}
              placeholder="Notable clients, projects, or achievements"
              value={form.past_work}
              onChange={e => set('past_work', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">Notes</label>
            <textarea
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              rows={2}
              placeholder="Internal notes, pricing, preferences..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </form>

        <div className="px-6 py-4 border-t border-[#222] flex-shrink-0 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#888] hover:text-white border border-[#333] rounded hover:border-[#555]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm text-black bg-amber-500 hover:bg-amber-400 rounded font-medium disabled:opacity-50"
          >
            {loading && <Spinner />}
            {isEdit ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}
