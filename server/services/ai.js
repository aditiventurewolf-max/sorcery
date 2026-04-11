import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-5'

export async function parseRequirements(projectDescription, rawRequirements) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a vendor sourcing analyst. Extract structured evaluation criteria from the following project brief.

Project Description: ${projectDescription}

Raw Requirements:
${rawRequirements}

Return a JSON array of criteria objects. Each object must have:
- "criterion": a clear, specific evaluation criterion (string)
- "weight": importance level — "high", "medium", or "low"

Return ONLY valid JSON array, no markdown, no explanation. Example:
[{"criterion":"Must support live cohort sessions","weight":"high"},{"criterion":"Has SCORM compliance","weight":"medium"}]`
      }
    ]
  })

  const text = message.content[0].text.trim()
  return JSON.parse(text)
}

export async function scoreVendors(parsedCriteria, vendors) {
  const criteriaText = parsedCriteria
    .map(c => `- [${c.weight.toUpperCase()}] ${c.criterion}`)
    .join('\n')

  const vendorProfiles = vendors.map(v =>
    `Vendor ID ${v.id}: ${v.name}
     Category: ${v.category}
     Description: ${v.description}
     Past Work: ${v.past_work || 'Not provided'}
     Notes: ${v.notes || 'None'}`
  ).join('\n\n')

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a vendor sourcing analyst at an edtech company (Scaler). Score each vendor against the provided criteria.

EVALUATION CRITERIA:
${criteriaText}

VENDOR PROFILES:
${vendorProfiles}

Score each vendor from 0–100 based on how well they match the criteria. Heavily weight "high" criteria. Write a single concise sentence rationale per vendor.

Return ONLY a valid JSON array, no markdown, no explanation:
[{"vendorId":1,"score":82,"rationale":"Strong LMS with live session support and SCORM compliance matching all high-priority criteria."},...]`
      }
    ]
  })

  const text = message.content[0].text.trim()
  return JSON.parse(text)
}

export async function draftEmail(project, vendor, outreach) {
  const criteriaText = project.parsed_criteria
    ? JSON.parse(project.parsed_criteria).map(c => c.criterion).join(', ')
    : project.requirements

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Write a professional outreach email from the Scaler team to ${vendor.name}.

Project: ${project.name}
What we're looking for: ${criteriaText}
Budget: ${project.budget_range || 'Flexible'}
Timeline: ${project.timeline || 'To be discussed'}

Vendor profile:
- Category: ${vendor.category}
- Description: ${vendor.description}
- Past work: ${vendor.past_work || 'N/A'}
- Fit score: ${outreach.fit_score}/100
- Why they're a good fit: ${outreach.fit_rationale}

Write the email following these rules:
1. Under 150 words total
2. Open with something specific about ${vendor.name} that shows we did our homework — mention 1–2 concrete things from their profile
3. Briefly describe what Scaler is looking for on this project
4. End with a clear CTA: schedule a 20-minute discovery call
5. Tone: professional but warm, human — NOT generic or AI-sounding
6. Sign off as "The Sourcing Team, Scaler"

Return ONLY a JSON object with "subject" and "body" fields. No markdown, no explanation.
{"subject":"...","body":"..."}`
      }
    ]
  })

  const text = message.content[0].text.trim()
  return JSON.parse(text)
}

export async function draftFollowUp(originalEmail, vendor, followUpCount) {
  const tones = [
    'friendly nudge — keep it light and brief, assume they missed the original',
    'adds a touch of urgency — mention the timeline is moving and we\'d love to include them before we finalize',
    'final note — gracious and closing, let them know this is the last outreach'
  ]
  const tone = tones[Math.min(followUpCount - 1, 2)]

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write follow-up email #${followUpCount} to ${vendor.name}.

Original email subject: ${originalEmail.subject}
Original email (reference only): ${originalEmail.body}

Tone for this follow-up: ${tone}

Rules:
- Under 80 words
- Reference the original email naturally
- Do not repeat the same phrases from the original
- Sign off as "The Sourcing Team, Scaler"

Return ONLY a JSON object: {"subject":"...","body":"..."}`
      }
    ]
  })

  const text = message.content[0].text.trim()
  return JSON.parse(text)
}
