"""Broader pass: open EVERY document on the host and look for a stated tuition figure."""
import sys, re, json, urllib.parse; sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
TUIT=re.compile(r'tuition\s*fee?s?[^\n\r]{0,40}?([\d][\d,]{3,11})',re.I)
FEEHDR=re.compile(r'(fee\s*structure|structure\s*of\s*fees|particulars.{0,30}fee|schedule\s*of\s*fees)',re.I)
def run(host):
    root=f'https://{host}'; seen=set(); docs={}; q=[root+'/']
    while q and len(seen)<80:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u,timeout=60,tries=2)
        if code!='200' or not data: continue
        h=data.decode('utf-8','ignore')
        # tuition stated directly in a page
        t=' '.join(re.sub(r'<[^>]+>',' ',h).split())
        for m in TUIT.finditer(t):
            v=m.group(1).replace(',','')
            if v.isdigit() and 500<=int(v)<=2000000: docs.setdefault('PAGE:'+u,None); print(f'   PAGE Rs {int(v):>9,}  {u[:88]}',flush=True)
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''): continue
            if DOC.search(lu): docs.setdefault(lu,lt)
            elif lu not in seen and len(seen)+len(q)<150: q.append(lu)
    hits=[]
    for du,dt in list(docs.items())[:70]:
        if du.startswith('PAGE:'): continue
        code,data=fetch(urllib.parse.quote(du,safe=':/?&='),timeout=120,tries=2)
        if code!='200' or not data: continue
        txt,np=(pdftext(data) if (du.lower().endswith('.pdf') or data[:5]==b'%PDF-') else (data.decode('utf-8','ignore'),0))
        t=' '.join(txt.split())
        for m in TUIT.finditer(t):
            v=m.group(1).replace(',','')
            if v.isdigit() and 500<=int(v)<=2000000:
                hits.append((int(v),du,dt)); print(f'   TUITION Rs {int(v):>9,}  {dt[:26]:26s} {urllib.parse.unquote(du)[:84]}',flush=True)
    print(f'--- {host}  docs={len(docs)} tuition_hits={len(hits)}',flush=True)
    return hits
o={}
for h in sys.argv[1:]:
    print(f'### {host_}' if False else f'### {h}',flush=True)
    try: o[h]=run(h)
    except Exception as e: print(f'--- {h} ERR {e!r}',flush=True)
json.dump({k:[list(x) for x in v] for k,v in o.items()}, open(f'feewide_{sys.argv[1]}.json','w'), indent=1)
print('ALLDONE',flush=True)
