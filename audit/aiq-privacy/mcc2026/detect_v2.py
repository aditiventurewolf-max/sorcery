"""Corrected detector. Two new lessons:
 (6) names sit INLINE with trailing numerics (marks/percentile), so an
     end-anchored row regex misses them -> allow trailing data.
 (7) URLs with literal spaces were dropped by link extraction -> quote them.
"""
import re, sys, json, urllib.parse, collections
sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
NAMEHDR=re.compile(r'(name\s*of\s*(the\s*)?(student|candidate|admitted)|student\'?s?\s*name|candidate\s*name)',re.I)
ROW_A=re.compile(r'^\s*(\d{1,3})[\.\)\s|]+([A-Z][A-Za-z\.]+(?:\s+[A-Z][A-Za-z\.]+){1,5})\s*$',re.M)
ROW_B=re.compile(r'(?:^|\s)(\d{1,3})\s+([A-Z][A-Z\.]+(?:\s+[A-Z][A-Z\.]+){1,5})\s+([\d]{1,3}\.\d{1,2})')
FNAME=re.compile(r'(batch|student|admitted|admission|merit|allot|roll|enrol|ug[\W_]|mbbs.?list|list.?of)',re.I)
def score(text):
    return (1 if NAMEHDR.search(text) else 0), len(ROW_A.findall(text)), len(ROW_B.findall(text))
def flag(hdr,a,b,url):
    return (hdr and (a+b)>=4) or (a+b)>=15 or (hdr and FNAME.search(url))
def run(host):
    print('='*74); print('HOST',host, flush=True)
    seen=set(); docs={}; q=[f'https://{host}/',f'https://{host}/home.html',f'https://{host}/sitemap.xml']
    while q and len(seen)<110:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u,timeout=70,tries=2)
        if code!='200' or not data: continue
        h=data.decode('utf-8','ignore')
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''): continue
            if DOC.search(lu): docs.setdefault(lu,lt)
            elif lu not in seen and len(seen)+len(q)<190: q.append(lu)
        for m in re.finditer(r'<loc>([^<]+)</loc>',h,re.I):
            lu=m.group(1).strip()
            if host in lu and lu not in seen:
                (docs.setdefault(lu,'[sitemap]') if DOC.search(lu) else q.append(lu))
    print(f'  crawled {len(seen)} urls, {len(docs)} documents', flush=True)
    hits=[]
    for du,dt in docs.items():
        qq=urllib.parse.quote(du,safe=':/?&=')
        code,data=fetch(qq,timeout=130,tries=2)
        if code!='200' or not data: continue
        txt,np=(pdftext(data) if (du.lower().endswith('.pdf') or data[:5]==b'%PDF-') else (data.decode('utf-8','ignore'),0))
        hdr,a,b=score(txt)
        if flag(hdr,a,b,du):
            hits.append((du,dt,hdr,a,b,np))
            print(f'  ROSTER? hdr={hdr} rowsA={a} rowsB={b} p={np}  {dt[:30]:30s} {du[:100]}', flush=True)
        elif hdr or (a+b)>=3:
            print(f'  weak    hdr={hdr} rowsA={a} rowsB={b} p={np}  {du[:100]}', flush=True)
    print(f'  ==> HITS {len(hits)}  {"FAIL" if hits else "clean on this pass"}', flush=True)
    return hits
if __name__=='__main__':
    out={}
    for h in sys.argv[1:]:
        try: out[h]=run(h)
        except Exception as e: print('ERR',h,repr(e), flush=True)
    json.dump({k:[list(x) for x in v] for k,v in out.items()}, open('hits2.json','w'), indent=1)
