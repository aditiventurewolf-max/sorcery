#!/usr/bin/env python3
"""Targeted sweep: TN (and similar) colleges share a CMS exposing /page/list-of-student.
Probe domain aliases x known list paths. Token-free."""
import concurrent.futures as cf, subprocess, sys, itertools
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
CITIES = sys.argv[1:] or """villupuram dharmapuri perundurai erode tiruppur nilgiris sivagangai karur
 thiruvannamalai tiruvannamalai dindigul namakkal thiruvarur tiruvarur krishnagiri pudukkottai
 ariyalur ramanathapuram kallakurichi nagapattinam""".split()
PATHS=['/page/list-of-student','/page/student-merit-list','/page/list-of-students',
       '/page/admitted-students','/page/mandatory-disclosure','/page/student-list']
def domains(c):
    return [f'{c}medicalcollege.in',f'{c}medicalcollege.com',f'gmch{c}.ac.in',f'gmc{c}.ac.in',
            f'{c}mc.ac.in',f'gmc{c}.org',f'{c}medicalcollege.ac.in']
def probe(args):
    d,p=args
    r=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code} %{size_download}','--max-time','12',
                      '-A',UA,f'https://{d}{p}'],capture_output=True,text=True)
    return d,p,(r.stdout or '0 0').strip()
jobs=[(d,p) for c in CITIES for d in domains(c) for p in PATHS]
print(f"probing {len(jobs)} url combos",file=sys.stderr)
with cf.ThreadPoolExecutor(max_workers=45) as ex:
    for d,p,st in ex.map(probe,jobs):
        code,size=st.split()[0],st.split()[-1]
        if code=='200' and int(size)>3000:
            print(f"HIT {code} {size:>8}  https://{d}{p}")
