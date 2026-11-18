// Lead form in a modal, in a real browser against the live stack and database.
// Desktop 1440: exit prompt → modal, shared state both ways, focus in / trapped / back,
// Esc, X and outside click, Turnstile in the modal, form_opened with its source.
// Phone 390 (touch emulation): full-height bottom sheet, fields above the keyboard.
// Turnstile: Cloudflare is not reachable here, so its script is replaced by a stand-in
// with the same API (render → callback(token), remove). Needs a build with
// NEXT_PUBLIC_TURNSTILE_SITE_KEY set. Usage: node modal_flow.js <base> <fixture> <outDir> <databaseUrl>
const { chromium, devices } = require('playwright');
const path = require('path');
const { Client } = require('pg');
const [base, file, outDir, dbUrl] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

const TURNSTILE_STANDIN = `(function(){var n=0;window.__ts={};window.turnstile={
  render:function(el,o){var id='w'+(++n);var d=document.createElement('div');d.setAttribute('data-ts-widget',id);el.appendChild(d);
    window.__ts[id]=el;setTimeout(function(){o.callback('token-'+id)},30);return id;},
  remove:function(id){var el=window.__ts[id];if(el){var d=el.querySelector('[data-ts-widget="'+id+'"]');if(d)d.remove();}delete window.__ts[id];},
  reset:function(){}};})();`;

async function context(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/turnstile/v0/api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: TURNSTILE_STANDIN }));
  return ctx;
}

async function toResults(p) {
  await p.goto(`${base}/?utm_campaign=modal-e2e`, { waitUntil: 'networkidle' });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
}

async function exitThenForm(p) {
  await p.mouse.move(700, 300);
  await p.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null, bubbles: true })));
  await p.waitForSelector('[data-testid="exit-prompt"]', { timeout: 3000 });
  await p.click('[data-testid="exit-prompt"] button:has-text("Send my full report")');
  await p.waitForSelector('[data-testid="form-modal"]', { timeout: 3000 });
}

const inDialog = (p) => p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));

(async () => {
  const browser = await chromium.launch();

  // ---------- desktop: the real flow ----------
  {
    const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await toResults(p);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mt_saved')));
    check(await p.isVisible('[data-testid="lead-form"]'), 'desktop: the inline form stays beside the score');
    await p.fill('#mt-name', 'Karim Haddad');
    await p.click('[data-testid="lead-form"] button[role=radio]:has-text("Yes, formally")');
    check(await p.evaluate(() => document.activeElement?.textContent === 'Yes, formally'), 'opener focused before the exit prompt');

    await exitThenForm(p);
    const dlg = await p.$('[data-testid="form-modal"] [role=dialog]');
    check((await dlg.getAttribute('aria-modal')) === 'true', 'dialog has aria-modal="true"');
    const title = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); return document.getElementById(d.getAttribute('aria-labelledby'))?.textContent; });
    check(title === 'Get your full report and improvement plan', `dialog is titled by its heading ("${title}")`);
    check(await p.evaluate(() => document.activeElement?.id === 'mt-m-name'), 'focus moves to the first field');
    check((await p.inputValue('#mt-m-name')) === 'Karim Haddad', 'name typed inline shows in the modal');
    check((await p.getAttribute('[data-testid="form-modal"] button[role=radio]:has-text("Yes, formally")', 'aria-checked')) === 'true', 'choice made inline shows in the modal');
    check(!(await p.isVisible('[data-testid="exit-prompt"]')), 'the exit prompt gives way to the form');

    let trapped = true;
    for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); trapped = trapped && await inDialog(p); }
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Shift+Tab'); trapped = trapped && await inDialog(p); }
    check(trapped, 'Tab and Shift+Tab stay inside the dialog (33 presses)');

    await p.waitForTimeout(200);
    const ts = await p.evaluate(() => [...document.querySelectorAll('[data-ts-widget]')].map((w) => !!w.closest('[role=dialog]')));
    check(ts.length === 1 && ts[0], `one Turnstile widget, inside the modal (${JSON.stringify(ts)})`);

    await p.fill('#mt-m-email', 'karim@example.com');
    await p.screenshot({ path: path.join(outDir, 'modal-desktop-1440.png') });
    await p.keyboard.press('Escape');
    await p.waitForSelector('[data-testid="form-modal"]', { state: 'detached', timeout: 3000 });
    check(true, 'Esc closes the modal');
    check((await p.inputValue('#mt-email')) === 'karim@example.com', 'email typed in the modal kept in the inline form');
    check(await p.evaluate(() => document.activeElement?.textContent === 'Yes, formally'), 'focus returns to where it was before');
    const ts2 = await p.evaluate(() => [...document.querySelectorAll('[data-ts-widget]')].map((w) => !!w.closest('[role=dialog]')));
    check(ts2.length === 1 && !ts2[0], 'after closing, Turnstile is back in the inline form');

    await p.waitForTimeout(500);
    const db = new Client({ connectionString: dbUrl }); await db.connect();
    const { rows } = await db.query("select source from funnel_events where kind = 'form_opened' and result_id = $1", [saved.id]);
    check(rows.length === 1 && rows[0].source === 'exit_prompt', `form_opened logged once with source exit_prompt (${JSON.stringify(rows)})`);
    await db.end();
    await ctx.close();
  }

  // ---------- desktop: send from the modal, with the modal's Turnstile token ----------
  {
    const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await toResults(p);
    await exitThenForm(p);
    await p.waitForTimeout(200);
    const widget = await p.evaluate(() => document.querySelector('[role=dialog] [data-ts-widget]')?.getAttribute('data-ts-widget'));
    await p.fill('#mt-m-name', 'Modal Lead'); await p.fill('#mt-m-email', 'modal-lead@example.com');
    await p.fill('#mt-m-phone', '3 123 456');
    await p.click('[data-testid="form-modal"] button[role=radio]:has-text("No")');
    await p.click('[data-testid="form-modal"] label:has-text("Beta may contact me")');
    const [req] = await Promise.all([p.waitForRequest('**/api/leads'), p.click('[data-testid="form-modal"] button:has-text("Send my full report")')]);
    check(JSON.parse(req.postData()).turnstile === `token-${widget}`, `the lead carries the modal's Turnstile token (token-${widget})`);
    await p.waitForSelector('[data-testid="sent"]', { timeout: 10000 });
    check(!(await p.isVisible('[data-testid="form-modal"]')), 'sent from the modal: confirmation screen, modal gone');
    await ctx.close();
  }

  // ---------- desktop: X and outside click (design preview) ----------
  {
    const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/?screen=results&modal=1`, { waitUntil: 'networkidle' });
    await p.fill('#mt-m-name', 'Kept');
    await p.click('[data-testid="form-modal"] [role=dialog]', { position: { x: 30, y: 300 } });
    check(await p.isVisible('[data-testid="form-modal"]'), 'a click inside the dialog keeps it open');
    await p.click('[data-testid="form-modal"]', { position: { x: 40, y: 450 } });
    await p.waitForSelector('[data-testid="form-modal"]', { state: 'detached', timeout: 3000 });
    check((await p.inputValue('#mt-name')) === 'Kept', 'outside click closes, data kept');
    await p.goto(`${base}/?screen=results&modal=1`, { waitUntil: 'networkidle' });
    await p.click('[data-testid="form-modal"] button[aria-label=Close]');
    await p.waitForSelector('[data-testid="form-modal"]', { state: 'detached', timeout: 3000 });
    check(true, 'X closes the modal');
    await ctx.close();
  }

  // ---------- phone: bottom sheet ----------
  {
    const ctx = await context(browser, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/?screen=results&modal=1`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const box = await p.$eval('[role=dialog]', (d) => { const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, w: r.width }; });
    check(box.w === 390 && Math.abs(box.bottom - 844) < 1 && box.height >= 830, `full-height bottom sheet (${JSON.stringify(box)})`);
    check(await p.evaluate(() => document.activeElement?.getAttribute('role') === 'dialog'), 'phone: focus moves to the sheet, the keyboard does not pop up on open');
    await p.screenshot({ path: path.join(outDir, 'modal-phone-390.png') });

    await p.tap('#mt-m-phone');
    await p.setViewportSize({ width: 390, height: 844 - 336 }); // keyboard up
    await p.waitForTimeout(800);
    const vis = await p.evaluate(() => {
      const el = document.getElementById('mt-m-phone').getBoundingClientRect();
      const d = document.querySelector('[role=dialog]').getBoundingClientRect();
      return { fieldTop: el.top, fieldBottom: el.bottom, sheetBottom: d.bottom, vh: window.visualViewport.height, focused: document.activeElement?.id };
    });
    check(vis.focused === 'mt-m-phone' && vis.fieldTop >= 0 && vis.fieldBottom <= vis.vh && vis.sheetBottom <= vis.vh + 1,
      `with the keyboard up, the sheet fits above it and the field is visible (${JSON.stringify(vis)})`);
    await p.fill('#mt-m-phone', '3 123 456');
    await p.screenshot({ path: path.join(outDir, 'modal-phone-390-keyboard.png') });
    await ctx.close();
  }

  // ---------- phone: the real flow, inline and sheet share state ----------
  {
    const ctx = await context(browser, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/?screen=results&modal=1`, { waitUntil: 'networkidle' });
    await p.fill('#mt-m-email', 'phone@example.com');
    await p.tap('[data-testid="form-modal"] button[aria-label=Close]');
    await p.waitForSelector('[data-testid="form-modal"]', { state: 'detached', timeout: 3000 });
    check((await p.inputValue('#mt-email')) === 'phone@example.com', 'phone: X closes the sheet, email kept in the inline form');
    await ctx.close();
  }
  await browser.close();
})();
