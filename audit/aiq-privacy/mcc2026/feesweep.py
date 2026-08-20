"""Extract the college's OWN stated tuition/fee figures from its own documents."""
import sys, re, json, urllib.parse; sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
HOT=re.compile(r'fee|brochure|prospect|admission|instruction|guideline|structure|shulk|manual',re.I)
TUIT=re.compile(r'tuition\s*fee?s?\s*(?:\(per\s*annum\)|per\s*annum|p\.?a\.?)?\D{0,30}?([\d][\d,]{3,11})',re.I)
ANY=re.compile(r'(?:total\s*fees?|1st\s*DD|first\s*DD)\D{0,30}?([\d][\d,]{3,11})',re.I)
def run(host):
    root=f'https://{host}'; seen=set(); docs={}; q=[root+'/']
    for p in ['fee','fees','fee-structure','fees.php','fee-structure.php','admission','admissions',
              'admission.php','fees.html','student-corner','notice','downloads','']:
        q.append(f'{root}/{p}' if p else root+'/')
    while q and len(seen)<60:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u,timeout=55,tries=2)
        if code!='200' or not data: continue
        h=data.decode('utf-8','ignore')
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''): continue
            if DOC.search(lu):
                if HOT.search(lu) or HOT.search(lt): docs.setdefault(lu,lt)
            elif lu not in seen and len(seen)+len(q)<110 and HOT.search(lu+' '+lt): q.append(lu)
    found=[]
    for du,dt in list(docs.items())[:30]:
        code,data=fetch(urllib.parse.quote(du,safe=':/?&='),timeout=130,tries=2)
        if code!='200' or not data: continue
        txt,np=(pdftext(data) if (du.lower().endswith('.pdf') or data[:5]==b'%PDF-') else (data.decode('utf-8','ignore'),0))
        t=' '.join(txt.split())
        for m in TUIT.finditer(t):
            v=m.group(1).replace(',','')
            if v.isdigit() and 500<=int(v)<=2000000: found.append(('TUITION',int(v),du))
        for m in ANY.finditer(t):
            v=m.group(1).replace(',','')
            if v.isdigit() and 500<=int(v)<=2000000: found.append(('TOTAL/DD',int(v),du))
    print(f'--- {host}  ({len(docs)} fee-ish docs)')
    if not found: print('      no stated fee figure found in its own documents')
    seenv=set()
    for k,v,u in found:
        if (k,v) in seenv: continue
        seenv.add((k,v))
        print(f'      {k:8s} Rs {v:>9,}   {urllib.parse.unquote(u)[:88]}')
    return found
out={}
for h in sys.argv[1:]:
    try: out[h]=run(h)
    except Exception as e: print(f'--- {h} ERR {e!r}')
    sys.stdout.flush()
json.dump({k:[list(x) for x in v] for k,v in out.items()}, open(f'fees_{sys.argv[1]}.json','w'), indent=1)
print('ALLDONE')
