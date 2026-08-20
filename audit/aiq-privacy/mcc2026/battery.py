"""Full battery for one host: ~120 fixed disclosure paths, 300-URL no-keyword-gated
crawl, sitemap/robots, recursive open-dir walk (absolute paths), best-of-3 fetching,
every document opened with the corrected detector."""
import sys, re, json, urllib.parse; sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
from chk2 import score, flag

HOST = sys.argv[1]
ROOT = f'https://{HOST}'

STEMS = ['student-list','students','student','student-corner','studentcorner','student_corner',
 'student-section','studentsection','students-list','list-of-students','admitted-students',
 'admission','admissions','ug-admission','ug-admissions','mbbs-admission','merit-list',
 'mandatory-disclosure','disclosure','disclosures','nmc','nmc-disclosure','mci','msr','msrr',
 'b111','b-1-11','clause-b111','intake','intake-capacity','sanctioned-intake','batch','batches',
 'ug','pg','academics','academic','notice','notices','circular','circulars','downloads',
 'download','result','results','exam','examination','alumni','hostel','anti-ragging',
 'antiragging','rti','gallery','about','contact','department','departments','faculty','staff']
EXTS = ['','.html','.htm','.php','.aspx','.jsp','/']
DIRS = ['uploads/','upload/','files/','file/','assets/','assets/uploads/','assets/pdf/','storage/',
 'storage/uploads/','documents/','docs/','pdf/','pdfs/','media/','data/','downloads/','download/',
 'public/','wp-content/uploads/','attachments/','uploadfile/','images/','img/','student/',
 'students/','filedata/','uploaded_files/','brcp/','sitefiles/','userfiles/']

def walkdir(start, seen, files, d=0):
    if d>4 or start in seen: return
    seen.add(start)
    code,data = fetch(start, timeout=45, tries=2)
    if code!='200' or not data: return
    h = data.decode('utf-8','ignore')
    if not re.search(r'autoindex|Index of|Directory listing', h, re.I): return
    print(f'   {"  "*d}OPEN-DIR {urllib.parse.unquote(start.replace(ROOT,""))}', flush=True)
    for x in re.findall(r'href="([^"]+)"', h, re.I):
        if x.startswith(('?','#')) or '../' in x or 'autoindex' in x: continue
        full = urllib.parse.urljoin(ROOT+'/', x.lstrip('/'))
        if full in seen or full.rstrip('/')==start.rstrip('/'): continue
        if x.rstrip().endswith('/'): walkdir(full, seen, files, d+1)
        elif DOC.search(full): files.append(full)

docs, seen = {}, set()
print('### 1. fixed-path battery', flush=True)
paths = [s+e for s in STEMS for e in EXTS]
print(f'   probing {len(paths)} fixed paths', flush=True)
pagehits = 0
for p in paths:
    u = f'{ROOT}/{p}'
    code,data = fetch(u, timeout=30, tries=1)
    if code!='200' or not data or len(data)<800: continue
    h = data.decode('utf-8','ignore')
    hdr,a,b = score(h)
    if flag(hdr,a,b,u) or hdr:
        pagehits += 1
        print(f'   PAGE-FLAG hdr={hdr} A={a} B={b} {len(h):>7}  /{p}', flush=True)
    for lu,lt in links(h,u):
        if DOC.search(lu) and HOST in lu: docs.setdefault(lu, f'[path:{p}]')
print(f'   fixed paths: {pagehits} flagged pages, {len(docs)} docs so far', flush=True)

print('### 2. crawl (no keyword gating)', flush=True)
q = [ROOT+'/', ROOT+'/sitemap.xml', ROOT+'/sitemap_index.xml', ROOT+'/robots.txt']
while q and len(seen)<300:
    u = q.pop(0)
    if u in seen: continue
    seen.add(u)
    code,data = fetch(u, timeout=80, tries=3)
    if code!='200' or not data: continue
    h = data.decode('utf-8','ignore')
    for lu,lt in links(h,u):
        if urllib.parse.urlparse(lu).netloc.replace('www.','')!=HOST.replace('www.',''): continue
        if DOC.search(lu): docs.setdefault(lu, lt)
        elif lu not in seen and len(seen)+len(q)<700: q.append(lu)
    for m in re.finditer(r'<loc>([^<]+)</loc>', h, re.I):
        lu = m.group(1).strip()
        if HOST in lu and lu not in seen:
            (docs.setdefault(lu,'[sitemap]') if DOC.search(lu) else q.append(lu))
print(f'   crawled {len(seen)} urls, {len(docs)} docs', flush=True)

print('### 3. recursive open-directory walk', flush=True)
dseen, dfiles = set(), []
for d in DIRS: walkdir(f'{ROOT}/{d}', dseen, dfiles)
for f in dfiles: docs.setdefault(f, '[open-dir]')
print(f'   open dirs contributed {len(dfiles)} files; total {len(docs)}', flush=True)

print('### 4. opening every document', flush=True)
hits = []
for i,(du,dt) in enumerate(sorted(docs.items())):
    qq = urllib.parse.quote(du, safe=':/?&=')
    code,data = fetch(qq, timeout=140, tries=3)
    if code!='200' or not data: continue
    txt,np = (pdftext(data) if (du.lower().endswith('.pdf') or data[:5]==b'%PDF-')
              else (data.decode('utf-8','ignore'), 0))
    hdr,a,b = score(txt)
    if flag(hdr,a,b,du):
        hits.append({'url':du,'label':dt,'hdr':hdr,'rowsA':a,'rowsB':b,'pages':np,'chars':len(txt)})
        print(f'   ROSTER? hdr={hdr} A={a} B={b} p={np} c={len(txt)}  {dt[:24]:24s} {urllib.parse.unquote(du)[:92]}', flush=True)
    elif hdr and np and len(txt) < 80*np:
        print(f'   SCANNED? hdr={hdr} p={np} chars={len(txt)}  {urllib.parse.unquote(du)[:88]}', flush=True)
print(f'### DONE {HOST}: {len(docs)} docs opened, {len(hits)} roster hits', flush=True)
json.dump(hits, open(f'battery_{HOST}.json','w'), indent=1)
print('ALLDONE', flush=True)
