# MCC 2026 Round-1 provisional result: rank cross-reference

Source: `https://mcc.nic.in/ug-medical-counselling/` ->
"PROVISIONAL RESULT FOR UG COUNSELLING ROUND 1"
(`.../uploads/2026/08/202608202078593834.pdf`, 1,272 pages, generated 20-08-2026 16:16 IST).

Parsed 29,763 of 29,945 allotment records. The 182 unparsed rows are all PwD
variants, outside the General/non-PwD filter used here.

> The MCC result PDF carries **no candidate names and no roll numbers** — only
> rank, quota, institute, course and category. Nothing in this directory contains
> student names.

## Filter applied

Quota `All India` (the 15% AIQ pool) + course `MBBS` + candidate category
`General` + allotted category `Open`. Closing rank = the highest AIR allotted to
that institute under that filter; opening rank = the lowest.

- `all_2026_aiq.csv` — all 425 institutes with an AIQ/MBBS/General/Open allotment
- `band_2026.csv` — the 114 institutes whose closing rank falls in 8,000-13,000
- `pass_2026.json` — the 30-row PASS shortlist joined to its 2026 closing rank

## Headline: the band moved, the shortlist did not get worse

Every finalist from the privacy audit now closes **above** 13,000:

| College | 2025 R1 close | 2026 R1 close |
|---|---|---|
| GMC Bhandara | 12,648 | 18,616 |
| SRTR Ambajogai | 12,681 | 14,470 |
| GMC Akola | 12,815 | 13,994 |
| GMC Latur | 12,233 | 13,905 |
| GMC Seoni | 12,759 | 15,877 |

At AIR 8,000-13,000 these carry 1,000-5,600 ranks of headroom rather than being
borderline. GMC Baramati moved the other way (9,314 -> 7,384) and is now out of
reach from 8,000 down.

## PASS colleges closing inside 8,000-13,000 in 2026 R1

`IExp` = info-exposure score from the ranked shortlist (5 = nothing
student-related published, 1 = worst).

| 2026 close | College | State | IExp | Hindi | Fee/yr |
|---|---|---|---|---|---|
| 8,863 | S.S. Medical College, Rewa | MP | 1 | Yes | 80,000 |
| 9,793 | GMC Tiruppur | TN | 4 | No | 13,600 |
| 10,168 | SHKM GMC, Nalhar (Nuh) | Haryana | 4 | Yes | 53,000 |
| 10,187 | GMC Villupuram | TN | 5 | No | 13,600 |
| 10,303 | Shaheed Nirmal Mahto MC, Dhanbad | Jharkhand | 4 | Yes | 40,000 |
| 11,084 | GMC Karur | TN | 4 | No | 13,600 |
| 11,310 | GMC Dindigul | TN | 4 | No | 13,600 |
| 11,791 | GMC Shivpuri | MP | 5 | Yes | 80,000 |
| 12,449 | GMC Namakkal | TN | 5 | No | 13,600 |

Tiruppur, Villupuram, Karur, Dindigul and Namakkal all carry Tamil Nadu's
5-year service bond (Rs 5 L penalty, Rs 10 L to discontinue).

## Confirmed FAILs that appear inside the 2026 band — avoid

| 2026 close | College | Vector |
|---|---|---|
| 8,626 | College of Medicine & Sagore Dutta Hospital | class + full batch lists (slow server hid them) |
| 8,812 | NAMO Silvassa | 5 batch PDFs |
| 9,122 | Kakatiya MC, Warangal | CSVs pairing name with NEET rank, 5 sessions incl. 2025-26 |
| 9,265 | S V Medical College, Tirupati | B.1.11 page, 240 rows vs 240 seats |
| 9,640 | Hassan Institute of Medical Sciences | Scribd re-host |
| 9,749 | GMC Nashik | roster page behind non-matching link text |
| 10,313 | GMC Jhunjhunu | Scribd re-host, names + fathers' names |
| 10,855 | College of Medicine & JNM Hospital, Kalyani | hash-named roster PDF |
| 10,873 | GMC The Nilgiris | per-batch PDFs incl. 2025-26 |
| 12,751 | GMC Datia | B.1.11 page, batch2025 |

## Caveats

- These are **provisional** Round-1 ranks. They loosen in R2 and mop-up.
- The PASS scores come from the pre-correction shortlist. Of the audit's original
  38 PASSes, 13 proved wrong on re-checking. Shivpuri, Dhanbad, Nalhar and
  Villupuram had not been re-verified when this table was built.
- `*.telangana.gov.in` remains geo-blocked from this egress, so Suryapet and
  Adilabad stay PROVISIONAL. `mcnizamabad.in` and `gmcquthbullapur.com` answer
  but serve JS splash shells (815 and 114 bytes); the crawl found 2 and 7 pages
  and zero documents, which is too thin to call a PASS.
- `deepcheck.py` carries the lessons from the false PASSes: no keyword gating on
  link text, 90s timeouts, best-of-3 fetching against intermittent truncation,
  sitemap/`<loc>` enumeration for unlinked pages, and every document opened.
