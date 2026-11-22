// The account journey in a real browser against the live stack and database:
// lead → report email with the PDF → sign in with a code → dashboard → second upload → goal → PDF →
// settings → delete. Screenshots of the real screens at 1440 and 390.
// Usage: node account_flow.js <base> <fixturesDir> <outDir>
const { chromium, devices } = require('playwright');
const path = require('path');
const [base, fixtures, outDir] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const STANDIN = `window.turnstile={render(el,o){setTimeout(()=>o.callback('t'),20);return 'w'},remove(){},reset(){}}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function outbox(p) { return (await (await p.request.get(base + '/api/dev/outbox')).json()).reverse(); }
async function waitMail(p, to, kind) {
  for (let i = 0; i < 40; i++) { const m = (await outbox(p)).find((x) => x.to === to && x.kind === kind); if (m) return m; await sleep(250); }
  return null;
}
async function upload(p, file) {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', path.join(fixtures, file));
  await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
  return Number(await p.textContent('[data-testid="score"]'));
}

(async () => {
  const browser = await chromium.launch();
  const email = `account-${Date.now()}@example.com`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route('**/turnstile/v0/api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: STANDIN }));
  const p = await ctx.newPage();

  // ---------- lead → report email with the PDF ----------
  const first = await upload(p, 'early-nudge.xlsx');
  await p.fill('#mt-name', 'Karim Haddad'); await p.fill('#mt-email', email); await p.fill('#mt-phone', '3 123 456');
  await p.click('[data-testid="lead-form"] button[role=radio]:has-text("No")');
  await p.click('[data-testid="lead-form"] label:has-text("Beta may contact me")');
  await p.click('[data-testid="lead-form"] button:has-text("Send my full report")');
  await p.waitForSelector('[data-testid="sent"]', { timeout: 15000 });
  const report = await waitMail(p, email, 'report');
  check(!!report && report.subject.startsWith('Your Manager Test report: '), `report email sent (${report && report.subject})`);
  const att = report && report.attachments[0];
  check(!!att && att.pdf && att.filename === 'Manager-Test-Report-Karim.pdf' && att.bytes > 50_000, `PDF attached (${att && att.filename}, ${att && att.bytes} bytes)`);
  check(!!report && report.text.includes('educational purposes only'), 'report email carries the disclaimer');

  // ---------- signed in by the form, on this browser ----------
  await p.goto(base + '/dashboard', { waitUntil: 'load' });
  check(p.url().endsWith('/dashboard') && (await p.textContent('h1')) === 'Welcome back, Karim', 'sending the form signed this browser in: the dashboard opens directly');
  const session = (await ctx.cookies()).find((c) => c.name === 'mt_session');
  check(!!session && session.httpOnly && session.expires - Date.now() / 1000 > 364 * 86400, 'a year-long, httpOnly session');
  await ctx.clearCookies({ name: 'mt_session' });

  // ---------- sign in (another device) ----------
  await p.goto(base + '/dashboard');
  check(p.url().endsWith('/signin'), 'signed out: /dashboard goes to sign-in');
  await p.fill('#si-email', email);
  await p.click('button:has-text("Send code")');
  await p.waitForSelector('[data-testid="signin"][data-step="code"]');
  const mail = await waitMail(p, email, 'sign_in_code');
  await p.fill('#si-code', mail.subject.slice(0, 6));
  await p.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null);
  await p.waitForSelector('h1');
  check(p.url().endsWith('/dashboard'), 'the emailed code opens the dashboard');
  check((await p.textContent('h1')) === 'Welcome back, Karim', 'welcome by first name');
  check(Number(await p.textContent('[data-testid="latest"] span[style*="60px"]')) === first, 'latest result is the uploaded score');
  check(await p.isVisible('[data-testid="no-history"]'), 'one result: "Upload a newer statement to start your history"');
  check((await p.getAttribute('[data-testid="goal"]', 'data-state')) === 'auto' && await p.isVisible('text=Set automatically'), 'goal set automatically');
  check(await p.isVisible('[data-testid="account-chip"]') && !(/\d{3}/.test(await p.textContent('[data-testid="account-chip"]'))), 'one trading account, named without digits');
  await p.screenshot({ path: path.join(outDir, 'real-dashboard-first-1440.png'), fullPage: true });

  // ---------- second upload while signed in ----------
  await upload(p, 'disciplined.xlsx');
  check(await p.isVisible('[data-testid="saved-banner"]'), 'signed-in upload: result saved to the history');
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  const points = await p.$$('[data-testid="chart-point"]');
  check(points.length === 2, `history chart has 2 points (${points.length})`);
  check((await p.$$('[data-testid="report-row"]')).length === 2, 'two past reports');
  await points[0].click();
  check((await p.textContent('[data-testid="selected"]')).includes(String(first)), 'tapping a point shows its pillars');

  // ---------- change goal ----------
  const state = await p.getAttribute('[data-testid="goal"]', 'data-state');
  if (state === 'reached') {
    const t = await p.textContent('[data-testid="goal"]');
    check(/Goal reached: .+/.test(t) && t.includes('Up from') && t.includes('Suggested next goal'), 'the second result reached the goal: reached card with the next suggestion');
    await p.screenshot({ path: path.join(outDir, 'real-goal-reached-1440.png'), fullPage: true });
    await p.click('[data-testid="goal"] button:has-text("Choose a different goal")');
  } else {
    await p.click('[data-testid="goal"] button:has-text("Change goal")');
  }
  const bandOn = await p.isEnabled('[data-testid="goal"] button[role=radio]:has-text("Reach a band")');
  if (bandOn) {
    await p.click('[data-testid="goal"] button[role=radio]:has-text("Reach a band")');
    await p.click('[data-testid="goal"] button:has-text("Save goal")');
    await p.waitForFunction(() => document.querySelector('[data-testid="goal"]').dataset.state === 'active');
    check((await p.textContent('[data-testid="goal"]')).includes('Reach '), 'band goal saved');
  } else {
    await p.click('[data-testid="goal"] button:has-text("Save goal")');
    await p.waitForFunction(() => document.querySelector('[data-testid="goal"]').dataset.state === 'active');
    check(true, 'pillar goal saved (already in the top band)');
  }
  await p.reload({ waitUntil: 'networkidle' });
  check((await p.getAttribute('[data-testid="goal"]', 'data-state')) === 'active', 'goal change kept after reload');
  await p.screenshot({ path: path.join(outDir, 'real-dashboard-1440.png'), fullPage: true });

  // ---------- PDF ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="latest"] a:has-text("Download report")')]);
  const fs = require('fs');
  const bytes = fs.readFileSync(await dl.path());
  check(bytes.subarray(0, 5).toString() === '%PDF-' && dl.suggestedFilename() === 'Manager-Test-Report-Karim.pdf', `Download report gives the PDF (${dl.suggestedFilename()}, ${bytes.length} bytes)`);
  fs.copyFileSync(await dl.path(), path.join(outDir, 'report.pdf'));
  const other = await browser.newContext();
  const stranger = await other.request.get(base + (await p.getAttribute('[data-testid="report-row"] a', 'href')), { maxRedirects: 0 });
  check(stranger.status() === 303, 'someone signed out cannot download it');
  await other.close();

  // ---------- phone ----------
  const phone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
  const m = await phone.newPage();
  await m.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await m.screenshot({ path: path.join(outDir, 'real-dashboard-390.png'), fullPage: true });
  await m.goto(base + '/settings', { waitUntil: 'networkidle' });
  await m.screenshot({ path: path.join(outDir, 'real-settings-390.png'), fullPage: true });
  await phone.close();

  // ---------- settings ----------
  await p.goto(base + '/settings', { waitUntil: 'networkidle' });
  check((await p.inputValue('#st-email')) === email && await p.getAttribute('#st-email', 'readonly') !== null, 'email shown, read-only');
  check(await p.isVisible('text=An email when your 60-day retest date arrives.') || await p.isVisible('text=An email when your 90-day retest date arrives.'), 'retest days from the band');
  await p.fill('#st-phone', '12');
  await p.click('button:has-text("Save changes")');
  await p.waitForSelector('text=Please enter a valid WhatsApp number', { timeout: 5000 }).catch(() => null);
  check(await p.isVisible('text=Please enter a valid WhatsApp number') && !(await p.isVisible('text=Saved')), 'a bad phone number is refused');
  await p.fill('#st-phone', '3 999 888'); await p.fill('#st-name', 'Karim H.');
  await p.click('[role=switch][aria-labelledby="st-updates"]');
  await p.click('button:has-text("Save changes")');
  await p.waitForSelector('text=Saved');
  await p.reload({ waitUntil: 'networkidle' });
  check((await p.inputValue('#st-name')) === 'Karim H.' && (await p.getAttribute('[role=switch][aria-labelledby="st-updates"]', 'aria-checked')) === 'true', 'details and preferences saved');
  await p.screenshot({ path: path.join(outDir, 'real-settings-1440.png'), fullPage: true });

  // ---------- delete ----------
  await p.click('button:has-text("Delete my account and data")');
  await p.click('button:has-text("Yes, delete everything")');
  await p.waitForSelector('[data-testid="deleted"]');
  check(!!(await waitMail(p, email, 'account_deleted')), 'deletion confirmation email sent');
  await p.screenshot({ path: path.join(outDir, 'real-settings-deleted-1440.png'), fullPage: true });
  await p.goto(base + '/dashboard');
  check(p.url().endsWith('/signin'), 'after deletion: signed out');
  await browser.close();
})();
