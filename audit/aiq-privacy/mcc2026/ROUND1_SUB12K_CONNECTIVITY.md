# Round-1 sweep: sub-12k band, connectivity and stale-list findings

Band: 2026 Round-1 AIQ / MBBS / General / Open close between 7,000 and 12,000.
Later relaxations applied on request: a roster is tolerable if it is *deeply hidden*
**or** if nothing has been published since 2020; connectivity requires a **direct
flight from Lucknow** and **under 50 km** from the airport.

> No student names in this file. Evidence is URLs, column headers and row counts only.

## Lucknow's direct network decides the connectivity question

Direct from LKO (confirmed Aug 2026): Kolkata, Hyderabad, Indore, Bengaluru, Goa,
Guwahati, Jaipur, Dehradun, Chandigarh, Chennai, Delhi. **Not** Nagpur, Raipur, Patna,
Jabalpur, Bilaspur. A same-day trip needs a direct flight, so only colleges in the
first list can be verified without an overnight.

Note: under MCC 2026, **Float** candidates are verified **online** with no visit at
all; only **Freeze** requires the single physical trip. The day-trip constraint binds
only if the seat is frozen in Round 1.

## Clean results (documents opened, no roster found)

| 2026 R1 | College | Docs opened | Notes |
|---|---|---|---|
| **9,742** | **CIMS Bilaspur** | **755** | Fee **Rs 40,000 confirmed** from its own document. Publishes an academic calendar. No direct LKO flight. |
| 6,548 | Gajra Raja MC, Gwalior | 0 (130 URLs) | Est 1946, reputed, airport ~12 km. Below the 7,000 floor; no direct LKO flight. |
| 5,035 | RIMS Ranchi | 3 | Airport ~7 km from campus. Out of reach at this rank. |
| 4,918 | Pt DDU MC, Rajkot | 42 | Out of reach at this rank. |
| 4,818 | NRS MC, Kolkata | 576 | 2 flags were a nursing list and an anti-ragging gazette. Out of reach. |

CIMS Bilaspur is the strongest combined result of the audit: more documents opened
than any other cleared college (Ambajogai 388, Chandrapur 186) and the only in-band
college with a document-confirmed fee inside the Rs 40,000 ceiling.

## FAILs found in this sweep

| 2026 R1 | College | Evidence | Newest list |
|---|---|---|---|
| 10,132 | Burdwan Medical College | `/admitted-candidates.php` - a **live HTML table**, ~150 rows, columns `S.No. / Roll No / NEET AIR / Candidate Name / Subject / Allotted Category / Candidate Category / Reporting Date`. Plus `Admitted_Students_of_2015.pdf`, `UG_MBBS_2014List_for_MCI.pdf`, `MCI_Data_2016-17.pdf` (117 rows), `2015-16.pdf` | 2016-17 |
| 8,078 | R.G. Kar MC, Kolkata | `/pdf/student-list-jan2012.pdf` (53 rows), `student-list-jan2010.pdf`, `student-list-categorywise-2011.pdf` | **Jan 2012** |
| 7,515 | NSCB MC, Jabalpur | `final17.pdf` reached only by POST to `api.nscbmc.ac.in/api/news` | **2017-11-30** |
| 5,736 | Calcutta National MC | 6+ rosters at 148 / 125 / 107 / 99 rows, hash-named under `/download/` | unknown |
| 9,265 | SVMC Tirupati | 1,776 docs, 7 roster hits incl. a **2025-26** PG prospectus | current |

Burdwan's is the most identifying exposure in the entire audit - name paired with
**both** NEET All India Rank and NEET roll number, plus reservation category, on an
unauthenticated page. Worse than Kakatiya Warangal, which paired name with rank only.

Four of four West Bengal colleges checked now FAIL: Sagar Dutta, Kalyani, Burdwan,
Calcutta National. West Bengal's no-UG-bond advantage comes with a state-wide habit
of publishing admitted-candidate lists.

## Colleges that pass the relaxed "stale or hidden" test

- **NSCB Jabalpur** - maximally hidden and stale. No student, document, downloads,
  academic or calendar endpoint exists (all 404). `/api/notice` and `/api/results`
  return count 0. The news store's newest item is **2020-01-21**. The single roster is
  a 2017 file with a meaningless name, attached to a news item, behind a POST-only
  endpoint. Dumna airport ~20 km, ~64 flights/week - but **no direct LKO flight**, so
  not a day trip.
- **R.G. Kar Kolkata** - stale by a wide margin (nothing after Jan 2012) and the only
  in-band college that is genuinely day-trip capable: Kolkata is a direct LKO route and
  the campus is ~16 km / ~40 min from the airport.

  Two caveats recorded against it: a postgraduate trainee doctor was raped and murdered
  on duty there in August 2024, which is a material safety consideration; and the
  current official site `rgkarmch.in` is **geo-blocked from this environment**, so
  "nothing after 2012" is true only of the reachable legacy site.

## Method corrections made during this sweep

1. **SPA false clean.** NSCB Jabalpur was reported clean twice on a 130-URL crawl. It
   is an Angular single-page app: every path returns the same 17 KB shell, so the crawl
   re-read one page 130 times and "0 documents" carried no information. The fix is to
   pull the JS bundle, extract the API base (`api.nscbmc.ac.in`) and enumerate its
   routes. That is what found the roster. Any site returning an identical byte count on
   every path must be treated as unverified, not clean. KIMS Hubballi (18 URLs, 0 docs)
   is unresolved for this reason.
2. **Split-scheme domains.** `rgkarmedicalcollege.org` serves a Russian VPS parking page
   over HTTPS and the genuine college site over HTTP. Probing only HTTPS would have
   recorded the college as a squatter and dropped it.
