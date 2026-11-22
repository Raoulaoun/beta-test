// "Get my full report" (under the score; sticky bar on phones) and the signed-out banner,
// in a real browser against the live stack and database. Screenshots at 390 and 1440.
// Usage: node results_cta.js <base> <fixture> <outDir> <databaseUrl>
const { chromium, devices } = require('playwright');
const path = require('path');
const { Client } = require('pg');
const [base, file, outDir, dbUrl] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const STANDIN = `window.turnstile={render(el,o){setTimeout(()=>o.callback('t'),20);return 'w'},remove(){},reset(){}}`;

async function context(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/turnstile/v0/api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: STANDIN }));
  return ctx;
}
async function upload(p) {
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
  return p.evaluate(() => JSON.parse(localStorage.getItem('mt_saved')));
}
async function sources(db, id) {
  return (await db.query("select source from funnel_events where kind = 'form_opened' and result_id = $1", [id])).rows.map((r) => r.source);
}

(async () => {
  const browser = await chromium.launch();
  const db = new Client({ connectionString: dbUrl }); await db.connect();

  // ---------- desktop: button under the score ----------
  {
    const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const saved = await upload(p);
    const btn = await p.$('[data-testid="full-report-cta"]');
    check(!!btn && (await btn.textContent()) === 'Get my full report', 'desktop: "Get my full report" under the score card');
    const [card, b] = await Promise.all([p.$eval('[data-testid="score"]', (e) => e.closest('.mt-a-score').firstElementChild.getBoundingClientRect().bottom), btn.boundingBox()]);
    check(b.y > card && b.y - card < 40, 'directly under the score card');
    check(!(await p.isVisible('[data-testid="sticky-cta"] button')), 'desktop: no sticky bar');
    await p.screenshot({ path: path.join(outDir, 'cta-desktop-1440.png') });
    await btn.click();
    await p.waitForSelector('[data-testid="form-modal"]');
    check(true, 'the button opens the form modal');
    await p.keyboard.press('Escape');
    await p.waitForSelector('[data-testid="form-modal"]', { state: 'detached' });
    check(await p.evaluate(() => document.activeElement?.dataset.testid === 'full-report-cta'), 'focus returns to the button');
    await p.waitForTimeout(400);
    check(JSON.stringify(await sources(db, saved.id)) === '["results_button"]', 'form_opened logged with source results_button');
    await ctx.close();
  }

  // ---------- phone: button under the score + sticky bar ----------
  {
    const ctx = await context(browser, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const saved = await upload(p);
    const shown = () => p.$eval('[data-testid="sticky-cta"]', (e) => e.dataset.show === 'true' && e.getBoundingClientRect().top < innerHeight - 10);
    check(await p.isVisible('[data-testid="full-report-cta"]'), 'phone: button under the score card');
    await p.waitForTimeout(300);
    check(!(await shown()), 'sticky bar hidden while the button is on screen');
    await p.screenshot({ path: path.join(outDir, 'cta-phone-390.png') });
    await p.evaluate(() => document.querySelector('[data-testid="report"], #report').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(500);
    check(!(await shown()), 'sticky bar hidden while the inline form is on screen');
    await p.evaluate(() => document.querySelector('[data-testid="flags"], [data-testid="flags-none"]').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(500);
    check(await shown(), 'sticky bar shows once the button and the form are off screen');
    await p.screenshot({ path: path.join(outDir, 'cta-phone-390-sticky.png') });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(500);
    const covered = await p.evaluate(() => {
      const bar = document.querySelector('[data-testid="sticky-cta"]').getBoundingClientRect();
      const foot = [...document.querySelectorAll('footer *')].filter((e) => e.children.length === 0 && e.textContent.trim()).pop();
      return foot ? foot.getBoundingClientRect().bottom > bar.top : false;
    });
    check(!covered, 'at the bottom, the bar does not cover the footer');
    await p.tap('[data-testid="sticky-cta"] button');
    await p.waitForSelector('[data-testid="form-modal"]');
    check(true, 'the sticky bar opens the form sheet');
    await p.waitForTimeout(400);
    check(JSON.stringify(await sources(db, saved.id)) === '["results_button"]', 'form_opened logged with source results_button');
    await ctx.close();
  }

  // ---------- signed-out banner ----------
  for (const width of [1440, 390]) {
    const email = `known-${width}-${Date.now()}@example.com`;
    const ctx = await context(browser, width === 390 ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } : { viewport: { width, height: 900 } });
    const p = await ctx.newPage();
    await upload(p);
    check(!(await p.isVisible('[data-testid="signed-out-banner"]')), `@${width} unknown browser: no banner`);
    await p.click('[data-testid="full-report-cta"]');
    await p.fill('#mt-m-name', 'Known Trader'); await p.fill('#mt-m-email', email); await p.fill('#mt-m-phone', '3 123 456');
    await p.click('[data-testid="form-modal"] button[role=radio]:has-text("No")');
    await p.click('[data-testid="form-modal"] label:has-text("Beta may contact me")');
    await p.click('[data-testid="form-modal"] button:has-text("Send my full report")');
    await p.waitForSelector('[data-testid="sent"]', { timeout: 10000 });
    const cookie = (await ctx.cookies()).find((c) => c.name === 'mt_known');
    check(cookie && cookie.httpOnly && !cookie.value.includes('@'), `@${width} account created: known-device cookie, httpOnly, no email in it`);

    check(await p.evaluate(async () => (await (await fetch('/api/me')).json()).signed_in), `@${width} sending the form signed this browser in`);
    await ctx.clearCookies({ name: 'mt_session' }); // signed out again (another day, or signed out)
    const saved = await upload(p);
    await p.waitForSelector('[data-testid="signed-out-banner"]', { timeout: 5000 }).catch(() => null);
    const text = await p.textContent('[data-testid="signed-out-banner"]').catch(() => '');
    check(text.includes('You already have a Manager Test account. Sign in to save this result to your history.') && text.includes('Send me a sign-in link'),
      `@${width} same browser, signed out: the banner, word for word`);
    await p.screenshot({ path: path.join(outDir, `banner-${width}.png`) });
    await p.click('[data-testid="signed-out-banner"] button');
    await p.waitForSelector('[data-testid="signin-sent"]', { timeout: 5000 });
    const mail = (await (await p.request.get(base + '/api/dev/outbox')).json()).reverse().find((m) => m.to === email);
    check(!!mail && mail.kind === 'sign_in', `@${width} sign-in link sent to the account's email`);
    await p.screenshot({ path: path.join(outDir, `banner-${width}-sent.png`) });
    const link = /https?:\/\/\S+token=[\w-]+/.exec(mail.text)[0].replace(/^https?:\/\/[^/]+/, base);
    await p.goto(link, { waitUntil: 'networkidle' });
    const { rows } = await db.query('select r.account_id, a.email from results r left join accounts a on a.id = r.account_id where r.id = $1', [saved.id]);
    check(rows[0]?.email === email, `@${width} after signing in, this result is in the account's history`);
    await ctx.close();
  }

  await db.end();
  await browser.close();
})();
