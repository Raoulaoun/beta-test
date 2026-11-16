const { chromium } = require('playwright');
const fs = require('fs');
const [base, framesFile, outDir] = process.argv.slice(2);
const frames = JSON.parse(fs.readFileSync(framesFile, 'utf8'));
(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const [name, page, q, w, h] of frames) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h || 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [], failed = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    p.on('requestfailed', r => failed.push(r.url().slice(0, 120)));
    await p.goto(`${base}/${page}/index.html${q ? '?' + q : ''}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: !h });
    const text = (await p.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 110);
    report.push({ name, errs, failed, text });
    await ctx.close();
  }
  await browser.close();
  for (const r of report) console.log(`${r.name} | errors:${r.errs.length} failed:${r.failed.length} | ${r.text}` + (r.errs.length ? `\n    ${r.errs.slice(0,2).join(' || ')}` : '') + (r.failed.length ? `\n    FAILED ${r.failed.slice(0,2).join(' ')}` : ''));
})();
