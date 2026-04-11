import { Router } from 'express'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      v.id as vendor_id,
      v.name as vendor_name,
      v.category as vendor_category,
      p.id as project_id,
      p.name as project_name,
      o.id as outreach_id,
      o.fit_score,
      o.fit_rationale,
      o.status,
      o.email_subject,
      o.email_body,
      o.sent_at,
      o.replied_at
    FROM outreach o
    JOIN vendors v ON v.id = o.vendor_id
    JOIN projects p ON p.id = o.project_id
    ORDER BY v.name, p.name
  `).all()
  res.json(rows)
})

export default router
