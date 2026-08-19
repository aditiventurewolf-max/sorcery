#!/usr/bin/env python3
"""Bulk pass: resolve candidate domain (Wikipedia) -> probe -> find HOT disclosure links.
Free of LLM tokens; prints a compact table. Writes bulk.json for review."""
import json, sys, re, urllib.parse, concurrent.futures as cf, scan

wl = json.load(open('worklist.json'))
tier = int(sys.argv[1]) if len(sys.argv)>1 else 0
rows = [r for r in wl if (tier==0 or r['tier']==tier)]

# hand-seeded domains where Wikipedia is known-wrong or absent
SEED = json.load(open('domains.json')) if __import__('os').path.exists('domains.json') else {}

def plausible(dom, college):
    """Reject affiliating-university / news / aggregator domains."""
    bad = ('rguhs.ac.in','indianexpress.com','timesofindia','wikipedia','ntruhs','knruhs',
           'mgrmu','tnmgrmu.ac.in','thehindu','nic.in/en','facebook','youtube','mciindia',
           'nmc.org.in','mcc.nic.in','aiims')
    return dom and not any(b in dom.lower() for b in bad)

def work(r):
    coll = r['college']
    out = {'id':r['id'],'college':coll,'state':r['state'],'close':r['close'],'tier':r['tier']}
    url = SEED.get(coll)
    if not url:
        try: url,_ = scan.wiki_site(f"{coll} medical college")
        except Exception: url=None
        if url and not plausible(urllib.parse.urlparse(url).netloc, coll):
            url = None
    out['cand_url'] = url
    if not url:
        out['reach']='NO-DOMAIN'; return out
    try:
        code, data = scan.fetch(url, timeout=25)
    except Exception as e:
        out['reach']=f'ERR:{type(e).__name__}'; return out
    out['http']=code
    if code==0: out['reach']='DEAD(conn-reset)'; return out
    if code>=400: out['reach']=f'HTTP{code}'; return out
    out['reach']='OK'
    body,_ = scan.text_of(data, url)
    out['body_len']=len(body.strip())
    if len(body.strip())<300: out['spa']=True
    ls = scan.links(data, url)
    hot=[]; seen=set()
    for u,t in ls:
        if (scan.HOT.search(t) or scan.HOT.search(urllib.parse.unquote(u))) and u not in seen:
            seen.add(u); hot.append({'text':t[:70],'url':u})
    out['hot']=hot[:25]; out['n_links']=len(ls)
    return out

res=[]
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    for o in ex.map(work, rows): res.append(o)
res.sort(key=lambda x:x['id'])
json.dump(res, open(f'bulk_t{tier}.json','w'), indent=1)

for o in res:
    flag = 'HOT' if o.get('hot') else ('spa' if o.get('spa') else '   ')
    print(f"{o['id']:3d} {flag} {o['reach']:16s} {o['state'][:11]:11s} {o['college'][:44]:44s} {str(o.get('cand_url'))[:44]}")
    for h in (o.get('hot') or [])[:6]:
        print(f"        > [{h['text'][:52]}] {h['url'][:96]}")
print(f"\n-- {len(res)} rows | OK={sum(1 for o in res if o['reach']=='OK')} "
      f"DEAD={sum(1 for o in res if 'DEAD' in o['reach'])} "
      f"NODOM={sum(1 for o in res if o['reach']=='NO-DOMAIN')} "
      f"HOT={sum(1 for o in res if o.get('hot'))}")
