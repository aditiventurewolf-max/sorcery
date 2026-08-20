# Final shortlist — verified against MCC 2026 Round-1 provisional result

Ranks are **AIQ / MBBS / General / Open-seat** closing ranks from the MCC Round-1
provisional allotment PDF published 20-08-2026 (1,272 pages, 29,763 records parsed).

Filters the user applied: no Tamil Nadu, no Nalhar, no Udhampur, no Rewa, no Uttar
Pradesh, Bhagalpur excluded as too near, Krishnagiri excluded as too new.

> No student names appear in this file or anywhere in this directory. Evidence is
> recorded as URLs, column headers and row counts only.

## PASS — verified clean

Each survived: a 110-300 URL crawl, sitemap enumeration, every discovered document
opened, 35 fixed disclosure paths probed, and a recursive open-directory walk with
absolute-path hrefs handled.

| 2026 R1 close | College | State | Fee/yr | Hindi | Why the clearance is trustworthy |
|---|---|---|---|---|---|
| **10,303** | Shaheed Nirmal Mahto MC, Dhanbad | Jharkhand | 40,000 | Yes | 88 URLs, 31 docs all opened, **no open directories** on a dedicated re-walk |
| 13,905 | GMC Latur | Maharashtra | 85,000 | Partial | 11-page brochure site, **zero documents**; 17 URLs is full coverage, not a shallow crawl |
| 13,994 | GMC Akola | Maharashtra | 85,000 | Partial | Docs served from `api.gmcakola.in`; **store empty across every `Type` 0-12 x both `IsWeb` values** |
| 14,470 | SRTR Ambajogai | Maharashtra | 85,000 | Partial | 388 docs opened; 3 flags were MUHS disclosure filings, the 2025-26 one an unfilled template |
| 15,048 | GMC Chandrapur | Maharashtra | 85,000 | Partial | 186 docs opened; 2 flags were a Marathi circular and a library journal list |
| 15,877 | GMC Seoni | MP | 80,000 | Yes | 107 docs opened; sole flag was faculty/resident AEBAS attendance (professor x51) |
| 16,082 | GMC Ratnagiri | Maharashtra | 85,000 | Partial | 75 docs opened; 3 flags were admission guideline brochures with blank form fields |
| 17,201 | GMC Baramulla | J&K | 40,000 | Partial | 93 KB static site, **zero `.pdf` references in the markup**, 124 URLs |
| 18,616 | GMC Bhandara | Maharashtra | 85,000 | Partial | 116-path battery earlier + 25 docs opened; 2 flags were admission instruction brochures |

**Only Dhanbad closes inside the 8,000-13,000 band.** The rest close 900-5,600 ranks
beyond it, which means they are reachable with headroom at that rank, not out of reach.

## FAIL — do not consider

| 2026 R1 close | College | Evidence |
|---|---|---|
| 11,791 | GMC Shivpuri | `files/BATCH 2023-24.pdf`, `BATCH 2024-25.pdf` — name + NEET percentile |
| 13,813 | Lt. L.A.M. GMC Raigarh | `storage/grievances.csv` — 4 records marked `Confidential: Yes` with name, email, phone, free-text details; plus `feedback.csv` |
| 15,154 | VNGMC Yavatmal | `studentsection/U2015,U2016,U2019,U2020.pdf` — "Name of the Student / M-F / Date of admission / Category"; plus 7 MBBS exam-result PDFs |
| 17,028 | GMC Ongole | `UG-STUDENTS-LIST-2022-BATCH.pdf` — name + roll number + mobile number; 13 hits incl. monthly PG stipend lists |
| 7,384 | GMC Baramati | `brcp/studet_list_mbbs/` — batches 2020-21, 2021-22, 2022-23 (also below the band) |
| n/a | Medinirai MC, Palamu | `Student-List-25-26.pdf` (**current intake**), `MBBS-BATCH-2023.pdf` (89 rows), `Student-List-2019.pdf` (86 rows) |

## Bond and PG context for the survivors

| State | Colleges on the list | UG service bond | PG state quota for an AIQ entrant |
|---|---|---|---|
| Maharashtra | Latur, Akola, Ambajogai, Chandrapur, Ratnagiri, Bhandara | ~1 yr, bond applies | MBBS-in-state generally qualifies |
| Jharkhand | Dhanbad | bond applies | generally qualifies |
| Madhya Pradesh | Seoni | ~1 yr | generally qualifies |
| Jammu & Kashmir | Baramulla | bond applies | domicile-linked and restrictive |

Verify against the current-year counselling brochure — these are revised annually.

## Accuracy record

Six colleges that the original detector passed were found to FAIL once it was
corrected: Shivpuri, Baramati, Yavatmal, Ongole, Raigarh, Palamu. Two detector and
coverage defects caused this, both mine:

1. **Names inline with trailing numerics.** The row regex was end-anchored, so a row
   like `12  <name>  98.04` scored as a non-match. Shivpuri's batch lists scored 6
   rows against a threshold of 8 and would have passed silently.
2. **Absolute-path hrefs in directory listings.** The open-directory walker skipped
   any href beginning with `/`, so it never descended into `/uploads/student/`. This
   is what initially hid Raigarh's `grievances.csv`.

Earlier rounds had already produced five other false-PASS mechanisms: keyword-gated
link selection, short timeouts on slow servers, intermittently truncated responses,
opaque hash filenames with meaningless link text, and directories unreachable from
the link graph. Every one biased toward PASS.

Given that Ongole survived every earlier check and fell only to the corrected
detector, an independent spot-check of Dhanbad — the one in-band option — is worth
doing before committing to it.
