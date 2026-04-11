import { Router } from 'express'
import { getDb } from '../db/database.js'
import { scoreVendors, draftEmail } from '../services/ai.js'
import { sendEmail } from '../services/mailer.js'

const router = Router()

// GET all outreach for a project
router.get('/project/:projectId', (req, res) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT o.*, v.name as vendor_name, v.email as vendor_email,
           v.category as vendor_category, v.description as vendor_description,
           v.past_work as vendor_past_work, v.website as vendor_website,
           v.phone as vendor_phone, v.notes as vendor_notes
    FROM outreach o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.project_id = ?
    ORDER BY o.fit_score DESC
  `).all(req.params.projectId)
  res.json(rows)
})

// Run vendor discovery for a project
router.post('/discover/:projectId', async (req, res) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const vendors = db.prepare('SELECT * FROM vendors').all()
  if (!vendors.length) return res.status(400).json({ error: 'No vendors in database' })

  // Delete existing draft outreach for this project first
  db.prepare("DELETE FROM outreach WHERE project_id = ? AND status = 'draft'").run(project.id)

  let criteria = []
  if (project.parsed_criteria) {
    try { criteria = JSON.parse(project.parsed_criteria) } catch (_) {}
  }
  if (!criteria.length) {
    criteria = [{ criterion: project.requirements || project.description || project.category, weight: 'high' }]
  }

  let scores
  try {
    scores = await scoreVendors(criteria, vendors)
  } catch (err) {
    return res.status(500).json({ error: 'AI scoring failed: ' + err.message })
  }

  const insert = db.prepare(`
    INSERT INTO outreach (project_id, vendor_id, fit_score, fit_rationale, status)
    VALUES (?, ?, ?, ?, 'draft')
  `)

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(project.id, item.vendorId, item.score, item.rationale)
    }
  })
  insertMany(scores)

  const rows = db.prepare(`
    SELECT o.*, v.name as vendor_name, v.email as vendor_email,
           v.category as vendor_category, v.description as vendor_description,
           v.past_work as vendor_past_work, v.website as vendor_website,
           v.phone as vendor_phone, v.notes as vendor_notes
    FROM outreach o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.project_id = ?
    ORDER BY o.fit_score DESC
  `).all(project.id)

  res.json(rows)
})

// Draft email for one outreach row
router.post('/draft-email/:outreachId', async (req, res) => {
  const db = getDb()
  const outreach = db.prepare('SELECT * FROM outreach WHERE id = ?').get(req.params.outreachId)
  if (!outreach) return res.status(404).json({ error: 'Outreach not found' })

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(outreach.project_id)
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(outreach.vendor_id)

  let email
  try {
    email = await draftEmail(project, vendor, outreach)
  } catch (err) {
    return res.status(500).json({ error: 'AI draft failed: ' + err.message })
  }

  db.prepare('UPDATE outreach SET email_subject = ?, email_body = ? WHERE id = ?')
    .run(email.subject, email.body, outreach.id)

  const updated = db.prepare('SELECT * FROM outreach WHERE id = ?').get(outreach.id)
  res.json(updated)
})

// Send email
router.post('/send/:outreachId', async (req, res) => {
  const db = getDb()
  const outreach = db.prepare('SELECT * FROM outreach WHERE id = ?').get(req.params.outreachId)
  if (!outreach) return res.status(404).json({ error: 'Outreach not found' })
  if (!outreach.email_subject || !outreach.email_body) {
    return res.status(400).json({ error: 'Draft email first before sending' })
  }

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(outreach.vendor_id)
  if (!vendor.email) return res.status(400).json({ error: 'Vendor has no email address' })

  try {
    await sendEmail({
      to: vendor.email,
      subject: outreach.email_subject,
      body: outreach.email_body
    })
  } catch (err) {
    return res.status(500).json({ error: 'Email send failed: ' + err.message })
  }

  const now = new Date()
  const followUpDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  db.prepare(`
    UPDATE outreach SET status='sent', sent_at=?, next_follow_up_at=? WHERE id=?
  `).run(now.toISOString(), followUpDate.toISOString(), outreach.id)

  const updated = db.prepare('SELECT * FROM outreach WHERE id = ?').get(outreach.id)
  res.json(updated)
})

// Update status manually
router.put('/:id/status', (req, res) => {
  const { status } = req.body
  const allowed = ['draft', 'sent', 'replied', 'shortlisted', 'rejected']
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' })

  const db = getDb()
  db.prepare('UPDATE outreach SET status = ? WHERE id = ?').run(status, req.params.id)
  const updated = db.prepare('SELECT * FROM outreach WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// Log a vendor reply
router.put('/:id/reply', (req, res) => {
  const { reply_content } = req.body
  const db = getDb()
  db.prepare(`
    UPDATE outreach SET reply_content = ?, replied_at = ?, status = 'replied' WHERE id = ?
  `).run(reply_content, new Date().toISOString(), req.params.id)
  const updated = db.prepare('SELECT * FROM outreach WHERE id = ?').get(req.params.id)
  res.json(updated)
})

export default router
