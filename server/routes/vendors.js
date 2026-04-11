import { Router } from 'express'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { category, search } = req.query
  let query = 'SELECT * FROM vendors WHERE 1=1'
  const params = []

  if (category) {
    query += ' AND category = ?'
    params.push(category)
  }
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR email LIKE ?)'
    const like = `%${search}%`
    params.push(like, like, like)
  }

  query += ' ORDER BY created_at DESC'
  const vendors = db.prepare(query).all(...params)
  res.json(vendors)
})

router.post('/', (req, res) => {
  const { name, email, phone, website, category, description, past_work, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO vendors (name, email, phone, website, category, description, past_work, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone, website, category, description, past_work, notes)

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(vendor)
})

router.put('/:id', (req, res) => {
  const { name, email, phone, website, category, description, past_work, notes } = req.body
  const db = getDb()
  db.prepare(`
    UPDATE vendors SET name=?, email=?, phone=?, website=?, category=?, description=?, past_work=?, notes=?
    WHERE id=?
  `).run(name, email, phone, website, category, description, past_work, notes, req.params.id)
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id)
  res.json(vendor)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM outreach WHERE vendor_id = ?').run(req.params.id)
  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
