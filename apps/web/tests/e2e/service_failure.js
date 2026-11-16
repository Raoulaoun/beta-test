// With the scoring service stopped, a valid statement must show "Server error" and never a
// message about the file. Usage: node service_failure.js <base> <file> <outDir>
const { chromium } = require('playwright');
const path = require('path');
const [base, file, outDir] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const width of [390, 1440]) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
    await p.waitForSelector('[data-testid="error"]', { timeout: 30000 });
    const got = await p.evaluate(() => ({
      err: document.querySelector('[data-testid="error"]').getAttribute('data-err'),
      title: document.querySelector('[data-testid="error"] h1').textContent,
      exportLink: !!document.querySelector('[data-testid="error"] a[href="#export"]'),
      text: document.querySelector('[data-testid="error"]').innerText,
    }));
    const blames = /MT4|MT5 statement|no trades|over 10 MB|export/i.test(got.text);
    const ok = got.err === 'server' && got.title === 'Server error' && !got.exportLink && !blames;
    failed += ok ? 0 : 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} scoring down @${width} | ${got.err} | "${got.title}" | export link: ${got.exportLink}`);
    await p.screenshot({ path: path.join(outDir, `server-error-${width}.png`), fullPage: true });
    await p.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
