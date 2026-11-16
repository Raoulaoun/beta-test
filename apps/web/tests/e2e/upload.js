// End-to-end: upload each fixture through the real page and API, wait for the final
// screen, check it, and screenshot at 390 and 1440. Usage: node upload.js <base> <fixtures> <out>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base, fixtures, outDir] = process.argv.slice(2);

const CASES = [
  ['disciplined.xlsx', { screen: 'results', minScore: 75, flags: 'none', chip: 'Live account' }],
  ['disciplined.html', { screen: 'results', minScore: 75, flags: 'none' }],
  ['demo.xlsx', { screen: 'results', chip: 'Demo account' }],
  ['martingale.xlsx', { screen: 'results', maxScore: 40, summary: '2 red flags found. Your score is capped at 40.', flagCodes: ['martingale', 'no_stops'] }],
  ['blown.xlsx', { screen: 'results', maxScore: 30, flagCodes: ['blown_account'] }],
  ['losses-held-open.xlsx', { screen: 'results', flagCodes: ['losses_held_open'] }],
  ['short-history.xlsx', { screen: 'results', comeBack: 'Not enough history yet. Come back on 1 December 2026 for your score.' }],
  ['statement.htm', { screen: 'error', err: 'mt4' }],
  ['ReportHistory-MT4.htm', { screen: 'error', err: 'mt4' }],
  ['notes.xlsx', { screen: 'error', err: 'notstatement' }],
  ['photo.png', { screen: 'error', err: 'notstatement' }],
  ['empty.xlsx', { screen: 'error', err: 'empty' }],
  ['empty-report.xlsx', { screen: 'error', err: 'empty' }],
  ['big.xlsx', { screen: 'error', err: 'toolarge' }],
];

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(outDir, { recursive: true });
  let failures = 0;
  for (const [file, expect] of CASES) {
    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      const t0 = Date.now();
      await p.goto(base + '/', { waitUntil: 'networkidle' });
      await p.setInputFiles('[data-testid="dropzone"] input[type=file]', path.join(fixtures, file));
      await p.waitForSelector(expect.screen === 'error' ? '[data-testid="error"]' : '[data-testid="score"], [data-testid="come-back"]', { timeout: 30000 });
      const ms = Date.now() - t0;
      await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1000);
      const got = await p.evaluate(() => ({
        score: document.querySelector('[data-testid="score"]')?.textContent,
        band: document.querySelector('[data-testid="band"]')?.textContent,
        err: document.querySelector('[data-testid="error"]')?.getAttribute('data-err'),
        none: !!document.querySelector('[data-testid="flags-none"]'),
        summary: document.querySelector('[data-testid="flags-summary"]')?.textContent || null,
        flags: [...document.querySelectorAll('[data-flag]')].map((e) => e.getAttribute('data-flag')),
        comeBack: document.querySelector('[data-testid="come-back"]')?.textContent || null,
        insight: document.querySelector('[data-testid="insight"]')?.textContent || null,
        text: document.body.innerText,
      }));
      const problems = [];
      if (expect.err && got.err !== expect.err) problems.push(`err ${got.err}`);
      if (expect.minScore && !(Number(got.score) >= expect.minScore)) problems.push(`score ${got.score}`);
      if (expect.maxScore && !(Number(got.score) <= expect.maxScore)) problems.push(`score ${got.score}`);
      if (expect.flags === 'none' && !got.none) problems.push('expected no flags');
      if (expect.summary && got.summary !== expect.summary) problems.push(`summary ${got.summary}`);
      if (expect.flagCodes && JSON.stringify(got.flags) !== JSON.stringify(expect.flagCodes)) problems.push(`flags ${got.flags}`);
      if (expect.chip && !got.text.includes(expect.chip)) problems.push(`chip ${expect.chip} missing`);
      if (expect.comeBack && got.comeBack !== expect.comeBack) problems.push(`comeBack ${got.comeBack}`);
      if (/51234567/.test(got.text)) problems.push('ACCOUNT NUMBER ON PAGE');
      if (!got.text.includes('is not an assessment for admission to the Beta platform')) problems.push('disclaimer missing');
      failures += problems.length ? 1 : 0;
      const name = `${file.replace(/\W+/g, '-')}-${width}`;
      await p.screenshot({ path: path.join(outDir, name + '.png'), fullPage: true });
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${file} @${width} ${ms}ms | ${got.err ? 'error:' + got.err : `${got.score ?? '—'} ${got.band ?? ''}`} | ${got.summary || (got.none ? 'no flags' : got.flags.join(',') || '')} | ${got.insight || got.comeBack || ''}${problems.length ? ' | ' + problems.join('; ') : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
