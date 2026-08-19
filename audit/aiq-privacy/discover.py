#!/usr/bin/env python3
"""Throttled domain discovery across all 135 colleges. Token-free.
Tight, high-yield pattern set (derived from what actually resolved in tier 1)."""
import json, re, sys, subprocess, time, threading, concurrent.futures as cf

UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/126.0 Safari/537.36')
STOP = {'government','govt','goverment','medical','college','hospital','institute','of','sciences',
        'science','and','the','for','research','centre','center','general','district','memorial',
        'dr','inst','med','coll','university','women','islands','previously','known','as','formerly',
        'called','new','town','gram','near','pt','lt','sh','smt','shri','sri','shrimati','esic',
        'rims','vims','gims','kims','sims','hims','cims','mims','bims','brims'}
TLDS = ['ac.in', 'in', 'org', 'com', 'edu.in']
_gate = threading.Semaphore(14)


def toks(name):
    n = re.sub(r'[^A-Za-z ]', ' ', name).lower()
    return [w for w in n.split() if w and w not in STOP and len(w) > 2]


def cands(college):
    t = toks(college)
    if not t:
        return []
    keys = set()
    for c in ({t[-1], t[0]} if len(t) > 1 else {t[-1]}):
        if len(c) < 4:
            continue
        keys |= {f'{c}medicalcollege', f'gmc{c}', f'gmch{c}', f'{c}gmc',
                 f'mc{c}', f'{c}mc', f'{c}mch', f'{c}medicalcollegehospital'}
    return [f'{k}.{tl}' for k in keys if len(k) >= 7 for tl in TLDS]


def probe(d):
    with _gate:
        time.sleep(0.05)
        r = subprocess.run(['curl', '-s', '-o', '/dev/null',
                            '-w', '%{http_code} %{size_download}',
                            '--max-time', '9', '-L', '-A', UA, f'https://{d}'],
                           capture_output=True, text=True)
    parts = (r.stdout or '0 0').split()
    return d, (parts[0] if parts else '0'), (parts[-1] if len(parts) > 1 else '0')


wl = json.load(open('worklist.json'))
allc = {}
for r in wl:
    for d in cands(r['college']):
        allc.setdefault(d, []).append(r['id'])
print(f"{len(allc)} candidate domains for {len(wl)} colleges", file=sys.stderr)

hits, done = {}, 0
with cf.ThreadPoolExecutor(max_workers=14) as ex:
    for d, code, size in ex.map(probe, list(allc.keys())):
        done += 1
        if done % 400 == 0:
            print(f"  ..{done}/{len(allc)}", file=sys.stderr, flush=True)
        if code in ('200', '301', '302') and int(size) > 2000:
            for i in allc[d]:
                hits.setdefault(i, []).append([d, code, int(size)])

json.dump(hits, open('discover.json', 'w'), indent=1)
byid = {r['id']: r for r in wl}
for i in sorted(hits, key=int):
    r = byid[int(i)]
    print(f"{i:>4} {r['state'][:11]:11s} {r['college'][:42]:42s} "
          + ', '.join(f"{d}({s})" for d, c, s in hits[i][:4]))
print(f"resolved {len(hits)}/{len(wl)}", file=sys.stderr)
