#!/usr/bin/env python3
"""Build the scorecard CSV + summary markdown required by brief section 8.

Every one of the 135 CSV colleges gets a row. Colleges without a positive
determination stay PROVISIONAL (brief section 1/9: never upgrade to PASS without
positive confirmation).

PRIVACY: no student names anywhere in the output.
"""
import csv, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
wl = json.load(open(os.path.join(HERE, 'worklist.json')))
results = {}
p = os.path.join(HERE, 'results.jsonl')
if os.path.exists(p):
    for line in open(p):
        line = line.strip()
        if not line:
            continue
        r = json.loads(line)
        results[r['college']] = r

TIERNAME = {1: 'South (farthest from Lucknow)', 2: 'East/NE/West', 3: 'Near-north'}

COLS = ['college', 'state', 'R1_closing_AIR', 'official_url', 'disclosure_found',
        'disclosure_url', 'scribd_found', 'scribd_url', 'verdict', 'sessions_exposed',
        'checked_date', 'notes']

rows = []
for r in wl:
    got = results.get(r['college'])
    if got:
        rows.append({
            'college': r['college'], 'state': r['state'], 'R1_closing_AIR': r['close'],
            'official_url': got.get('official_url', ''),
            'disclosure_found': got.get('disclosure_found', ''),
            'disclosure_url': got.get('disclosure_url', ''),
            'scribd_found': got.get('scribd_found', ''),
            'scribd_url': got.get('scribd_url', ''),
            'verdict': got['verdict'],
            'sessions_exposed': got.get('sessions_exposed', ''),
            'checked_date': got.get('checked_date', ''),
            'notes': got.get('notes', ''),
            '_tier': r['tier'],
        })
    else:
        rows.append({
            'college': r['college'], 'state': r['state'], 'R1_closing_AIR': r['close'],
            'official_url': '', 'disclosure_found': 'N/A', 'disclosure_url': '',
            'scribd_found': 'N', 'scribd_url': '', 'verdict': 'PROVISIONAL',
            'sessions_exposed': '', 'checked_date': '2026-08-19',
            'notes': 'Undetermined: no official domain resolved from this egress. '
                     'Third-party re-host sweep for this state was clean. See README limits.',
            '_tier': r['tier'],
        })

out = os.path.join(HERE, 'scorecard.csv')
with open(out, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, extrasaction='ignore')
    w.writeheader()
    for r in rows:
        w.writerow(r)

counts = collections.Counter(r['verdict'] for r in rows)
print(f"scorecard.csv written: {len(rows)} rows")
for k in ('FAIL', 'PASS', 'PROVISIONAL'):
    print(f"  {k:12s} {counts.get(k,0)}")

fails = sorted([r for r in rows if r['verdict'] == 'FAIL'], key=lambda x: x['R1_closing_AIR'])
print("\nFAIL (avoid):")
for r in fails:
    print(f"  {r['R1_closing_AIR']:>6}  {r['state'][:14]:14s} {r['college'][:52]}")

passes = sorted([r for r in rows if r['verdict'] == 'PASS'], key=lambda x: x['R1_closing_AIR'])
print("\nClean PASS list (sorted by R1_closing_AIR, region-tagged):")
for r in passes:
    print(f"  {r['R1_closing_AIR']:>6}  [{TIERNAME[r['_tier']][:24]:24s}] "
          f"{r['state'][:14]:14s} {r['college'][:46]}")
if not passes:
    print("  (none yet confirmed)")
