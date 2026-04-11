import { Router } from 'express'
import { getDb } from '../db/database.js'
import { parseRequirements } from '../services/ai.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const projects = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT o.id) as vendor_count,
      SUM(CASE WHEN o.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
      SUM(CASE WHEN o.status = 'replied' THEN 1 ELSE 0 END) as replied_count,
      SUM(CASE WHEN o.status = 'shortlisted' THEN 1 ELSE 0 END) as shortlisted_count
    FROM projects p
    LEFT JOIN outreach o ON o.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all()
  res.json(projects)
})

router.post('/', async (req, res) => {
  const { name, description, category, budget_range, timeline, requirements } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO projects (name, description, category, budget_range, timeline, requirements)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description, category, budget_range, timeline, requirements)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid)

  // Parse requirements async — don't block the response
  if (requirements) {
    parseRequirements(description || '', requirements)
      .then(criteria => {
        db.prepare('UPDATE projects SET parsed_criteria = ? WHERE id = ?')
          .run(JSON.stringify(criteria), project.id)
      })
      .catch(err => console.error('[AI] parseRequirements failed:', err.message))
  }

  res.status(201).json(project)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const outreach = db.prepare(`
    SELECT o.*, v.name as vendor_name, v.email as vendor_email,
           v.category as vendor_category, v.description as vendor_description,
           v.past_work as vendor_past_work, v.website as vendor_website,
           v.phone as vendor_phone, v.notes as vendor_notes
    FROM outreach o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.project_id = ?
    ORDER BY o.fit_score DESC
  `).all(req.params.id)

  res.json({ ...project, outreach })
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const { name, description, category, budget_range, timeline, requirements, status } = req.body
  db.prepare(`
    UPDATE projects SET name=?, description=?, category=?, budget_range=?, timeline=?, requirements=?, status=?
    WHERE id=?
  `).run(name, description, category, budget_range, timeline, requirements, status, req.params.id)
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json(project)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM outreach WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
