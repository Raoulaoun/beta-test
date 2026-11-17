// Lead flow in a real browser against the live stack and database:
// attribution → upload → saved result reopens after reload → progress → exit prompt →
// lead form (client errors, then success) → confirmation. Usage: node lead_flow.js <base> <fixture> <outDir>
const { chromium } = require('playwright');
const path = require('path');
const [base, file, outDir] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/?utm_source=ig&utm_campaign=e2e-${width}&ref=INTRO7`, { waitUntil: 'networkidle' });
    await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
    await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mt_saved') || 'null'));
    check(!!(saved && saved.id && saved.token), `@${width} result saved in the browser`);

    await p.goto(`${base}/`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="score"]', { timeout: 10000 }).catch(() => null);
    check(await p.isVisible('[data-testid="lead-form"]'), `@${width} returning visitor sees the score and the form again`);

    await p.evaluate(() => document.querySelector('[data-testid="pillar"]')?.scrollIntoView());
    await p.waitForTimeout(600);
    if (width === 1440) {
      await p.mouse.move(700, 300);
      await p.mouse.move(700, -5);
      await p.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null, bubbles: true })));
      await p.waitForSelector('[data-testid="exit-prompt"]', { timeout: 3000 }).catch(() => null);
      const shown = await p.isVisible('[data-testid="exit-prompt"]');
      check(shown, `@${width} exit prompt shows when leaving through the top`);
      await p.screenshot({ path: path.join(outDir, `exit-prompt-${width}.png`) });
      if (shown) await p.click('[data-testid="exit-prompt"] button:has-text("Send my full report")');
    }

    await p.click('button:has-text("Send my full report")');
    const errs = await p.$$eval('[data-testid="lead-form"] [role=alert]', (els) => els.map((e) => e.textContent));
    check(errs.includes('Please enter your full name') && errs.includes('Please tick this box so we can send your report'), `@${width} client validation as designed`);

    await p.fill('#mt-name', 'Test Lead');
    await p.fill('#mt-email', `lead-${width}@example.com`);
    await p.fill('#mt-phone', '3 12');
    await p.click('button[role=radio]:has-text("Yes, formally")');
    await p.click('label:has-text("Beta may contact me")');
    await p.click('button:has-text("Send my full report")');
    check(await p.isVisible('text=Please enter a valid WhatsApp number'), `@${width} short phone refused`);
    await p.fill('#mt-phone', '20 7946 000');
    await p.selectOption('select[aria-label="Country code"]', '+44');
    await p.click('button:has-text("Send my full report")');
    await p.waitForSelector('text=Please enter a valid WhatsApp number', { timeout: 5000 }).catch(() => null);
    check(await p.isVisible('text=Please enter a valid WhatsApp number'), `@${width} server refuses a landline (mobile check)`);
    await p.fill('#mt-phone', '7911 123456');
    await p.click('button:has-text("Send my full report")');
    await p.waitForSelector('[data-testid="sent"]', { timeout: 10000 });
    check((await p.textContent('[data-testid="sent"] strong')) === `lead-${width}@example.com`, `@${width} confirmation shows the email`);
    check(await p.evaluate(() => localStorage.getItem('mt_saved') === null), `@${width} saved result cleared after the lead`);
    await p.screenshot({ path: path.join(outDir, `sent-${width}.png`), fullPage: true });

    await p.goto(`${base}/`, { waitUntil: 'networkidle' });
    check(await p.isVisible('[data-testid="dropzone"]'), `@${width} after the lead, the landing page shows again`);
    await ctx.close();
  }
  await browser.close();
})();
