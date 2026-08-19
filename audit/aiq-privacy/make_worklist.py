#!/usr/bin/env python3
"""Rebuild worklist.json from the source CSV: applies the brief section 2 state
corrections and orders colleges farthest-from-Lucknow first."""
import csv, json

rows = list(csv.DictReader(open('aiq_r1_2025_general_8k_13k.csv')))
STATE_FIX = {
    "Atal Bihari Vajpayee Government Medical College, Vidisha": "Madhya Pradesh",
    "Bundelkhand Medical College, Sagar": "Madhya Pradesh",
    "Govt Medical College Badaun": "Uttar Pradesh",   # UP: should have been excluded
    "Govt. Medical College, Khandwa": "Madhya Pradesh",
    "Goverment Medical College, Datia": "Madhya Pradesh",
}
TIER1 = {"Tamil Nadu","Karnataka","Andhra Pradesh","Telangana","Puducherry","Andaman & Nicobar"}
TIER2 = {"West Bengal","Odisha","Assam","Meghalaya","Manipur","Tripura","Gujarat","Maharashtra",
         "DNH & DD","Chhattisgarh","Jharkhand"}

out = []
for r in rows:
    st = STATE_FIX.get(r['college'], r['state']) or '(blank)'
    out.append({'college': r['college'], 'state': st, 'state_csv': r['state'],
                'close': int(r['R1_closing_AIR']), 'open': int(r['R1_opening_AIR']),
                'seats': int(r['seats_in_band']),
                'tier': 1 if st in TIER1 else (2 if st in TIER2 else 3)})
out.sort(key=lambda x: (x['tier'], x['close']))
for i, r in enumerate(out, 1):
    r['id'] = i
json.dump(out, open('worklist.json', 'w'), indent=1)
print(f"worklist.json: {len(out)} colleges")
