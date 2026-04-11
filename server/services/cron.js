import cron from 'node-cron'
import { getDb } from '../db/database.js'
import { draftFollowUp } from './ai.js'
import { sendEmail } from './mailer.js'

export function startCronJobs() {
  // Run every day at 9am
  cron.schedule('0 9 * * *', async () => {
    const timestamp = new Date().toISOString()
    console.log(`[CRON ${timestamp}] Running follow-up job...`)

    const db = getDb()
    const now = new Date().toISOString()

    const due = db.prepare(`
      SELECT o.*, v.name as vendor_name, v.email as vendor_email
      FROM outreach o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE o.status = 'sent'
        AND o.next_follow_up_at <= ?
        AND o.follow_up_count < 3
    `).all(now)

    console.log(`[CRON ${timestamp}] Found ${due.length} outreach rows due for follow-up`)

    for (const row of due) {
      try {
        const newCount = row.follow_up_count + 1
        const email = await draftFollowUp(
          { subject: row.email_subject, body: row.email_body },
          { name: row.vendor_name, email: row.vendor_email },
          newCount
        )

        await sendEmail({
          to: row.vendor_email,
          subject: email.subject,
          body: email.body
        })

        const nextFollowUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

        if (newCount >= 3) {
          db.prepare("UPDATE outreach SET follow_up_count=?, status='rejected', next_follow_up_at=NULL WHERE id=?")
            .run(newCount, row.id)
          console.log(`[CRON ${timestamp}] Vendor ${row.vendor_name} (outreach ${row.id}) marked rejected after 3 follow-ups`)
        } else {
          db.prepare('UPDATE outreach SET follow_up_count=?, next_follow_up_at=? WHERE id=?')
            .run(newCount, nextFollowUp, row.id)
          console.log(`[CRON ${timestamp}] Sent follow-up #${newCount} to ${row.vendor_name}`)
        }
      } catch (err) {
        console.error(`[CRON ${timestamp}] Failed follow-up for outreach ${row.id}: ${err.message}`)
      }
    }

    console.log(`[CRON ${timestamp}] Follow-up job complete`)
  })

  console.log('[CRON] Follow-up scheduler started (runs daily at 9am)')
}
