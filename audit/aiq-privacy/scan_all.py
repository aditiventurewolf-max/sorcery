#!/usr/bin/env python3
"""For every college with a resolved domain, scan the site for disclosure/admitted-list
pages, then judge any candidate document. Token-free; prints only findings.

PRIVACY: never prints student names.
"""
import json, os, re, sys, urllib.parse, threading, concurrent.futures as cf
import scan

gate = threading.Semaphore(6)
wl = {r['id']: r for r in json.load(open('worklist.json'))}
disc = json.load(open('discover.json')) if os.path.exists('discover.json') else {}
extra = json.load(open('domains.json')) if os.path.exists('domains.json') else {}

# college name -> explicit url overrides (found via search)
by_name = {}
for k, v in extra.items():
    by_name[k] = v


def best_domain(cid):
    """Prefer the alias that actually serves content (largest body)."""
    hs = disc.get(str(cid)) or []
    hs = sorted(hs, key=lambda h: -h[2])
    return [f"https://{h[0]}" for h in hs]


def sniff(cid):
    r = wl[cid]
    urls = []
    if r['college'] in by_name:
        urls.append(by_name[r['college']])
    urls += best_domain(cid)
    out = {'id': cid, 'college': r['college'], 'state': r['state'], 'close': r['close'],
           'tried': urls[:4], 'site': None, 'hot': [], 'docs': [], 'note': ''}
    for u in urls[:4]:
        with gate:
            code, data = scan.fetch(u, timeout=25)
        if code != 200 or len(data) < 2000:
            continue
        body, _ = scan.text_of(data, u)
        out['site'] = u
        out['body_len'] = len(body.strip())
        if len(body.strip()) < 300:
            out['note'] = 'near-empty render -> JS SPA, needs headless browser'
            return out
        seen = set()
        for lu, lt in scan.links(data, u):
            if (scan.HOT.search(lt) or scan.HOT.search(urllib.parse.unquote(lu))) and lu not in seen:
                seen.add(lu)
                out['hot'].append({'text': lt[:70], 'url': lu})
        return out
    out['note'] = 'no reachable site among candidates'
    return out


def deep(o):
    """Follow HOT links one hop; judge PDFs/pages for name-bearing rosters."""
    cands = []
    for h in o['hot'][:8]:
        u = h['url']
        if re.search(r'\.(pdf|xlsx?|docx?)($|\?)', u, re.I):
            cands.append(u)
        else:
            with gate:
                code, data = scan.fetch(u, timeout=25)
            if code == 200 and data:
                for lu, lt in scan.links(data, u):
                    if re.search(r'\.(pdf|xlsx?)($|\?)', lu, re.I) and (
                            scan.HOT.search(lt) or scan.HOT.search(urllib.parse.unquote(lu))
                            or re.search(r'(student|admit|batch|list|merit)', lu, re.I)):
                        cands.append(lu)
                # page itself may hold an inline table
                t, _ = scan.text_of(data, u)
                if scan.NAMEHDR.search(t) and len(re.findall(r'<tr', data.decode('utf8', 'ignore'), re.I)) > 6:
                    o['docs'].append({'url': u, 'inline_table': True,
                                      'name_header': scan.NAMEHDR.search(t).group(0)[:50],
                                      'rows': len(re.findall(r'<tr', data.decode('utf8', 'ignore'), re.I)) - 1})
    seen = set()
    for c in cands[:10]:
        if c in seen:
            continue
        seen.add(c)
        with gate:
            j = scan.judge_doc(c)
        if j.get('verdict_hint') in ('NAME-LIST', 'MAYBE') or j.get('status', '').startswith('no-text'):
            o['docs'].append(j)
    return o


ids = [int(x) for x in sys.argv[1:]] or sorted(wl)
res = []
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for o in ex.map(sniff, ids):
        res.append(o)
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    res = list(ex.map(deep, res))

res.sort(key=lambda x: x['id'])
json.dump(res, open('sitescan.json', 'w'), indent=1)
for o in res:
    mark = 'DOC!' if o['docs'] else ('hot ' if o['hot'] else '    ')
    print(f"{o['id']:3d} {mark} {o['state'][:11]:11s} {o['college'][:40]:40s} "
          f"{(o['site'] or o['note'])[:46]}")
    for h in o['hot'][:4]:
        print(f"      hot [{h['text'][:46]}] {h['url'][:88]}")
    for d in o['docs'][:6]:
        print(f"      DOC {json.dumps(d)[:210]}")
