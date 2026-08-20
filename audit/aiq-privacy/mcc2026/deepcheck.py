import re, subprocess, sys, urllib.parse, os, hashlib, json, collections
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
CACHE={}
def fetch(url, timeout=90, tries=3):
    """best-of-N: intermittent truncation defeated by keeping the largest body"""
    if url in CACHE: return CACHE[url]
    best=(0,b'')
    for attempt in range(tries):
        for extra in (['--compressed'],[]):
            cp=hashlib.md5((url+str(attempt)+str(extra)).encode()).hexdigest()
            try:
                p=subprocess.run(['curl','-sSL','-m',str(timeout),'-A',UA,
                    '-H','Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    '-H','Accept-Language: en-US,en;q=0.9']+extra+['-o',cp,'-w','%{http_code}',url],
                    capture_output=True,text=True,timeout=timeout+20)
                code=(p.stdout or '').strip()[-3:]
                data=open(cp,'rb').read() if os.path.exists(cp) else b''
                os.path.exists(cp) and os.unlink(cp)
            except Exception:
                code,data='000',b''
            if len(data)>best[0]: best=(len(data),data,code)
            if code not in ('403','406','429','503','000'): break
    r=(best[2] if len(best)>2 else '000', best[1])
    CACHE[url]=r; return r

NAMEHDR=re.compile(r'(name\s*of\s*(the\s*)?(student|candidate)|student\'?s?\s*name|candidate\s*name|\bname\b\s*of\s*admitted|^\s*name\s*$)',re.I|re.M)
def roster_score(text):
    """serial-numbered rows with >=2 capitalised tokens => name list"""
    hdr = 1 if NAMEHDR.search(text) else 0
    rows = re.findall(r'^\s*(\d{1,3})[\.\)\s|]+([A-Z][A-Za-z\.]+(?:\s+[A-Z][A-Za-z\.]+){1,5})\s*$', text, re.M)
    seq = len(rows)
    return hdr, seq

DOC=re.compile(r'\.(pdf|xls|xlsx|csv|doc|docx)(\?|$)',re.I)
def links(html, base):
    out=[]
    for m in re.finditer(r'href\s*=\s*["\']([^"\']+)["\'][^>]*>(.{0,120}?)<', html, re.I|re.S):
        out.append((urllib.parse.urljoin(base,m.group(1)), re.sub(r'<[^>]+>|\s+',' ',m.group(2)).strip()))
    # JS/data-file refs (the Kakatiya pattern)
    for m in re.finditer(r'''['"([\s]([^'"()\s]{3,140}\.(?:csv|xlsx?|json|pdf))(?=['")\s])''', html, re.I):
        out.append((urllib.parse.urljoin(base,m.group(1)),'[data-file ref]'))
    for m in re.finditer(r'''(?:window\.location|location\.href)\s*=\s*['"]([^'"]+)['"]''', html, re.I):
        out.append((urllib.parse.urljoin(base,m.group(1)),'[js redirect]'))
    for m in re.finditer(r'''<meta[^>]+http-equiv=["\']refresh["\'][^>]+url=([^"\'>\s]+)''', html, re.I):
        out.append((urllib.parse.urljoin(base,m.group(1)),'[meta refresh]'))
    return out

def pdftext(data):
    p='/tmp/_x.pdf'; open(p,'wb').write(data)
    try:
        import pypdf
        r=pypdf.PdfReader(p)
        return '\n'.join((pg.extract_text() or '') for pg in r.pages[:40]), len(r.pages)
    except Exception as e:
        return '', 0

def run(host):
    print('='*78); print('HOST', host)
    seeds=[f'https://{host}/', f'https://{host}/home.html', f'https://{host}/index.html',
           f'https://{host}/home', f'https://{host}/sitemap.xml', f'https://{host}/robots.txt']
    seen=set(); pages=[]; docs={}
    q=list(seeds)
    while q and len(pages)<70:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u)
        code,data=fetch(u)
        if code!='200' or not data: continue
        if DOC.search(u): docs[u]='[seed]'; continue
        h=data.decode('utf-8','ignore')
        pages.append((u,len(h)))
        print(f'  page {code} {len(h):>8}  {u[:96]}')
        for lu,lt in links(h,u):
            if urllib.parse.urlparse(lu).netloc.replace('www.','')!=host.replace('www.',''):
                continue
            if DOC.search(lu): docs.setdefault(lu,lt)
            elif lu not in seen and len(seen)<160: q.append(lu)
        # sitemap urls
        for m in re.finditer(r'<loc>([^<]+)</loc>', h, re.I):
            lu=m.group(1).strip()
            if host in lu:
                if DOC.search(lu): docs.setdefault(lu,'[sitemap]')
                elif lu not in seen: q.append(lu)
    print(f'  -> {len(pages)} pages, {len(docs)} documents')
    hits=[]
    for du,dt in list(docs.items())[:180]:
        code,data=fetch(du, timeout=120, tries=2)
        if code!='200' or not data: continue
        if du.lower().endswith('.pdf') or data[:5]==b'%PDF-':
            txt,np=pdftext(data)
        else:
            txt=data.decode('utf-8','ignore'); np=0
        hdr,seq=roster_score(txt)
        flag = (hdr and seq>=8) or seq>=20
        tag='ROSTER?' if flag else '       '
        if flag or hdr or seq>=5:
            print(f'  {tag} hdr={hdr} rows={seq:>4} pages={np:>3} chars={len(txt):>7}  {dt[:38]:38s} {du[:88]}')
        if flag: hits.append((du,dt,hdr,seq,np))
    print(f'  ==> ROSTER HITS: {len(hits)}')
    for h in hits: print('     !!', h[3],'rows |', h[0])
    return hits

if __name__=='__main__':
    allh={}
    for host in sys.argv[1:]:
        try: allh[host]=run(host)
        except Exception as e: print('ERR',host,e)
    json.dump({k:[list(x) for x in v] for k,v in allh.items()}, open('hits.json','w'), indent=1)
