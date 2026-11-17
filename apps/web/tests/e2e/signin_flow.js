// Signed-in path in a real browser: lead → request a sign-in link → open it (scanner-safe
// page) → upload again → "Saved to your dashboard" instead of the form → delete account.
// Needs the app running with DEV_OUTBOX=1. Usage: node signin_flow.js <base> <fixture> <outDir>
const { chromium } = require('playwright');
const path = require('path');
const [base, file, outDir] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch();
  const email = `signin-${Date.now()}@example.com`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="lead-form"]', { timeout: 30000 });
  await p.fill('#mt-name', 'Sign In'); await p.fill('#mt-email', email); await p.fill('#mt-phone', '3 123 456');
  await p.click('button[role=radio]:has-text("No")'); await p.click('label:has-text("Beta may contact me")');
  await p.click('button:has-text("Send my full report")');
  await p.waitForSelector('[data-testid="sent"]');

  const req = await p.request.post(base + '/api/auth/request', { data: { email } });
  check(req.ok(), 'sign-in link requested');
  const mail = (await (await p.request.get(base + '/api/dev/outbox')).json()).reverse().find((m) => m.to === email);
  const link = /https?:\/\/\S+token=[\w-]+/.exec(mail?.text || '')?.[0];
  check(!!link, 'sign-in email sent with a link');

  // A scanner fetching the link (plain GET, no JavaScript) must not use the token.
  const scanned = await p.request.get(link.replace(/^https?:\/\/[^/]+/, base));
  check(scanned.ok() && (await scanned.text()).includes('method="post"'), 'link scanners get a confirm page, token kept');

  await p.goto(link.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  check(p.url().includes('signedin=1'), 'opening the link signs in');
  // Same-origin fetch from the page: the browser sends the Secure cookie on 127.0.0.1.
  const inPage = (url, method = 'GET') => p.evaluate(async ([u, m]) => { const r = await fetch(u, { method: m }); return { status: r.status, body: r.status === 204 ? null : await r.json() }; }, [url, method]);
  const me = (await inPage('/api/me')).body;
  check(me.signed_in && me.email === email, 'session cookie set');
  const cookie = (await ctx.cookies()).find((c) => c.name === 'mt_session');
  check(cookie && cookie.httpOnly && cookie.sameSite === 'Lax', 'session cookie is httpOnly, SameSite=Lax');

  const again = await p.goto(link.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  check(p.url().includes('signin=expired'), 'the same link does not work twice');

  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
  await p.waitForTimeout(800);
  check(await p.isVisible('[data-testid="saved-banner"]') && !(await p.isVisible('[data-testid="lead-form"]')), 'signed in: "Saved to your dashboard" instead of the form');
  check(await p.evaluate(() => localStorage.getItem('mt_saved') === null), 'signed-in results are not kept as a browser saved result');
  await p.screenshot({ path: path.join(outDir, 'signed-in-1440.png'), fullPage: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 900 }, storageState: await ctx.storageState() });
  const pm = await mobile.newPage();
  await pm.goto(base + '/', { waitUntil: 'networkidle' });
  await pm.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await pm.waitForSelector('[data-testid="saved-banner"]', { timeout: 30000 });
  await pm.screenshot({ path: path.join(outDir, 'signed-in-390.png'), fullPage: true });
  await mobile.close();

  const del = await inPage('/api/account', 'DELETE');
  check(del.status === 204, 'account deleted');
  check(!(await inPage('/api/me')).body.signed_in, 'signed out after deletion');

  for (let i = 0; i < 6; i++) await p.request.post(base + '/api/auth/request', { data: { email: 'limit@example.com' } });
  const limited = await p.request.post(base + '/api/auth/request', { data: { email: 'limit@example.com' } });
  check(limited.status() === 429, 'sixth request within an hour is refused');
  await browser.close();
})();
