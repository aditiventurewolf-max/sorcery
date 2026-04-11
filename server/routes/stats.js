import { Router } from 'express'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()

  const activeProjects = db.prepare("SELECT COUNT(*) as cnt FROM projects WHERE status = 'active'").get()
  const totalVendors = db.prepare('SELECT COUNT(*) as cnt FROM vendors').get()

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sentThisWeek = db.prepare(
    "SELECT COUNT(*) as cnt FROM outreach WHERE status IN ('sent','replied','shortlisted') AND sent_at >= ?"
  ).get(oneWeekAgo)

  const pendingReplies = db.prepare("SELECT COUNT(*) as cnt FROM outreach WHERE status = 'sent'").get()

  res.json({
    activeProjects: activeProjects.cnt,
    totalVendors: totalVendors.cnt,
    sentThisWeek: sentThisWeek.cnt,
    pendingReplies: pendingReplies.cnt
  })
})

export default router
