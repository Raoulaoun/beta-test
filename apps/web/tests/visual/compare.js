// Renders each built screen with the design's URL parameters (dev preview) and saves it
// next to the matching design screenshot. Usage: node compare.js <baseUrl> <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base, outDir] = process.argv.slice(2);
const frames = JSON.parse(fs.readFileSync(path.join(__dirname, 'frames.json'), 'utf8'));
(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, q, w, h] of frames) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h || 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${base}/?${q}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1200);
    // Hide the Next dev-tools badge: it is not part of the product.
    await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await p.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: !h });
    if (errors.length) console.log(name, 'page errors:', errors);
    await ctx.close();
  }
  await browser.close();
  console.log('rendered', frames.length);
})();
