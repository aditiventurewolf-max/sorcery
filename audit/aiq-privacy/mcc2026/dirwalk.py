"""Open-directory walk with ABSOLUTE-path hrefs handled (the bug that
falsely cleared Raigarh's /uploads/student/ and Dhanbad's dirs)."""
import sys, re, urllib.parse, json; sys.path.insert(0,'.')
from chk import fetch, DOC, pdftext
from chk2 import score, flag
DIRS=['uploads/','upload/','files/','assets/','assets/uploads/','storage/','storage/uploads/',
      'documents/','docs/','pdf/','pdfs/','media/','data/','downloads/','download/','public/',
      'wp-content/uploads/','attachments/','file/','uploadfile/','images/','student/','students/']
def walk(root, start, seen, files, d=0):
    if d>4 or start in seen: return
    seen.add(start)
    code,data=fetch(start,timeout=45,tries=2)
    if code!='200' or not data: return
    h=data.decode('utf-8','ignore')
    if not re.search(r'autoindex|Index of|Directory listing',h,re.I): return
    print(f'   {"  "*d}DIR {urllib.parse.unquote(start.replace(root,""))}', flush=True)
    for x in re.findall(r'href="([^"]+)"',h,re.I):
        if x.startswith(('?','#')) or '../' in x or 'autoindex' in x: continue
        full=urllib.parse.urljoin(root+'/', x.lstrip('/'))   # <-- absolute paths now handled
        if full in seen or full.rstrip('/')==start.rstrip('/'): continue
        if x.rstrip().endswith('/'): walk(root, full, seen, files, d+1)
        elif DOC.search(full): files.append(full)
for host in sys.argv[1:]:
    root=f'https://{host}'
    print('#'*70); print('HOST',host, flush=True)
    seen=set(); files=[]
    for d in DIRS: walk(root, f'{root}/{d}', seen, files)
    files=sorted(set(files))
    print(f'   documents discovered via open dirs: {len(files)}', flush=True)
    hits=[]
    for f in files:
        q=urllib.parse.quote(f,safe=':/?&=')
        code,data=fetch(q,timeout=120,tries=2)
        if code!='200' or not data: continue
        txt,np=(pdftext(data) if (f.lower().endswith('.pdf') or data[:5]==b'%PDF-') else (data.decode('utf-8','ignore'),0))
        hdr,a,b=score(txt)
        if flag(hdr,a,b,f):
            hits.append(f); print(f'   ROSTER? hdr={hdr} A={a} B={b} p={np}  {urllib.parse.unquote(f)[:96]}', flush=True)
    print(f'   ==> HITS {len(hits)}', flush=True)
print('ALLDONE', flush=True)
