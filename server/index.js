import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getDb } from './db/database.js'
import projectsRouter from './routes/projects.js'
import vendorsRouter from './routes/vendors.js'
import outreachRouter from './routes/outreach.js'
import statsRouter from './routes/stats.js'
import statusBoardRouter from './routes/statusBoard.js'
import { startCronJobs } from './services/cron.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Initialize DB on startup
getDb()

// Routes
app.use('/api/projects', projectsRouter)
app.use('/api/vendors', vendorsRouter)
app.use('/api/outreach', outreachRouter)
app.use('/api/stats', statsRouter)
app.use('/api/status-board', statusBoardRouter)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  startCronJobs()
})
