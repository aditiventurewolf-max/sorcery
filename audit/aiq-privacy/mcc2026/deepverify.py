"""Maximum-depth verification for two hosts: crawl + sitemap + recursive open-dir
walk + fixed-path probe + open EVERY document with the corrected detector."""
import sys, re, json, urllib.parse, collections
sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
from chk2 import score, flag, FNAME

DIRS=['','files/','uploads/','upload/','assets/','assets/pdf/','documents/','docs/','pdf/','pdfs/',
      'downloads/','download/','wp-content/uploads/','media/','data/','images/','img/',
      'files/admission/','files/students/','admission/','student/','students/','notice/','notices/',
      'circular/','circulars/','public/','storage/','attachments/','file/','uploadfile/']
PATHS=['student-list','students','student-corner','student-section','studentcorner','student_corner',
       'admission','admissions','ug-admission','mandatory-disclosure','disclosure','nmc','msr',
       'list-of-students','admitted-students','merit-list','students.php','student.php',
       'mandatory-disclosure.php','nmc.php','disclosure.php','admission.php','students.html',
       'student-corner.php','ug.php','mbbs.php','batch.php','studentlist.php','academics',
       'academic','notice','notices','downloads','gallery','alumni']

def walk_dir(base, depth=0, seen=None, out=None):
    """recursive open-directory walk"""
    if seen is None: seen=set()
    if out is None: out=[]
    if depth>3 or base in seen: return out
    seen.add(base)
    code,data=fetch(base,timeout=45,tries=1)
    if code!='200' or not data: return out
    h=data.decode('utf-8','ignore')
    if not re.search(r'Index of|Directory listing|<title>Index',h,re.I): return out
    print(f'   OPEN-DIR d{depth} {len(h):>7} {base}', flush=True)
    for m in re.finditer(r'href="([^"?#][^"]*)"',h,re.I):
        t=m.group(1)
        if t.startswith('/') or t.startswith('..'): continue
        u=urllib.parse.urljoin(base,t)
        if u.endswith('/'): walk_dir(u,depth+1,seen,out)
        elif DOC.search(u): out.append(u)
    return out

def run(host):
    print('#'*76); print('HOST',host, flush=True)
    seen=set(); docs={}; q=[f'https://{host}/',f'https://{host}/sitemap.xml',f'https://{host}/robots.txt']
    while q and len(seen)<300:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u,timeout=70,tries=2)
        if code!='200' or not data: continue
        h=data.decode('utf-8','ignore')
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''): continue
            if DOC.search(lu): docs.setdefault(lu,lt)
            elif lu not in seen and len(seen)+len(q)<600: q.append(lu)
        for m in re.finditer(r'<loc>([^<]+)</loc>',h,re.I):
            lu=m.group(1).strip()
            if host in lu and lu not in seen:
                (docs.setdefault(lu,'[sitemap]') if DOC.search(lu) else q.append(lu))
    print(f'   crawl: {len(seen)} urls, {len(docs)} docs', flush=True)
    # open dirs
    for d in DIRS:
        for f in walk_dir(f'https://{host}/{d}'):
            docs.setdefault(f,'[open-dir]')
    print(f'   after dir-walk: {len(docs)} docs', flush=True)
    # fixed paths
    for p in PATHS:
        u=f'https://{host}/{p}'
        code,data=fetch(u,timeout=40,tries=1)
        if code=='200' and data and len(data)>900:
            h=data.decode('utf-8','ignore')
            hdr,a,b=score(h)
            if flag(hdr,a,b,u) or hdr:
                print(f'   PAGE-FLAG hdr={hdr} A={a} B={b}  {u}', flush=True)
            for lu,lt in links(h,u):
                if DOC.search(lu) and host in lu: docs.setdefault(lu,f'[path:{p}]')
    print(f'   total docs to open: {len(docs)}', flush=True)
    hits=[]
    for i,(du,dt) in enumerate(docs.items()):
        qq=urllib.parse.quote(du,safe=':/?&=')
        code,data=fetch(qq,timeout=130,tries=2)
        if code!='200' or not data: continue
        txt,np=(pdftext(data) if (du.lower().endswith('.pdf') or data[:5]==b'%PDF-') else (data.decode('utf-8','ignore'),0))
        hdr,a,b=score(txt)
        if flag(hdr,a,b,du):
            hits.append({'url':du,'text':dt,'hdr':hdr,'rowsA':a,'rowsB':b,'pages':np,'chars':len(txt)})
            print(f'   ROSTER? hdr={hdr} A={a} B={b} p={np} c={len(txt)}  {dt[:26]:26s} {urllib.parse.unquote(du)[:98]}', flush=True)
        elif hdr and np and len(txt)<80*np:
            print(f'   SCANNED? hdr={hdr} p={np} chars={len(txt)} (little text -> may be image)  {urllib.parse.unquote(du)[:88]}', flush=True)
    print(f'   ==> HITS {len(hits)}', flush=True)
    return hits

out={}
for h in sys.argv[1:]:
    try: out[h]=run(h)
    except Exception as e: print('ERR',h,repr(e), flush=True)
json.dump(out, open('focus_hits.json','w'), indent=1)
print('ALLDONE', flush=True)
