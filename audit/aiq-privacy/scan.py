#!/usr/bin/env python3
"""
AIQ privacy audit scanner.

Fetches college sites with curl (works where the WebFetch fetcher is 503'd by
Indian gov geo-blocks), finds disclosure/admitted-student pages, and judges
whether a document is a name-bearing student list.

PRIVACY RULE: never prints student names. Only counts, headers, sessions, URLs.
"""
import sys, re, os, subprocess, urllib.parse, json, io, hashlib

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
CACHE = '/tmp/claude-0/-home-user-sorcery/7ee2f7b0-b391-55ed-a3c7-e6ad96b63558/scratchpad/fetchcache'
os.makedirs(CACHE, exist_ok=True)

# Link text/href patterns that indicate an NMC/MSR disclosure or admitted-list page
HOT = re.compile(r'(admitted[\s_-]*student|student[\s_-]*admitted|list[\s_-]*of[\s_-]*admitted|'
                 r'mandatory[\s_-]*disclosure|statutory[\s_-]*disclosure|msr\b|b[\.\s_-]*1[\.\s_-]*11|'
                 r'b[\s_-]*i[\s_-]*xi|student[\s_-]*information|student[\s_-]*corner|student[\s_-]*list|'
                 r'year[\s_-]*wise[\s_-]*list|ug[\s_-]*list|mbbs[\s_-]*list|batch[\s_-]*list|'
                 r'admission[\s_-]*list|merit[\s_-]*list|allot?ment[\s_-]*list|selected[\s_-]*candidate|'
                 r'college[\s_-]*information|disclosure|declaration|nmc[\s_-]*disclosure)', re.I)
WARM = re.compile(r'(admission|student|academic|mbbs|ug\b|notice|download|rti|about)', re.I)
# Header labels that mark a real name-bearing roster
NAMEHDR = re.compile(r'(name\s*of\s*(the\s*)?(student|candidate|admitted)|student\'?s?\s*name|'
                     r'candidate\'?s?\s*name|\bname\b.{0,30}\b(roll|neet|air|rank|quota|category)\b|'
                     r'\b(roll|neet|air|rank)\b.{0,30}\bname\b)', re.I)
QUOTA_AIQ = re.compile(r'(all\s*india\s*quota|\baiq\b|central\s*counsel|\bmcc\b|15\s*%)', re.I)
QUOTA_ST  = re.compile(r'(state\s*quota|85\s*%|state\s*merit)', re.I)
SESSION = re.compile(r'(20\d{2}\s*[-–/]\s*(?:20)?\d{2}|\b20\d{2}\b)')

def _cache_path(url):
    return os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())

def fetch(url, binary=False, timeout=45):
    """curl with cache. Returns (status, bytes) ; status 0 == connection failure."""
    cp = _cache_path(url)
    if os.path.exists(cp):
        meta = open(cp+'.status').read().strip() if os.path.exists(cp+'.status') else '200'
        return int(meta), open(cp,'rb').read()
    p = subprocess.run(['curl','-sSL','--max-time',str(timeout),'-A',UA,
                        '--compressed','-o',cp,'-w','%{http_code}',url],
                       capture_output=True, text=True)
    code = 0
    try: code = int((p.stdout or '0').strip()[-3:])
    except Exception: code = 0
    open(cp+'.status','w').write(str(code))
    data = open(cp,'rb').read() if os.path.exists(cp) else b''
    return code, data

def text_of(data, url=''):
    """Extract plain text from HTML or PDF bytes."""
    if data[:5] == b'%PDF-' or url.lower().endswith('.pdf'):
        try:
            from pdfminer.high_level import extract_text
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(data); tmp = f.name
            t = extract_text(tmp) or ''
            os.unlink(tmp)
            if len(t.strip()) < 40:
                return '', 'pdf-image-or-empty'
            return t, 'pdf'
        except Exception as e:
            return '', f'pdf-error:{type(e).__name__}'
    h = data.decode('utf8','ignore')
    h = re.sub(r'(?is)<(script|style|noscript).*?</\1>', ' ', h)
    h = re.sub(r'(?is)<br\s*/?>|</(tr|p|div|li|h[1-6])>', '\n', h)
    h = re.sub(r'(?is)</t[dh]>', ' | ', h)
    h = re.sub(r'(?s)<[^>]+>', ' ', h)
    import html as H
    return H.unescape(h), 'html'

def links(data, base):
    """All (href, text) pairs, absolutised."""
    h = data.decode('utf8','ignore')
    out = []
    for m in re.finditer(r'<a\b[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', h, re.S|re.I):
        href = m.group(1).strip()
        if href.startswith(('#','javascript:','mailto:','tel:')): continue
        txt = re.sub(r'<[^>]+>',' ', m.group(2))
        import html as H
        txt = re.sub(r'\s+',' ', H.unescape(txt)).strip()
        out.append((urllib.parse.urljoin(base, href), txt))
    # also catch <option value="url"> and iframe/embed src
    for m in re.finditer(r'<(?:iframe|embed)\b[^>]*src\s*=\s*["\']([^"\']+\.pdf[^"\']*)["\']', h, re.I):
        out.append((urllib.parse.urljoin(base, m.group(1)), '[embedded pdf]'))
    return out

def judge_doc(url):
    """Is this doc a name-bearing student roster? Returns dict, no names."""
    code, data = fetch(url)
    if code == 0:   return {'url':url,'status':'UNREACHABLE(conn-reset)'}
    if code >= 400: return {'url':url,'status':f'HTTP {code}'}
    t, kind = text_of(data, url)
    if not t:
        return {'url':url,'status':f'no-text ({kind})','bytes':len(data)}
    hdr = NAMEHDR.search(t)
    lines = [l for l in (x.strip() for x in t.splitlines()) if l]
    # roster row estimate: HTML -> table rows; PDF/text -> lines that look like "<n> Name Name"
    rows = 0
    if kind == 'html':
        raw = data.decode('utf8','ignore')
        rows = max(0, len(re.findall(r'<tr\b', raw, re.I)) - 1)
        if rows == 0:
            rows = sum(1 for l in lines
                       if re.search(r'\d', l) and len(re.findall(r'\b[A-Z][A-Za-z]{2,}\b', l)) >= 2)
    else:
        for l in lines:
            if len(re.findall(r'\b[A-Z][A-Za-z]{2,}\b', l)) >= 2 and len(l) < 200:
                rows += 1
    sess = sorted(set(SESSION.findall(t.replace('\n',' '))))[:14]
    sess = [s if isinstance(s,str) else s[0] for s in sess]
    return {'url':url,'status':'OK','kind':kind,'bytes':len(data),
            'name_header': bool(hdr), 'name_header_text': (hdr.group(0)[:60] if hdr else ''),
            'roster_rows_est': rows,
            'mentions_AIQ': bool(QUOTA_AIQ.search(t)), 'mentions_state_quota': bool(QUOTA_ST.search(t)),
            'sessions_seen': sess,
            'verdict_hint': 'NAME-LIST' if (hdr and rows>=5) else ('MAYBE' if (hdr or rows>=15) else 'no-roster')}

def scan_site(base):
    code, data = fetch(base)
    if code == 0:
        print(f"UNREACHABLE (TLS/conn reset from this egress): {base}"); return
    if code >= 400:
        print(f"HTTP {code}: {base}"); return
    ls = links(data, base)
    print(f"OK {code}  {base}   ({len(ls)} links, {len(data)} bytes)")
    body,_ = text_of(data, base)
    if len(body.strip()) < 300:
        print("  !! near-empty render -> likely JS SPA; needs headless browser (PROVISIONAL)")
    hot  = [(u,t) for u,t in ls if HOT.search(t) or HOT.search(urllib.parse.unquote(u))]
    seen=set(); hot=[x for x in hot if not (x[0] in seen or seen.add(x[0]))]
    if hot:
        print("  HOT links:")
        for u,t in hot[:40]: print(f"    - [{t[:58]}] {u[:120]}")
    else:
        warm=[(u,t) for u,t in ls if WARM.search(t)][:18]
        print("  no HOT links. WARM:")
        for u,t in warm: print(f"    ~ [{t[:48]}] {u[:100]}")

if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='site': scan_site(sys.argv[2])
    elif cmd=='doc':
        for u in sys.argv[2:]: print(json.dumps(judge_doc(u), ensure_ascii=False))
    elif cmd=='page':
        base=sys.argv[2]; code,data=fetch(base)
        print(f"HTTP {code} {base}")
        if data:
            for u,t in links(data,base):
                if re.search(r'\.(pdf|xlsx?|docx?)($|\?)',u,re.I) or HOT.search(t) or HOT.search(urllib.parse.unquote(u)):
                    print(f"    - [{t[:58]}] {u[:130]}")
    elif cmd=='reach':
        for u in sys.argv[2:]:
            c,_=fetch(u if u.startswith('http') else 'https://'+u)
            print(f"{'OK  ' if c==200 else ('DEAD' if c==0 else str(c))}  {u}")

# ---- free domain resolution via Wikipedia API (reachable; no LLM tokens) ----
def wiki_site(name):
    import json as J
    q = urllib.parse.quote(name)
    c,d = fetch(f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json&srlimit=3")
    if c!=200: return None,[]
    try: hits=[h['title'] for h in J.loads(d)['query']['search']]
    except Exception: return None,[]
    for title in hits:
        c2,d2 = fetch("https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content"
                      f"&rvslots=main&format=json&titles={urllib.parse.quote(title)}")
        if c2!=200: continue
        try:
            pages=J.loads(d2)['query']['pages']
            txt=list(pages.values())[0]['revisions'][0]['slots']['main']['*']
        except Exception: continue
        m=re.search(r'\|\s*website\s*=\s*(.+)', txt)
        if m:
            raw=m.group(1)
            u=re.search(r'https?://[^\s\}\|\]]+', raw)
            if u: return u.group(0).rstrip('/'), hits
            u=re.search(r'\{\{URL\|([^\}\|]+)', raw)
            if u:
                v=u.group(1).strip()
                return ('https://'+v.lstrip('/')) if not v.startswith('http') else v, hits
    return None, hits
