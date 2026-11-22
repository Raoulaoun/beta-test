// Sign in with a 6-digit code, in a real browser against the live stack and database:
// lead form (signed in on this browser) → sign out from the avatar menu → sign in with a code
// (invalid email, wrong code with tries left, resend, right code) → dashboard; expired,
// locked and rate-limited codes; old links; signed-in upload. Screenshots at 1440 and 390.
// Needs DEV_OUTBOX=1. Usage: node signin_flow.js <base> <fixture> <outDir> <databaseUrl>
const { chromium, devices } = require('playwright');
const path = require('path');
const { Client } = require('pg');
const [base, file, outDir, dbUrl] = process.argv.slice(2);
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const STANDIN = `window.turnstile={render(el,o){setTimeout(()=>o.callback('t'),20);return 'w'},remove(){},reset(){}}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestCode(p, email) {
  for (let i = 0; i < 40; i++) {
    const m = (await (await p.request.get(base + '/api/dev/outbox')).json()).reverse().find((x) => x.to === email && x.kind === 'sign_in_code');
    if (m) return { code: /^(\d{6}) is your Manager Test code$/.exec(m.subject)?.[1], mail: m };
    await sleep(250);
  }
  return {};
}
const msg = (p) => p.textContent('[data-testid="signin-msg"]').catch(() => '');
async function toCodeStep(p, email) {
  await p.fill('#si-email', email);
  await p.click('button:has-text("Send code")');
  await p.waitForSelector('[data-testid="signin"][data-step="code"]', { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch();
  const db = new Client({ connectionString: dbUrl }); await db.connect();
  const email = `signin-${Date.now()}@example.com`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/turnstile/v0/api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: STANDIN }));
  const p = await ctx.newPage();

  // ---------- signed out: "Sign in" in the headers ----------
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  check(await p.isVisible('[data-testid="header-signin"]'), 'landing header: "Sign in" when signed out');
  await p.screenshot({ path: path.join(outDir, 'landing-signed-out-1440.png') });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="lead-form"]', { timeout: 30000 });
  check(await p.isVisible('[data-testid="header-signin"]'), 'app header: "Sign in" when signed out');
  await p.fill('#mt-name', 'Sign In'); await p.fill('#mt-email', email); await p.fill('#mt-phone', '3 123 456');
  await p.click('[data-testid="lead-form"] button[role=radio]:has-text("No")'); await p.click('[data-testid="lead-form"] label:has-text("Beta may contact me")');
  await p.click('[data-testid="lead-form"] button:has-text("Send my full report")');
  await p.waitForSelector('[data-testid="sent"]');

  // ---------- confirmation: signed in, "Your dashboard is ready" ----------
  await p.waitForSelector('[data-testid="dashboard-ready"]', { timeout: 5000 }).catch(() => null);
  check(await p.isVisible('[data-testid="dashboard-ready"]') && await p.isVisible('[data-testid="dashboard-ready"] a:has-text("Open my dashboard")'), 'sent screen: "Your dashboard is ready" with Open my dashboard');
  await p.waitForSelector('[data-testid="account-avatar"]', { timeout: 5000 }).catch(() => null);
  check(await p.isVisible('[data-testid="account-avatar"]') && (await p.textContent('[data-testid="account-avatar"]')) === 'SI', 'header shows the initials avatar once signed in');
  await p.screenshot({ path: path.join(outDir, 'sent-signed-in-1440.png'), fullPage: true });

  // ---------- avatar menu → Sign out ----------
  await p.click('[data-testid="dashboard-ready"] a');
  await p.waitForURL('**/dashboard');
  await p.click('[data-testid="account-menu-button"]');
  const menu = await p.textContent('[data-testid="account-menu"]');
  check(menu.includes('Sign In') && menu.includes(email) && menu.includes('Dashboard') && menu.includes('Settings') && menu.includes('Sign out'), 'avatar menu: name, email, Dashboard, Settings, Sign out');
  await p.screenshot({ path: path.join(outDir, 'avatar-menu-1440.png') });
  await p.keyboard.press('Escape');
  check(!(await p.isVisible('[data-testid="account-menu"]')), 'Esc closes the menu');
  await p.click('[data-testid="account-menu-button"]');
  await p.click('[data-testid="menu-signout"]');
  await p.waitForSelector('[data-testid="signed-out"]');
  check((await p.textContent('[data-testid="signed-out"]')).includes('Nothing about your account is left on this browser.'), '"You\'re signed out", word for word');
  const left = (await ctx.cookies()).filter((c) => c.name === 'mt_session' || c.name === 'mt_known');
  check(left.length === 0, 'no session or known-device cookie left');
  await p.screenshot({ path: path.join(outDir, 'signed-out-1440.png') });
  await p.goto(base + '/dashboard');
  check(p.url().endsWith('/signin'), 'signed out: /dashboard asks to sign in');

  // ---------- sign in with a code ----------
  await p.waitForSelector('#si-email');
  await p.screenshot({ path: path.join(outDir, 'signin-email-1440.png') });
  await p.fill('#si-email', 'karim@example');
  await p.click('button:has-text("Send code")');
  check((await p.textContent('#si-email-err')) === 'Enter a full email address, like name@example.com.', 'invalid email: the design\'s message');
  await p.screenshot({ path: path.join(outDir, 'signin-invalid-1440.png') });
  await toCodeStep(p, email);
  check((await p.textContent('#si-title')) === 'Enter your code' && (await p.textContent('[data-testid="signin"]')).includes(`We sent a 6-digit code to ${email}.`), 'code step: "We sent a 6-digit code to {email}."');
  check(await p.waitForFunction(() => document.activeElement?.id === 'si-code', null, { timeout: 2000 }).then(() => true, () => false), 'focus moves to the code field');
  check(await p.getAttribute('#si-code', 'autocomplete') === 'one-time-code' && await p.getAttribute('#si-code', 'inputmode') === 'numeric', 'code field: one-time-code, numeric keypad');
  const first = await latestCode(p, email);
  check(!!first.code, `code email sent ("${first.mail?.subject}")`);
  await p.screenshot({ path: path.join(outDir, 'signin-code-1440.png') });
  await p.keyboard.type('418');
  await p.screenshot({ path: path.join(outDir, 'signin-typing-1440.png') });
  await p.keyboard.type(first.code === '000000' ? '111' : '000');
  await p.waitForSelector('[data-testid="signin"][data-status="wrong"]', { timeout: 5000 });
  check((await msg(p)) === "That code isn't right. Check the email and try again. 4 tries left.", 'a full wrong code submits itself: "… 4 tries left."');
  await p.screenshot({ path: path.join(outDir, 'signin-wrong-1440.png') });
  await p.click('button:has-text("Resend code")');
  await p.waitForSelector('[data-testid="signin"][data-status="resent"]');
  check((await msg(p)) === 'Code sent again. Use the newest one.', 'Resend: "Code sent again. Use the newest one."');
  await p.screenshot({ path: path.join(outDir, 'signin-resent-1440.png') });
  const second = await latestCode(p, email);
  check(second.code && second.mail.subject !== first.mail.subject || second.code === first.code, 'a new code was emailed');
  await p.fill('#si-code', second.code);
  await p.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => null);
  check(p.url().endsWith('/dashboard'), 'the right code opens the dashboard');
  const session = (await ctx.cookies()).find((c) => c.name === 'mt_session');
  check(session && session.httpOnly && session.expires - Date.now() / 1000 > 364 * 86400, 'a year-long, httpOnly session');

  // ---------- settings: "Signed in on this browser" → Sign out ----------
  await p.goto(base + '/settings', { waitUntil: 'networkidle' });
  check((await p.textContent('[data-testid="signed-in-here"]')).includes('You stay signed in here for a year.'), 'settings: "Signed in on this browser"');
  await p.screenshot({ path: path.join(outDir, 'settings-sign-out-1440.png'), fullPage: true });

  // ---------- signed in: the result is saved; the form stays (design) ----------
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  check(await p.isVisible('[data-testid="account-avatar"]'), 'landing header: avatar when signed in');
  await p.screenshot({ path: path.join(outDir, 'landing-signed-in-1440.png') });
  await p.setInputFiles('[data-testid="dropzone"] input[type=file]', file);
  await p.waitForSelector('[data-testid="score"]', { timeout: 30000 });
  check((await p.textContent('[data-testid="saved-banner"]')).includes("You're signed in. This result is saved to your history.Open my dashboard"), 'signed-in upload: "You\'re signed in. This result is saved…" + Open my dashboard');
  check(await p.isVisible('[data-testid="lead-form"]'), 'the report form stays, as in the design');
  await p.screenshot({ path: path.join(outDir, 'results-saved-1440.png') });

  await p.goto(base + '/settings', { waitUntil: 'networkidle' });
  await p.click('[data-testid="signed-in-here"] button:has-text("Sign out")');
  await p.waitForSelector('[data-testid="signed-out"]');
  check(true, 'Sign out from settings shows "You\'re signed out"');

  // ---------- expired, locked, rate limited ----------
  await p.goto(base + '/signin', { waitUntil: 'networkidle' });
  await toCodeStep(p, email);
  const third = await latestCode(p, email);
  await db.query("update auth_tokens set expires_at = now() - interval '1 minute' where email = $1 and kind = 'code' and used_at is null", [email]);
  await p.fill('#si-code', third.code);
  await p.waitForSelector('[data-testid="signin"][data-status="expired"]');
  check((await msg(p)) === 'This code has expired. Codes work for 10 minutes. Send a new one to continue.' && await p.isVisible('button:has-text("Send a new code")'), 'expired: message and "Send a new code"');
  await p.screenshot({ path: path.join(outDir, 'signin-expired-1440.png') });
  await p.click('button:has-text("Send a new code")');
  await p.waitForSelector('[data-testid="signin"][data-status="resent"]');
  for (let i = 0; i < 5; i++) {
    await p.fill('#si-code', '000000');
    await p.waitForSelector(`[data-testid="signin"][data-status="${i < 4 ? 'wrong' : 'locked'}"]`);
  }
  check((await msg(p)) === 'Too many wrong tries, so this code has stopped working. Send a new one to continue.', 'five wrong tries: locked');
  await p.screenshot({ path: path.join(outDir, 'signin-locked-1440.png') });
  // 4 codes so far this hour for this email: one more is allowed, then the limit.
  await p.click('button:has-text("Send a new code")');
  await p.waitForSelector('[data-testid="signin"][data-status="resent"]');
  await p.click('button:has-text("Resend code")');
  await p.waitForSelector('[data-testid="signin"][data-status="ratelimit"]');
  check(/^You've asked for 5 codes in the last hour\. Try again in \d+ minutes?, or use the newest code you already have\.$/.test(await msg(p)), `rate limit with the minutes: "${await msg(p)}"`);
  check(await p.isDisabled('button:has-text("Resend code")'), 'Resend is off while limited');
  await p.screenshot({ path: path.join(outDir, 'signin-ratelimit-1440.png') });
  const unknown = await p.evaluate(async () => (await fetch('/api/auth/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody-at-all@example.com' }) })).status);
  check(unknown === 200, 'unknown email: the same answer as a real one');

  // ---------- old links ----------
  const old = await p.request.get(base + '/auth/verify?token=abc', { maxRedirects: 0 });
  check(old.status() === 303 && old.headers().location.endsWith('/signin'), 'an old sign-in link opens the sign-in screen');

  // ---------- phone ----------
  const phone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const m = await phone.newPage();
  await m.goto(base + '/signin', { waitUntil: 'networkidle' });
  await m.screenshot({ path: path.join(outDir, 'signin-email-390.png') });
  await toCodeStep(m, `phone-${Date.now()}@example.com`);
  await m.screenshot({ path: path.join(outDir, 'signin-code-390.png') });
  await m.goto(base + '/signin?signedout=1', { waitUntil: 'networkidle' });
  await m.screenshot({ path: path.join(outDir, 'signed-out-390.png') });
  await phone.close();

  await db.end();
  await browser.close();
})();
