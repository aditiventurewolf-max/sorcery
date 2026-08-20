"""Detect a published academic calendar / almanac on a college site."""
import sys, re, urllib.parse, json; sys.path.insert(0,'.')
from chk import fetch, links, DOC, pdftext
CAL = re.compile(r'academic\s*calend|academic\s*almanac|\balmanac\b|calendar\s*of\s*event|'
                 r'academic\s*schedule|academic\s*year\s*calend|time[\s-]*table|timetable|'
                 r'teaching\s*schedule|academic\s*planner', re.I)
PATHS = ['academic-calendar','academiccalendar','academic_calendar','calendar','almanac',
         'academic-calendar.php','calendar.php','academics','academic','time-table','timetable',
         'academic-calendar.html','calendar.html','academics.php','academics.html']
def run(host):
    root=f'https://{host}'
    found=[]
    seen=set(); q=[root+'/']+[f'{root}/{p}' for p in PATHS]
    docs={}
    while q and len(seen)<70:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u,timeout=55,tries=2)
        if code!='200' or not data: continue
        h=data.decode('utf-8','ignore')
        # calendar wording on the page itself
        for m in CAL.finditer(h):
            seg=re.sub(r'<[^>]+>',' ',h[max(0,m.start()-90):m.end()+90])
            found.append(('page', u, ' '.join(seg.split())[:110])); break
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''): continue
            if DOC.search(lu):
                if CAL.search(lu) or CAL.search(lt): docs[lu]=lt
            elif lu not in seen and len(seen)+len(q)<120 and CAL.search(lu+' '+lt): q.append(lu)
    for du,dt in list(docs.items())[:12]:
        code,data=fetch(urllib.parse.quote(du,safe=':/?&='),timeout=90,tries=2)
        if code=='200' and data:
            found.append(('doc', du, dt[:80]))
    verdict = 'HAS CALENDAR' if found else 'no academic calendar found'
    print(f'{host:34s} {verdict}')
    for k,u,t in found[:4]:
        print(f'      {k}: {t[:96]}')
        print(f'         {urllib.parse.unquote(u)[:104]}')
    return found
out={}
for h in sys.argv[1:]:
    try: out[h]=run(h)
    except Exception as e: print(f'{h:34s} ERR {e!r}')
    sys.stdout.flush()
json.dump({k:[list(x) for x in v] for k,v in out.items()}, open('calendars.json','w'), indent=1)
print('ALLDONE')
