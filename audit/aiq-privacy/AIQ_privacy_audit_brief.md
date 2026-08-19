# NEET AIQ MBBS College — Website Privacy Audit
## Claude Code Handoff Brief (self-contained)

> **Purpose of this file.** Everything Claude Code needs to run the full audit end-to-end
> without further context. Companion data file: `aiq_r1_2025_general_8k_13k.csv`
> (135 colleges). Read that CSV first; it is the work list.

---

## 0. TL;DR of the job

For **each of the 135 colleges** in the CSV, determine whether that college's
**AIQ (MCC central-counselling) admitted-MBBS-students list is publicly accessible online
as a name-bearing document** (on the college's own site OR re-hosted on Scribd / similar).
Classify each as **FAIL / PASS / PROVISIONAL** and record the evidence.

The end user is choosing an MBBS seat through **MCC All-India-Quota Round-1 counselling**,
General category, closing-rank band **AIR 8,000–13,000** (2025 basis). Their priority: **their
own name must not end up in a publicly downloadable admitted-students list.** Everything below
serves that one goal.

---

## 1. Decision criteria (exact — do not loosen)

**FAIL** the college if ANY of these is publicly reachable (no login):
- A college-hosted **"Admitted Students"** list, or **"Information under MSR Clause B.1.11"** /
  **"Mandatory Disclosure"** page, that names first-year MBBS entrants for any recent session.
  (This NMC-mandated disclosure lists *all* entrants — which includes AIQ — so it is the
  primary FAIL vector.)
- The same kind of name list **re-hosted on a third party**: Scribd, DocsLib, Studocu,
  Slideshare, Coursehero, Google-Drive links, etc.
- Any other public PDF/table naming AIQ-admitted (or all-admitted) MBBS students.

**PASS** the college if:
- Only **state-quota** admission/merit/allotment lists are public (published by the state
  counselling authority, not the college) — this is explicitly acceptable, because an AIQ
  entrant does not appear on a state-quota list.
- No college-hosted or re-hosted all-inclusive/AIQ name list exists anywhere reachable.

**NOT disqualifying (ignore):**
- Roll numbers / NEET AIR / rank-only lists **without names** (the MCC allotment list itself
  is rank-based, no names).
- **Old formatting, stale sites, multi-year gaps** — totally fine, not a factor.
- Photo galleries, NSS/sports/cultural member lists, event coverage — **ignore these entirely.**

**PROVISIONAL** when you cannot conclusively confirm absence (e.g., site is a JS SPA you can't
render, or is robots-blocked, or no official site is discoverable). Never upgrade PROVISIONAL to
PASS without a positive confirmation that the disclosure is absent/empty/state-quota-only.

---

## 2. The dataset (`aiq_r1_2025_general_8k_13k.csv`)

- **135 rows.** Columns: `R1_closing_AIR, R1_opening_AIR, seats_in_band, state, college`.
- **Provenance:** parsed from the official **MCC AIQ NEET-UG Round-1 2025 seat-allotment PDF**,
  pages **180–350** (the slice covering AIR ≈ 7,900–13,500). Filtered to: **MBBS course**,
  **seat category = General**, **quota = All India (15% AIQ)**, **closing AIR 8,000–13,000**.
  **Uttar Pradesh colleges excluded** per user instruction.
- `R1_closing_AIR` = highest (numerically) General AIR admitted in R1 = the college's R1
  General closing. A college is an R1 option for a candidate at rank R only if `R1_closing_AIR ≥ R`.
- **Data caveats:** the `state` column has a few name-driven mislabels (e.g., "Atal Bihari Vajpayee
  GMC, Vidisha" tagged Bihar because "Bihari" is in the name — it is actually MP); a few `college`
  cells carry a repeated-name fragment as the city. College identity + closing rank are sound;
  re-derive state from the city where in doubt.

---

## 3. Governing heuristic (a *prior*, still verify every college)

Whether a college self-hosts an AIQ name list tracks its **state admission system**, not its age
or how modern its site looks:

- **Strong centralised-state-counselling states → PASS-rich.** Admissions run through a powerful
  state health university that publishes **state-quota** lists only; colleges keep minimal
  independent web presence and typically do **not** self-host an AIQ list:
  - Tamil Nadu — TN Dr M.G.R. Medical University / TN Selection Committee
  - Telangana & Andhra Pradesh — KNRUHS / NTR UHS
  - Karnataka — KEA (Karnataka Examinations Authority)
- **Self-hosted-site colleges → FAIL-prone.** UT-run colleges and revamped older colleges that
  run their own Drupal/PHP/WordPress site tend to carry the full B.1.11 disclosure **including
  AIQ names** (confirmed: NAMO Silvassa (DNH), NMCH Patna (Bihar)).

**Convenient convergence with user preference:** the PASS-rich South cluster (TN/KA/AP/TS/Puducherry,
≈ 44 of the 135) is also the **farthest from Lucknow** — which is the user's stated geographic
preference (far from Lucknow, and no UP). **Audit order: farthest-first — South cluster first,
then far-East/NE/West, near-north last.**

Treat all of this as a starting hypothesis to speed triage — **confirm each college individually.**

---

## 4. Per-college procedure

For each row in the CSV:

1. **Resolve the official website.**
   - Search: `"<college> <city>" official website`. Try likely domains. Check the state medical-
     education portal and NMC listing.
   - Record `official_url`, or `"no independent site found"` (itself weak evidence toward PASS —
     no self-hosted disclosure — but still do step 4).
2. **Inspect the official site for a disclosure/admitted-students page.** Look for links named:
   `Admitted Students`, `Mandatory Disclosure`, `MSR`, `B.1.11` / `B-1-11` / `B I XI`,
   `Student Information`, `Student Corner`, `Admission`. Fetch those pages.
   - Name-bearing MBBS list (any recent session, incl. AIQ/all) present → **FAIL**; record
     `disclosure_url` + which sessions/batches.
   - Page exists but is **empty / roll-number-only / state-quota-only** → record precisely; lean PASS.
3. **Third-party re-hosting check.** Run:
   - `site:scribd.com "<college>" (admitted OR "list of students" OR MBBS)`
   - repeat for `docslib.org`, `studocu.com`, `slideshare.net`, `coursehero.com`
   - generic: `"<college>" admitted students MBBS list pdf`
   - Any name list found → **FAIL**; record the URL.
4. **Classify** FAIL / PASS / PROVISIONAL and **record evidence** (URLs checked, what was found,
   date). **Do not copy student names into the output — record counts/sessions/URLs only.**

---

## 5. Ready-to-use search templates

```
"<college> <city>" official website
"<college>" "admitted students" MBBS
"<college>" "mandatory disclosure" OR "B.1.11" OR MSR
site:scribd.com "<college>" admitted students
site:docslib.org "<college>" MBBS students
"<college>" list of admitted MBBS students filetype:pdf
```

---

## 6. Pointers already discovered (reuse; don't re-derive)

**Confirmed FAILs (exemplars of what a FAIL looks like — don't re-audit):**
- **NAMO Silvassa (DNH)** — `namomeridnhdd.in` (Drupal 8). FAIL page:
  `/admitted-student-in-ug-details` → batch PDFs for 2019, 2021, 2021-22, 2022-23, 2023-24.
- **NMCH Patna (Bihar)** — `nmchpatna.ac.in` (PHP). FAIL page: `/admitted-student.php`
  → MBBS lists every session **2006-07 → 2024-25**, plus PG + paramedical.

**Site-access gotchas found:**
- **Rajasthan district GMCs** (Dausa, Alwar, Pali, Churu, Jhalawar, Barmer, Nagaur, etc.) live on
  `medicaleducation.rajasthan.gov.in/mc<city>` — an **Angular SPA** that **redirect-loops on a
  plain fetch**; notices load via JS/API behind hash-routes. Needs a **headless browser** (e.g.
  Playwright) or the underlying JSON/API endpoint. Mark PROVISIONAL if neither is available.
- **ESIC colleges** — `mc<city>.esic.gov.in` — **robots-disallowed** to automated fetch; content
  is recruitment/admin. (ESIC Indore = 2025 first batch, no history yet.) Respect robots; mark
  PROVISIONAL or verify via search only.
- **GRMC Gwalior (MP)** — `grmcgwalior.org` (WordPress) — actively updated; has Notice Board +
  Student Corner. Not yet checked for a B.1.11/admitted page — do so.

**State-quota authority portals (these publish state-quota lists = ACCEPTABLE; use only to
confirm a list is state-quota, not AIQ):**
- TN: `tnhealth.tn.gov.in` / TN Selection Committee
- Telangana/AP: `knruhs.telangana.gov.in`, `ntruhs.ap.gov.in`
- Karnataka: `cetonline.karnataka.gov.in` (KEA)

---

## 7. Seed results (already done — carry forward, do not repeat)

| College | State | R1 close | Verdict | Evidence |
|---|---|---|---|---|
| NAMO Silvassa | DNH (UT) | 8,069 | **FAIL** | self-hosted admitted PDFs, all batches |
| NMCH Patna | Bihar | ~10.7k | **FAIL** | self-hosted admitted lists 2006–2025 |
| GMC Suryapet | Telangana | 8,209 | **PASS (provisional)** | aggregators only; no self-host / Scribd hit |
| GMC Karur | Tamil Nadu | 9,450 | **PASS (provisional)** | aggregators only; no self-host / Scribd hit |
| Kakatiya, Warangal | Telangana | 8,974 | **PASS (provisional)** | old+prestigious yet no self-host; state (KNRUHS) handles admissions |

Note: NAMO also sits at the very top of the band (R1 General close 8,069) and NMCH ~10.7k — both
already excluded on privacy grounds regardless.

---

## 8. Output the run should produce

Write/extend a scorecard file (CSV or Markdown) with one row per college:

```
college, state, R1_closing_AIR, official_url, disclosure_found(Y/N),
disclosure_url, scribd_found(Y/N), scribd_url, verdict(FAIL/PASS/PROVISIONAL),
sessions_exposed, checked_date, notes
```

Then summarise: counts by verdict, and the **clean PASS list** sorted by R1_closing_AIR (so the
user can cross-reference reachability against their own rank), region-tagged, farthest-from-Lucknow
first.

---

## 9. Hard rules / gotchas

- **Absence of a search hit ≠ confirmed absence.** Only stamp PASS after positively confirming the
  disclosure is absent/empty/state-quota-only on the official site, or after a thorough multi-engine
  + Scribd/docslib sweep returns nothing.
- **Never reproduce student names** anywhere in output. Record sessions/counts/URLs only.
- **Respect robots.txt** and rate-limit. For SPA/robots-blocked sites, mark PROVISIONAL with the reason.
- **Disambiguate generic names** ("Government Medical College, X") by city + state before searching.
- Re-verify the CSV `state` field from the city when it looks wrong (see §2 caveat).
