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
  ['short-history.xlsx', { screen: 'results', label: 'Early score', maxScore: 69, earlyLine: /^Early score, based on \d+ trades over 2 months\. Upload more history for your full score\.$/, progress: true, noNudge: true }],
  ['early-nudge.xlsx', { screen: 'results', label: 'Early score', exactScore: 69, nudge: 'Your file only covers 3 weeks. Did you choose All History? Export again for a more accurate score.See the export guide', progress: true }],
  ['starter.xlsx', { screen: 'starter', starterMetrics: 3, nudge: true }], // design: no progress bars on the starter read
  ['mt4-statement.htm', { screen: 'results', minScore: 75, flags: 'none' }],
  ['mt4-detailed.htm', { screen: 'results', maxScore: 40, flagCodes: ['martingale', 'no_stops'] }],
  ['mt4-no-trades.htm', { screen: 'error', err: 'empty' }],
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
      await p.waitForSelector(expect.screen === 'error' ? '[data-testid="error"]' : '[data-testid="score"], [data-testid="starter-heading"]', { timeout: 30000 });
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
        label: document.querySelector('[data-testid="score-label"]')?.textContent || null,
        earlyLine: document.querySelector('[data-testid="early-line"]')?.textContent || null,
        nudge: document.querySelector('[data-testid="nudge"]')?.textContent || null,
        progress: !!document.querySelector('[data-testid="progress"]'),
        starter: document.querySelector('[data-testid="starter-heading"]')?.textContent || null,
        starterMetrics: document.querySelectorAll('[data-testid="starter-metric"]').length,
        retest: [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Remind me to retest in 60 days.'))?.querySelector('input')?.checked ?? null,
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
      if (expect.label && got.label !== expect.label) problems.push(`label ${got.label}`);
      if (expect.exactScore && Number(got.score) !== expect.exactScore) problems.push(`score ${got.score}`);
      if (expect.earlyLine && !expect.earlyLine.test(got.earlyLine || '')) problems.push(`earlyLine ${got.earlyLine}`);
      if (typeof expect.nudge === 'string' && got.nudge !== expect.nudge) problems.push(`nudge ${got.nudge}`);
      if (expect.nudge === true && !got.nudge) problems.push('nudge missing');
      if (expect.noNudge && got.nudge) problems.push('unexpected nudge');
      if (expect.progress && !got.progress) problems.push('progress bars missing');
      if (expect.screen === 'starter' && (got.starter !== 'Your starter read' || got.score)) problems.push(`starter ${got.starter} score ${got.score}`);
      if (expect.starterMetrics && got.starterMetrics !== expect.starterMetrics) problems.push(`starter metrics ${got.starterMetrics}`);
      if (expect.screen !== 'error') {
        const wantRetest = !!(expect.label || expect.screen === 'starter');
        if (got.retest !== wantRetest) problems.push(`retest box ${got.retest}, expected ${wantRetest}`);
      }
      if (/51234567/.test(got.text)) problems.push('ACCOUNT NUMBER ON PAGE');
      if (!got.text.includes('is not an assessment for admission to the Beta platform')) problems.push('disclaimer missing');
      failures += problems.length ? 1 : 0;
      const name = `${file.replace(/\W+/g, '-')}-${width}`;
      await p.screenshot({ path: path.join(outDir, name + '.png'), fullPage: true });
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${file} @${width} ${ms}ms | ${got.err ? 'error:' + got.err : `${got.score ?? '—'} ${got.band ?? ''}`} | ${got.summary || (got.none ? 'no flags' : got.flags.join(',') || '')} | ${got.insight || got.starter || ''}${got.nudge ? ' | nudge' : ''}${problems.length ? ' | ' + problems.join('; ') : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'all passed');
  process.exit(failures ? 1 : 0);
})();
