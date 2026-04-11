import { useState } from 'react'
import { apiCall } from '../hooks/useApi'
import Spinner from './Spinner'
import StatusBadge from './StatusBadge'
import ScoreBadge from './ScoreBadge'

export default function EmailPreviewPanel({ outreach, onUpdate }) {
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [replyMode, setReplyMode] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editSubject, setEditSubject] = useState(outreach.email_subject || '')
  const [editBody, setEditBody] = useState(outreach.email_body || '')

  const handleDraft = async () => {
    setDrafting(true)
    setError(null)
    try {
      const updated = await apiCall(`/api/outreach/draft-email/${outreach.id}`, 'POST')
      onUpdate(updated)
      setEditSubject(updated.email_subject)
      setEditBody(updated.email_body)
    } catch (err) {
      setError(err.message)
    } finally {
      setDrafting(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const updated = await apiCall(`/api/outreach/send/${outreach.id}`, 'POST')
      onUpdate(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status) => {
    try {
      const updated = await apiCall(`/api/outreach/${outreach.id}/status`, 'PUT', { status })
      onUpdate(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReplySubmit = async () => {
    try {
      const updated = await apiCall(`/api/outreach/${outreach.id}/reply`, 'PUT', { reply_content: replyText })
      onUpdate(updated)
      setReplyMode(false)
      setReplyText('')
    } catch (err) {
      setError(err.message)
    }
  }

  const hasEmail = outreach.email_subject && outreach.email_body
  const canSend = hasEmail && outreach.status === 'draft'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Vendor header */}
      <div className="px-4 py-4 border-b border-[#222] flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm">{outreach.vendor_name}</h3>
            <p className="text-[#555] text-xs mt-0.5">{outreach.vendor_category}</p>
          </div>
          <div className="flex items-center gap-2">
            <ScoreBadge score={outreach.fit_score} />
            <StatusBadge status={outreach.status} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Vendor profile */}
        <div className="px-4 py-3 border-b border-[#1e1e1e]">
          <p className="text-[#777] text-xs leading-relaxed mb-2">{outreach.vendor_description}</p>
          {outreach.fit_rationale && (
            <div className="bg-amber-950/20 border border-amber-900/30 rounded px-3 py-2">
              <p className="text-amber-400 text-xs">{outreach.fit_rationale}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#555]">
            {outreach.vendor_email && <span>{outreach.vendor_email}</span>}
            {outreach.vendor_website && <a href={outreach.vendor_website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">{outreach.vendor_website}</a>}
            {outreach.vendor_phone && <span>{outreach.vendor_phone}</span>}
          </div>
        </div>

        {/* Email preview */}
        <div className="px-4 py-3">
          {hasEmail ? (
            editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#555] block mb-1">Subject</label>
                  <input
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#555] block mb-1">Body</label>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={10}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-[#444]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const updated = await apiCall(`/api/outreach/${outreach.id}/status`, 'PUT', {
                          status: outreach.status
                        })
                        // Also save subject/body via a PATCH-style workaround — update inline
                        onUpdate({ ...updated, email_subject: editSubject, email_body: editBody })
                        setEditMode(false)
                      } catch (err) {
                        setError(err.message)
                      }
                    }}
                    className="flex-1 py-1.5 text-xs text-black bg-amber-500 rounded hover:bg-amber-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#555] uppercase tracking-wide">Email Draft</span>
                  <button onClick={() => setEditMode(true)} className="text-xs text-[#555] hover:text-amber-400">Edit</button>
                </div>
                <div className="bg-[#111] border border-[#1e1e1e] rounded p-3 space-y-2">
                  <p className="text-[#aaa] text-xs font-medium">Subject: {outreach.email_subject}</p>
                  <pre className="text-[#777] text-xs whitespace-pre-wrap font-sans leading-relaxed">{outreach.email_body}</pre>
                </div>
              </div>
            )
          ) : (
            <div className="border border-dashed border-[#222] rounded p-6 text-center">
              <p className="text-[#444] text-xs mb-3">No email drafted yet</p>
              <button
                onClick={handleDraft}
                disabled={drafting}
                className="flex items-center gap-2 mx-auto px-3 py-1.5 text-xs text-black bg-amber-500 hover:bg-amber-400 rounded font-medium disabled:opacity-50"
              >
                {drafting && <Spinner size="sm" />}
                {drafting ? 'Drafting...' : 'Draft with AI'}
              </button>
            </div>
          )}

          {/* Reply log */}
          {outreach.reply_content && (
            <div className="mt-3 bg-purple-950/20 border border-purple-900/30 rounded p-3">
              <p className="text-purple-400 text-xs font-medium mb-1">Vendor Reply</p>
              <p className="text-[#aaa] text-xs whitespace-pre-wrap">{outreach.reply_content}</p>
            </div>
          )}

          {/* Log reply form */}
          {replyMode && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Paste the vendor's reply here..."
                rows={4}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-amber-500 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setReplyMode(false)} className="flex-1 py-1.5 text-xs text-[#888] border border-[#333] rounded">Cancel</button>
                <button onClick={handleReplySubmit} className="flex-1 py-1.5 text-xs text-black bg-amber-500 rounded hover:bg-amber-400">Save Reply</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-[#222] flex-shrink-0 space-y-2">
        {error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded px-3 py-2">
            <p className="text-red-400 text-xs">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-[#555] mt-1">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {hasEmail && outreach.status === 'draft' && (
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="flex items-center justify-center gap-1 py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
            >
              {drafting && <Spinner size="sm" />}
              Redraft
            </button>
          )}
          {!hasEmail && (
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="col-span-2 flex items-center justify-center gap-1 py-2 text-xs text-black bg-amber-500 hover:bg-amber-400 rounded font-medium disabled:opacity-50"
            >
              {drafting && <Spinner size="sm" />}
              {drafting ? 'Drafting email...' : 'Draft Email with AI'}
            </button>
          )}
          {canSend && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center justify-center gap-1 py-1.5 text-xs text-black bg-amber-500 hover:bg-amber-400 rounded font-medium disabled:opacity-50"
            >
              {sending && <Spinner size="sm" />}
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {outreach.status !== 'replied' && !replyMode && (
            <button
              onClick={() => setReplyMode(true)}
              className="py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-purple-500 hover:text-purple-400"
            >
              Log Reply
            </button>
          )}
          {outreach.status !== 'shortlisted' && (
            <button
              onClick={() => handleStatusChange('shortlisted')}
              className="py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-green-500 hover:text-green-400"
            >
              Shortlist
            </button>
          )}
          {outreach.status !== 'rejected' && (
            <button
              onClick={() => handleStatusChange('rejected')}
              className="py-1.5 text-xs text-[#888] border border-[#333] rounded hover:border-red-500 hover:text-red-400"
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
