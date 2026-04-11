import { useState } from 'react'
import { useApi, apiCall } from '../hooks/useApi'
import AddVendorDrawer from '../components/AddVendorDrawer'
import ConfirmDialog from '../components/ConfirmDialog'

const CATEGORIES = ['LMS', 'Video Production', 'Assessment Tools', 'Content Writing', 'Design Agency', 'Other']

export default function Vendors() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)
  const [editVendor, setEditVendor] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const query = new URLSearchParams()
  if (categoryFilter) query.set('category', categoryFilter)
  if (search) query.set('search', search)
  const { data: vendors, loading, refetch } = useApi(`/api/vendors?${query}`, [search, categoryFilter])

  const handleSaved = () => {
    setShowDrawer(false)
    setEditVendor(null)
    refetch()
  }

  const handleDelete = async () => {
    await apiCall(`/api/vendors/${confirmDelete.id}`, 'DELETE')
    setConfirmDelete(null)
    refetch()
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-semibold">Vendor Database</h1>
          <p className="text-[#555] text-sm mt-0.5">{vendors?.length || 0} vendors</p>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded"
        >
          <span className="text-base leading-none">+</span>
          Add Vendor
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-5">
        <input
          className="flex-1 max-w-xs bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-amber-500"
          placeholder="Search vendors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || categoryFilter) && (
          <button
            onClick={() => { setSearch(''); setCategoryFilter('') }}
            className="px-3 py-2 text-xs text-[#555] hover:text-white border border-[#2a2a2a] rounded"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#222] rounded h-14 animate-pulse" />
          ))}
        </div>
      ) : vendors?.length ? (
        <div className="border border-[#222] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222] bg-[#161616]">
                <th className="text-left text-xs text-[#555] uppercase tracking-wider px-4 py-3 font-medium">Vendor</th>
                <th className="text-left text-xs text-[#555] uppercase tracking-wider px-4 py-3 font-medium">Category</th>
                <th className="text-left text-xs text-[#555] uppercase tracking-wider px-4 py-3 font-medium">Email</th>
                <th className="text-left text-xs text-[#555] uppercase tracking-wider px-4 py-3 font-medium w-64">Past Work</th>
                <th className="text-right text-xs text-[#555] uppercase tracking-wider px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => (
                <tr
                  key={v.id}
                  className={`border-b border-[#1e1e1e] hover:bg-[#181818] transition-colors ${i % 2 === 0 ? 'bg-[#141414]' : 'bg-[#161616]'}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{v.name}</p>
                      {v.description && (
                        <p className="text-[#555] text-xs mt-0.5 max-w-xs truncate">{v.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {v.category ? (
                      <span className="text-xs text-[#888] bg-[#1e1e1e] border border-[#2a2a2a] rounded px-2 py-0.5">{v.category}</span>
                    ) : (
                      <span className="text-[#333] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#666] text-xs font-mono">{v.email || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#555] text-xs truncate max-w-xs">{v.past_work || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditVendor(v)}
                        className="text-xs text-[#555] hover:text-amber-400 px-2 py-1 rounded hover:bg-[#1e1e1e]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(v)}
                        className="text-xs text-[#555] hover:text-red-400 px-2 py-1 rounded hover:bg-[#1e1e1e]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-[#222] rounded-lg p-12 text-center">
          <p className="text-[#444] text-sm">No vendors found.</p>
        </div>
      )}

      {(showDrawer || editVendor) && (
        <AddVendorDrawer
          vendor={editVendor}
          onClose={() => { setShowDrawer(false); setEditVendor(null) }}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete vendor "${confirmDelete.name}"? This will also remove all outreach records for this vendor.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
