#!/usr/bin/env python3
"""Resolve official websites for colleges still unresolved, via the Wikipedia API.
Requires the matched article title to genuinely correspond to the college
(shared distinctive token) so we don't inherit a wrong article's website."""
import json, os, re, sys, urllib.parse, concurrent.futures as cf, threading
import scan

gate = threading.Semaphore(6)
wl = json.load(open('worklist.json'))
disc = json.load(open('discover.json')) if os.path.exists('discover.json') else {}
resolved = set(int(k) for k in disc)

BAD = ('rguhs.ac.in', 'indianexpress', 'timesofindia', 'wikipedia', 'ntruhs', 'knruhs',
       'tnmgrmu', 'thehindu', 'facebook', 'youtube', 'mciindia', 'nmc.org.in', 'mcc.nic.in',
       'web.archive.org', 'aiims', 'who.int', 'nic.in/en', 'india.gov.in', 'mohfw')
STOP = {'government','govt','goverment','medical','college','hospital','institute','of','sciences',
        'science','and','the','for','research','centre','center','general','district','memorial',
        'dr','inst','med','coll','university','previously','known','as','formerly','called','new'}


def keytoks(name):
    n = re.sub(r'[^A-Za-z ]', ' ', name).lower()
    return {w for w in n.split() if w not in STOP and len(w) > 3}


def resolve(r):
    if r['id'] in resolved:
        return None
    kt = keytoks(r['college'])
    queries = [r['college'], re.sub(r'[^A-Za-z ]', ' ', r['college']) + ' ' + r['state']]
    for q in queries:
        with gate:
            try:
                url, hits = scan.wiki_site(q)
            except Exception:
                continue
        if not url:
            continue
        dom = urllib.parse.urlparse(url).netloc.lower()
        if any(b in url.lower() for b in BAD) or not dom:
            continue
        # require the matched article to share a distinctive token with the college
        if hits and kt and not (kt & keytoks(hits[0])):
            continue
        return {'id': r['id'], 'college': r['college'], 'state': r['state'],
                'close': r['close'], 'url': url, 'wiki_title': hits[0] if hits else ''}
    return None


out = []
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for o in ex.map(resolve, wl):
        if o:
            out.append(o)

# probe each for reachability before we bother recording it
def probe(o):
    with gate:
        c, d = scan.fetch(o['url'], timeout=20)
    o['http'] = c
    o['bytes'] = len(d)
    return o


with cf.ThreadPoolExecutor(max_workers=6) as ex:
    out = list(ex.map(probe, out))

out.sort(key=lambda x: x['id'])
json.dump(out, open('wikires.json', 'w'), indent=1)
live = [o for o in out if o['http'] == 200 and o['bytes'] > 2000]
for o in out:
    tag = 'LIVE' if (o['http'] == 200 and o['bytes'] > 2000) else f"x{o['http']}"
    print(f"{o['id']:3d} {tag:6s} {o['state'][:11]:11s} {o['college'][:38]:38s} {o['url'][:44]}")
print(f"\nnew candidates {len(out)}, live {len(live)}", file=sys.stderr)
