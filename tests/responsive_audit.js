// Responsive audit: every page must fit the screen with no sideways scroll.
// Usage (dev server on :5179): WIDTH=360 node tests/responsive_audit.js
const { chromium } = require('playwright');
const TABS = "summary homebeta showcase arcs everything title runsvolumes absbatman actionplan boxkeys boxlabels boxmap boxquest boxvisual calendar capfalcon cgc collection conditionentry covercatalog coverreview credits datafix dataview dupchecklist duplicates ebaylistingguide ebaypipeline editcomic eraaudit granov history hunting keycatalog lifearchive locationcheck unknownboxes missingcovers nycc opsreference orgpath pulllist recent releasetimeline roulette runs showplanner signings sitemap slabbed stats storepreview timeline titlefixes volumeconfirm volumes sellerdash".split(" ");
(async () => {
  const W = +(process.env.WIDTH || 360); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: 780 }, isMobile: true, hasTouch: true });
  await p.addInitScript(() => sessionStorage.setItem('mc_auth','1'));
  await p.goto(process.env.URL || 'http://localhost:5179/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const res = [];
  for (const t of TABS) {
    const errs = []; const h = e => errs.push(e.message); p.on('pageerror', h);
    await p.evaluate(tab => window.dispatchEvent(new CustomEvent('brb:navigate', { detail: { tab } })), t);
    await p.waitForTimeout(1800);
    const r = await p.evaluate(() => {
      const W = window.innerWidth, sw = document.documentElement.scrollWidth;
      const scrollable = el => { for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && a !== document.body && a !== document.documentElement) return true; } return false; };
      const off = [];
      for (const el of document.querySelectorAll('body *')) {
        const rc = el.getBoundingClientRect(); if (rc.width === 0 || rc.right <= W + 1) continue;
        if (scrollable(el)) continue;
        const kids = [...el.children].some(k => k.getBoundingClientRect().right > W + 1);
        if (kids) continue;     // report the deepest offender only
        off.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''} w=${Math.round(rc.width)} r=${Math.round(rc.right)} "${(el.innerText||'').replace(/\s+/g,' ').slice(0,40)}"`);
      }
      return { sw, W, off: [...new Set(off)].slice(0, 6) };
    });
    p.off('pageerror', h);
    res.push({ t, ...r, errs: errs.slice(0, 1) });
    console.log(`${r.sw > r.W + 1 ? 'OVERFLOW' : 'ok      '} ${t.padEnd(18)} ${r.sw}/${r.W}${errs.length ? '  ERR ' + errs[0].slice(0,80) : ''}`);
    if (r.sw > r.W + 1) r.off.forEach(o => console.log('      ' + o));
  }
  const bad = res.filter(r => r.sw > r.W + 1); console.log(bad.length ? 'FAIL: ' + bad.length + ' page(s) scroll sideways at ' + W + 'px' : 'PASS: all ' + res.length + ' pages fit ' + W + 'px'); process.exitCode = bad.length ? 1 : 0;
  await b.close();
})();
