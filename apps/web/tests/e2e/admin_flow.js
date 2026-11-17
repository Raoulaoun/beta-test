// Admin CRM in a real browser: password + authenticator code, leads, filters, detail
// (stage, note), pipeline, funnel, drop-offs, settings, CSV. Screenshots at 1440.
// Usage: node admin_flow.js <base> <adminFile> <outDir>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const [base, adminFile, outDir] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const creds = fs.readFileSync(adminFile, 'utf8');
const password = /Password \(shown once\): (\S+)/.exec(creds)[1];
const secret = /setup key: (\S+)/.exec(creds)[1];

function totp(b32, offset = 0) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = [];
  for (const c of b32) { val = (val << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(base + '/admin', { waitUntil: 'networkidle' });
  check(p.url().endsWith('/admin/login'), 'signed-out admin is sent to the login page');
  await p.screenshot({ path: path.join(outDir, 'admin-login-1440.png') });
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(base + '/admin/login'); await mob.screenshot({ path: path.join(outDir, 'admin-login-390.png') }); await mob.close();

  await p.fill('input[type=email]', 'raoul@example.com'); await p.fill('input[type=password]', 'wrong-password');
  await p.click('button:has-text("Continue")');
  await p.waitForSelector('[data-testid=admin-login] [role=alert], [data-testid=settings-form] [role=alert]');
  check(await p.isVisible('text=Wrong email or password.'), 'wrong password refused');
  await p.fill('input[type=password]', password); await p.click('button:has-text("Continue")');
  await p.waitForSelector('text=Two-step check');
  await p.screenshot({ path: path.join(outDir, 'admin-2fa-1440.png') });
  const m2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m2.goto(base + '/admin/login'); await m2.close();
  await p.fill('input[autocomplete=one-time-code]', '000000'); await p.click('button:has-text("Sign in")');
  await p.waitForSelector('[data-testid=admin-login] [role=alert], [data-testid=settings-form] [role=alert]');
  check(await p.isVisible('[data-testid=admin-login] [role=alert]'), 'wrong code refused');
  await p.fill('input[autocomplete=one-time-code]', totp(secret)); await p.click('button:has-text("Sign in")');
  await p.waitForURL(base + '/admin');
  const cookie = (await ctx.cookies()).find((c) => c.name === 'mt_admin');
  check(cookie && cookie.httpOnly && cookie.sameSite === 'Strict', 'admin cookie httpOnly + SameSite=Strict');

  const rows = await p.$$('[data-testid=lead-row]');
  check(rows.length >= 6, `leads list shows ${rows.length} leads`);
  await p.screenshot({ path: path.join(outDir, 'admin-leads-1440.png'), fullPage: true });
  await p.selectOption('label:has-text("Band") select', 'professional_grade');
  await p.waitForURL(/band=professional_grade/);
  await p.waitForLoadState('networkidle');
  const filtered = await p.$$eval('[data-testid=lead-row]', (r) => r.length);
  check(filtered === 2, `band filter: ${filtered} Professional Grade leads`);
  const dl = await Promise.all([p.waitForEvent('download'), p.click('[data-testid=export-csv]')]);
  const csv = fs.readFileSync(await dl[0].path(), 'utf8');
  check(csv.split('\r\n').length === 3 && csv.includes('"Ziad Nassar"') && csv.includes("'+961"), 'CSV export follows the filters, phone guarded');

  await p.goto(base + '/admin', { waitUntil: 'networkidle' });
  await p.click('a:has-text("Karim Haddad")');
  await p.waitForSelector('[data-testid=lead-name]');
  await p.selectOption('[data-testid=stage-select]', 'contacted');
  await p.waitForTimeout(800);
  await p.fill('#ad-note', 'Called, sending the webinar link.'); await p.click('button:has-text("Add note")');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=note]').length === 2);
  check(true, 'note added');
  await p.reload({ waitUntil: 'networkidle' });
  check((await p.$eval('[data-testid=stage-select]', (s) => s.value)) === 'contacted', 'stage change saved');
  await p.screenshot({ path: path.join(outDir, 'admin-detail-1440.png'), fullPage: true });

  for (const [href, name] of [['/admin/pipeline', 'pipeline'], ['/admin/funnel', 'funnel'], ['/admin/dropoffs', 'dropoffs']]) {
    await p.goto(base + href, { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(outDir, `admin-${name}-1440.png`), fullPage: true });
  }
  await p.goto(base + '/admin/pipeline', { waitUntil: 'networkidle' });
  check((await p.$$eval('[data-testid=column-contacted] a', (a) => a.map((x) => x.textContent))).includes('Karim Haddad'), 'pipeline shows the moved lead');
  await p.goto(base + '/admin/dropoffs', { waitUntil: 'networkidle' });
  check((await p.textContent('[data-testid=dropoff-count]')) === '4', 'drop-offs counted (4 seeded)');

  await p.goto(base + '/admin/settings', { waitUntil: 'networkidle' });
  await p.fill('input[name=link_webinar]', 'http://not-https.example');
  await p.click('button:has-text("Save")');
  await p.waitForSelector('[data-testid=admin-login] [role=alert], [data-testid=settings-form] [role=alert]');
  check(await p.isVisible('[data-testid=settings-form] [role=alert]'), 'non-https link refused');
  await p.fill('input[name=link_webinar]', 'https://betaapp.me/webinar');
  await p.fill('input[name=link_managers_room]', 'https://t.me/betamanagers');
  await p.click('button:has-text("Save")');
  await p.waitForSelector('text=Saved');
  await p.screenshot({ path: path.join(outDir, 'admin-settings-1440.png'), fullPage: true });

  const sameOrigin = await p.evaluate(async () => (await fetch('/api/admin/stage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  check(sameOrigin === 400, 'same-origin admin request reaches validation');
  const cross = await ctx.request.post(base + '/api/admin/stage', { headers: { origin: 'https://evil.example' }, data: {} });
  check(cross.status() === 403, 'cross-origin admin request refused');

  await p.click('button:has-text("Sign out")');
  await p.waitForURL(base + '/admin/login');
  await p.goto(base + '/admin');
  check(p.url().endsWith('/admin/login'), 'signed out');
  await browser.close();
})();
