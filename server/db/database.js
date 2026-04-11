import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../sourcery.db')

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    seedVendors()
  }
  return db
}

function initSchema() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)
}

const SEED_VENDORS = [
  {
    name: 'BrightPath LMS',
    email: 'partnerships@brightpathlms.com',
    phone: '+91-98201-11001',
    website: 'https://brightpathlms.com',
    category: 'LMS',
    description: 'Cloud-based LMS platform built for professional education and upskilling, with strong mobile support and SCORM compliance.',
    past_work: 'Deployed for 50+ edtech companies across India; powers 2M+ monthly learners; integrations with Zoom and Google Workspace.',
    notes: 'Strong in live cohort management. Preferred vendor for bootcamp-style programs.'
  },
  {
    name: 'Teachable India',
    email: 'enterprise@teachable.in',
    phone: '+91-98201-22002',
    website: 'https://teachable.in',
    category: 'LMS',
    description: 'Affordable LMS with built-in course creation tools, payment processing, and student analytics. Widely used by independent creators.',
    past_work: 'Used by 10,000+ educators in India; white-labeling available for enterprise; supports certificate issuance.',
    notes: 'Good for self-paced content. Limited support for live sessions.'
  },
  {
    name: 'PixelFrame Studios',
    email: 'hello@pixelframestudios.in',
    phone: '+91-98201-33003',
    website: 'https://pixelframestudios.in',
    category: 'Video Production',
    description: 'Full-service video production studio specializing in educational and corporate training content, animation, and explainer videos.',
    past_work: 'Produced 500+ hours of edtech content for Byju\'s, Unacademy, and UpGrad; studio in Bangalore with remote crews.',
    notes: 'Fast turnaround. Premium quality. Slightly above average pricing.'
  },
  {
    name: 'Reelcraft Media',
    email: 'projects@reelcraft.co',
    phone: '+91-98201-44004',
    website: 'https://reelcraft.co',
    category: 'Video Production',
    description: 'Boutique video agency focused on tech and education sector. Offers end-to-end production: scripting, shoot, motion graphics, voiceover.',
    past_work: 'Created course videos for Coursera India, upGrad, and several funded edtech startups. 3D animation capabilities.',
    notes: 'Great for complex technical content. Min engagement: 20 videos.'
  },
  {
    name: 'Quizify Pro',
    email: 'sales@quizifypro.com',
    phone: '+91-98201-55005',
    website: 'https://quizifypro.com',
    category: 'Assessment Tools',
    description: 'AI-powered assessment platform with adaptive testing, proctoring, coding challenges, and detailed analytics dashboards.',
    past_work: 'Used by IITs, BITS, and 30+ edtech companies; supports MCQ, subjective, and code evaluation; GDPR compliant.',
    notes: 'Best-in-class proctoring. API available for LMS integration.'
  },
  {
    name: 'TestMint',
    email: 'enterprise@testmint.io',
    phone: '+91-98201-66006',
    website: 'https://testmint.io',
    category: 'Assessment Tools',
    description: 'Online examination platform with remote proctoring, instant results, and certificate generation. Focused on high-stakes assessments.',
    past_work: 'Powers assessments for 200+ colleges and ed companies; handles 10K+ concurrent users; custom question banks.',
    notes: 'More exam-oriented than learning-oriented. Strong on reliability.'
  },
  {
    name: 'WordCraft Co.',
    email: 'content@wordcraftco.in',
    phone: '+91-98201-77007',
    website: 'https://wordcraftco.in',
    category: 'Content Writing',
    description: 'Specialized content agency for edtech — curriculum writing, study material, blog content, and SEO-optimized articles.',
    past_work: 'Written 10,000+ pages of curriculum for coding bootcamps and STEM programs; SME network across 40 subjects.',
    notes: 'Strong in tech and data science content. Turnaround: 5 days per module.'
  },
  {
    name: 'Inkwell Learning',
    email: 'hello@inkwelllearning.com',
    phone: '+91-98201-88008',
    website: 'https://inkwelllearning.com',
    category: 'Content Writing',
    description: 'Instructional design and content writing agency. Focuses on learner-centered design, storyboarding, and interactive content scripts.',
    past_work: 'Designed learning journeys for Infosys, TCS, and multiple edtech unicorns; experienced with Bloom\'s taxonomy-based design.',
    notes: 'Premium instructional design. Expensive but thorough.'
  },
  {
    name: 'Stackd Design',
    email: 'studio@stackddesign.com',
    phone: '+91-98201-99009',
    website: 'https://stackddesign.com',
    category: 'Design Agency',
    description: 'Product and brand design studio focused on ed-tech and consumer apps. Offers UI/UX design, branding, and design systems.',
    past_work: 'Redesigned apps for 3 edtech unicorns; built design systems used by 50+ engineers; Figma-first workflow.',
    notes: 'Strong UX research capabilities. Works in 2-week sprints.'
  },
  {
    name: 'Brushstroke Creative',
    email: 'work@brushstrokecreative.in',
    phone: '+91-98201-10010',
    website: 'https://brushstrokecreative.in',
    category: 'Design Agency',
    description: 'Creative agency specializing in visual identity, marketing collateral, and motion design for education and tech brands.',
    past_work: 'Rebranded 20+ edtech companies; designed pitch decks for funded startups; social media design retainers.',
    notes: 'Great for brand and marketing work. Not a product/UX studio.'
  }
]

function seedVendors() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM vendors').get()
  if (count.cnt > 0) return

  const insert = db.prepare(`
    INSERT INTO vendors (name, email, phone, website, category, description, past_work, notes)
    VALUES (@name, @email, @phone, @website, @category, @description, @past_work, @notes)
  `)

  const insertMany = db.transaction((vendors) => {
    for (const v of vendors) insert.run(v)
  })

  insertMany(SEED_VENDORS)
  console.log('[DB] Seeded 10 sample vendors')
}
