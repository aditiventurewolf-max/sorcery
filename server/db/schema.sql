CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  budget_range TEXT,
  timeline TEXT,
  requirements TEXT,
  parsed_criteria TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  category TEXT,
  description TEXT,
  past_work TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  vendor_id INTEGER REFERENCES vendors(id),
  fit_score INTEGER,
  fit_rationale TEXT,
  email_subject TEXT,
  email_body TEXT,
  status TEXT DEFAULT 'draft',
  sent_at DATETIME,
  replied_at DATETIME,
  reply_content TEXT,
  follow_up_count INTEGER DEFAULT 0,
  next_follow_up_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
