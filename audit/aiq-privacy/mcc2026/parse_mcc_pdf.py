import re, json, collections
START = re.compile(r'^(\d+)\s+(\d+)\s+')
SKIP  = re.compile(r'^(Provisional NEET|SNo\b|Rank\b|Allotted\b|Category\b|Candidate\b|Remarks\b|Page No\.|Note\*)')
recs=[]; cur=None
for raw in open('mcc_r1_2026.txt'):
    line=raw.strip()
    if not line or SKIP.match(line):
        continue
    if START.match(line):
        if cur: recs.append(cur)
        cur=line
    elif cur:
        cur += ' ' + line
if cur: recs.append(cur)
print('records', len(recs))

COURSE = r'(MBBS|BDS|B\.Sc\.? Nursing)'
CCAT = r'(General|OBC|SC|ST|EWS|General PwD|OBC PwD|SC PwD|ST PwD|EWS PwD|Gen PwD)'
pat = re.compile(r'^(\d+)\s+(\d+)\s+(.+?)\s+'+COURSE+r'\s+(.+?)\s+'+CCAT+r'\s+(Allotted|Fresh Allotted|Upgraded|.*Allotted.*)$')
rows=[]; unp=[]
for r in recs:
    r=re.sub(r'\s+',' ',r)
    m=pat.match(r)
    if m:
        sno,rank,inst,course,acat,ccat,rem=m.groups()
        rows.append({'rank':int(rank),'inst':inst,'course':course,'acat':acat,'ccat':ccat,'rem':rem})
    else:
        unp.append(r)
print('parsed',len(rows),'unparsed',len(unp))
for u in unp[:5]: print('UNP',u[:200])
json.dump(rows, open('rows.json','w'))
print('--- quota prefixes:')
c=collections.Counter(r['inst'].split(' ')[0:3] and ' '.join(r['inst'].split(' ')[:3]) for r in rows)
for k,v in c.most_common(12): print(v,'|',k)
