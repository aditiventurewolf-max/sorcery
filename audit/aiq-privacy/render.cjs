// Render a JS page (SPA / Scribd) and emit links + a privacy-safe roster assessment.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const url = process.argv[2];
  const mode = process.argv[3] || 'links';
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const b = await chromium.launch({ args:['--no-sandbox','--disable-dev-shm-usage'],
    ...(proxy ? { proxy: { server: proxy } } : {}) });
  const ctx = await b.newContext({
    userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    viewport:{width:1366,height:900}, locale:'en-IN', ignoreHTTPSErrors:true
  });
  const p = await ctx.newPage();
  let status = 0;
  try {
    const r = await p.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    status = r ? r.status() : 0;
    await p.waitForTimeout(mode==='doc' ? 9000 : 5000);
  } catch (e) { console.log(JSON.stringify({url, error:String(e).slice(0,140)})); await b.close(); return; }
  const title = await p.title().catch(()=> '');
  if (mode === 'links') {
    const links = await p.$$eval('a[href]', as => as.map(a => ({t:(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,70), u:a.href})));
    const seen = new Set(); const out = [];
    for (const l of links) { if (!seen.has(l.u)) { seen.add(l.u); out.push(l); } }
    console.log(JSON.stringify({url, status, title:title.slice(0,120), n:out.length, links:out.slice(0,300)}));
  } else {
    const txt = await p.evaluate(()=>document.body ? document.body.innerText : '');
    const lines = txt.split('\n').map(s=>s.trim()).filter(Boolean);
    const NAMEHDR = /(name\s*of\s*(the\s*)?(student|candidate|admitted)|student'?s?\s*name|candidate'?s?\s*name)/i;
    const hdr = lines.find(l => NAMEHDR.test(l) && l.length < 160) || '';
    let rows = 0;
    for (const l of lines) { if (/^\d{1,4}\b/.test(l) && (l.match(/\b[A-Z][A-Za-z]{2,}\b/g)||[]).length >= 2 && l.length < 200) rows++; }
    const inst = lines.slice(0,40).filter(l=>/(medical college|institute of medical|government|hospital|university|counsel)/i.test(l)).slice(0,4);
    const yrs = [...new Set((txt.match(/20\d{2}\s*[-–\/]\s*(?:20)?\d{2}|\b20\d{2}\b/g)||[]))].slice(0,10);
    console.log(JSON.stringify({url, status, title:title.slice(0,140), name_header:hdr.slice(0,90),
      roster_rows_est:rows, institution_lines:inst, years:yrs, chars:txt.length,
      mentions_AIQ:/all\s*india\s*quota|\baiq\b|\bmcc\b/i.test(txt), mentions_state_quota:/state\s*quota|85\s*%/i.test(txt)}));
  }
  await b.close();
})();
