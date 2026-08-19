#!/usr/bin/env python3
"""Free domain discovery: generate plausible domains from college name+city, probe in parallel."""
import json,re,sys,itertools,concurrent.futures as cf,subprocess
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
STOP={'government','govt','medical','college','hospital','institute','of','sciences','science',
      'and','the','for','&','research','centre','center','general','district','memorial','dr',
      'inst','med','coll','mc','gmc','university','women','islands'}
TLDS=['ac.in','edu.in','org','in','com','org.in','net.in']
def toks(name):
    n=re.sub(r'[^A-Za-z ]',' ',name).lower()
    return [w for w in n.split() if w and w not in STOP and len(w)>2]
def cands(college):
    t=toks(college); out=[]
    city=t[-1] if t else ''
    keys=set()
    if city:
        keys|={f'gmc{city}',f'gmch{city}',f'{city}mc',f'{city}medicalcollege',f'gmc-{city}',
               f'{city}gmc',f'mc{city}',f'{city}mch'}
    if len(t)>=2:
        ac=''.join(w[0] for w in t)
        keys|={ac, ac+city if city else ac}
    for k in list(keys):
        for tld in TLDS: out.append(f'{k}.{tld}')
    return out[:60]
def probe(d):
    p=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','--max-time','9','-L',
                      '-A',UA,f'https://{d}'],capture_output=True,text=True)
    c=(p.stdout or '0').strip()[-3:]
    return d, c
if __name__=='__main__':
    wl=json.load(open('worklist.json'))
    tier=int(sys.argv[1]); rows=[r for r in wl if r['tier']==tier]
    allc={}
    for r in rows:
        for d in cands(r['college']): allc.setdefault(d,[]).append(r['id'])
    print(f"probing {len(allc)} candidate domains for {len(rows)} colleges (tier {tier})",file=sys.stderr)
    hits={}
    with cf.ThreadPoolExecutor(max_workers=40) as ex:
        for d,c in ex.map(probe, allc.keys()):
            if c in ('200','301','302','403'):
                for i in allc[d]: hits.setdefault(i,[]).append((d,c))
    for r in rows:
        h=hits.get(r['id'])
        if h: print(f"{r['id']:3d} {r['college'][:46]:46s} {h}")
    json.dump({str(k):v for k,v in hits.items()}, open(f'guess_t{tier}.json','w'), indent=1)
