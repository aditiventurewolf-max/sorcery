# NEET AIQ MBBS Privacy Audit — Run Report

**Question this answers:** for each of the 135 colleges in `aiq_r1_2025_general_8k_13k.csv`,
is that college's admitted-MBBS-students list publicly reachable as a **name-bearing**
document (college-hosted or re-hosted)? Verdicts: **FAIL / PASS / PROVISIONAL** per the
criteria in `AIQ_privacy_audit_brief.md` §1.

Run date: **2026-08-19**. Output: **`scorecard.csv`** (135 rows, brief §8 columns).

> No student names appear anywhere in this repo. Every tool records counts, column
> headers, session labels and URLs only — the detectors are built to refuse names.

---

## Headline findings

### 1. The brief's governing heuristic (§3) does not hold

§3 predicts the South cluster (TN / KA / AP / TS / Puducherry) is **PASS-rich**, because
strong state counselling authorities publish state-quota lists and colleges keep minimal
web presence. Two of the first South colleges actually checked are **FAILs**:

| College | State | R1 close | What is exposed |
|---|---|---|---|
| **SVMC Tirupati** | Andhra Pradesh | 8,815 | Own NMC "Information B.1.11 of MSRR" page links UG name lists — 240 rows against exactly 240 MBBS seats |
| **GMC Nilgiris** | Tamil Nadu | 9,034 | `/page/list-of-student` serves per-batch name PDFs, **including batch 2025-26** |

The real predictor is **whether the college runs its own CMS**, not which state it is in.
Every FAIL found is a college with an independent, self-managed site; the state's
counselling model did not protect any of them. Treat §3's South-first ordering as a
convenience for the user's geography preference only — **not** as evidence of privacy.

### 2. Highest-severity single find: GMC Nilgiris

Nilgiris publishes `batch-2025-26-list-of-students.pdf` (header `NAME`, serial numbers to
150) — the **current intake**. A candidate admitted there in 2025-26 is already named in a
public PDF. This is the exact outcome the user is trying to avoid, at a closing rank
(9,034) squarely inside their band.

### 3. Confirmed FAILs (avoid)

| R1 close | State | College | Vector |
|---|---|---|---|
| 8,069 | DNH & DD | NAMO Silvassa | self-host, 5 batch PDFs (brief exemplar, re-verified) |
| 8,815 | Andhra Pradesh | SVMC Tirupati | self-host via B.1.11 page |
| 8,943 | Rajasthan | GMC Jhunjhunu | **Scribd re-host**: MBBS batch 2024-25, 100 students, names + fathers' names |
| 9,034 | Tamil Nadu | GMC Nilgiris | self-host, incl. current 2025-26 batch |
| 12,056 | Jharkhand | Sheikh Bhikhari MC, Hazaribag | self-host, incl. MBBS 2025-26 (153 rows) |
| 12,938 | Madhya Pradesh | GMC Datia | self-host via B.1.11 page, incl. batch2025 (136 rows) |

`nmchpatna.ac.in` (NMCH Patna, 18 sessions 2006-07→2024-25) was also re-verified as a FAIL
but is **not** one of the 135 CSV rows — it was a brief exemplar only.

### 4. Data corrections applied (brief §2)

- `Atal Bihari Vajpayee GMC, Vidisha` — CSV says Bihar; Vidisha is **Madhya Pradesh**.
- Four blank `state` cells resolved: Bundelkhand MC Sagar → MP, GMC Khandwa → MP,
  GMC Datia → MP, **GMC Badaun → Uttar Pradesh**.
- **GMC Badaun is in UP**, which the brief says was excluded per user instruction. It is
  still in the dataset (row present, close 11,575). Flagging rather than silently dropping.
- `Government Medical College, Anantnag` and `Government Medical College, Anantnag J&K` are
  two CSV rows for the **same institution** (closes 12,749 and 12,163).

---

## Coverage and its limits — read this before trusting a PROVISIONAL

Verdict counts are in `scorecard.csv`; the large PROVISIONAL count is **an artefact of
network reachability from this environment, not evidence about the colleges.**

**Root cause.** This session's egress is a non-Indian datacenter. A large share of Indian
government hosts accept the TCP connection and then reset the TLS handshake. Confirmed
blocked wholesale: `*.karnataka.gov.in` (all 13 Karnataka colleges), `tnhealth.tn.gov.in`,
`*.ap.nic.in`, `nmc.org.in`, `mcjodhpur.rajasthan.gov.in`. Others answer normally
(`nmchpatna.ac.in`, `namomeridnhdd.in`, `gmcseoni.org`, …), so this is per-host, not a
blanket block. Diagnosed via the agent proxy: the tunnel establishes and the proxy logs
zero relay failures — the reset comes from the destination.

**Headless browser unavailable.** Brief §6 recommends Playwright for the Angular-SPA
Rajasthan district GMCs (`medicaleducation.rajasthan.gov.in/mc<city>`). Playwright and
Chromium are installed here, but Chromium's HTTPS `CONNECT` through the egress proxy is
reset (plain HTTP reaches the proxy and returns the documented 405/200). So **no JS page
could be rendered**: the Rajasthan SPA family, `gmcquthbullapur.com`, `mcnizamabad.in`, the
ASP.NET postback shells (GMC Ratlam, GMC Khandwa) and **Scribd document bodies** all stayed
unreadable. Those are PROVISIONAL with the reason recorded per-row.

**Scanned-image PDFs.** Several disclosure PDFs are image scans with no extractable text
(GMC Anantnag's NMC Proforma, GMC Miraj's UG admission PDF). A roster could be embedded in
the image, so these are PROVISIONAL pending OCR — not PASS.

**What was swept exhaustively and came back clean.** The third-party re-hosting vector was
swept across **all** states in the dataset (Scribd, DocsLib, Studocu, Slideshare,
Coursehero, pdfcoffee, vdocuments, idoc.pub, 1library, studylib). This vector does not
depend on the geo-block, so its coverage is genuinely complete. It returned exactly **one**
name-bearing roster attributable to a band college: **GMC Jhunjhunu**. Everything else was
college directories, choice lists, seat matrices or cutoff tables — or rosters belonging to
institutions outside the 135 (SDM Dharwad, IQ-City Burdwan, MGM, GMC Nirmal, GMC Bhilwara).

**PROVISIONAL is never an implied PASS.** Per brief §1/§9 nothing was upgraded without
positive confirmation.

---

## Method

Validated against both brief §6 exemplars **before** any verdict was trusted — NMCH Patna
reproduced all 18 sessions and NAMO Silvassa all 5 batch PDFs, so the detector demonstrably
catches a real FAIL.

1. `discover.py` / `guess.py` — token-free domain discovery by name/city pattern probing;
   `wikires.py` adds Wikipedia-infobox resolution with a title-match guard.
2. `scan.py` — `curl`-based fetch (reaches hosts that 503 other fetchers), link discovery
   against disclosure keywords (`admitted students`, `mandatory disclosure`, `MSR`,
   `B.1.11`, `student list`, …), and name-bearing-roster detection over HTML **and** PDF.
3. `scan_all.py` — runs 1→2 across the worklist and follows disclosure pages one hop into
   candidate documents.
4. Third-party sweep — batched domain-restricted searches per state.
5. `build_scorecard.py` — emits `scorecard.csv` plus the clean PASS list.

**Roster detection.** A document is a name list when a name column header
(`Name of Student`, `Student Name`, `NAME`, …) co-occurs with enough serial-numbered rows
carrying multiple capitalised tokens. Cross-checked against seat counts where known — SVMC
Tirupati's 240 rows against 240 sanctioned MBBS seats is what made that verdict safe
despite the PDF having no readable header.

**Deliberately not treated as FAILs** (brief §1 "not disqualifying"): staff/faculty
recruitment merit lists (Senior/Junior Resident, technicians) at GMC Bhandara, GMC
Udhampur, GMC Anantnag; a **paramedical** merit list at GMC Namakkal; a nursing (GNM)
shortlist at GMC Kathua; and a **scholarship** recipient list at GMC Nashik. The Nashik one
is flagged in its row — it is not an admitted-students roster, but the college does publish
some student names.

---

## Remaining work

~85 colleges have no resolved official domain, mostly because their sites live on the
geo-blocked state portals or they have no independent site. To finish those:

1. Per-college search to resolve the official domain, then re-run `scan_all.py`.
   Brief §9 permits PASS on a thorough multi-engine + re-host sweep returning nothing; such
   rows should record that the basis was search, not site inspection.
2. Re-run from an Indian egress (or any network the state portals accept) to clear the
   whole geo-blocked set — this is the single highest-yield next step.
3. OCR the scanned-image disclosure PDFs.
4. Render the SPA/ASP.NET sites and Scribd bodies with a working headless browser.
