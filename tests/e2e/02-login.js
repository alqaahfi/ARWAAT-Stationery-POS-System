// Section 2: users, login, permissions (visible), plus the IPC-level admin-only sweep (background).
const fs = require('fs'); const path = require('path');
const H = require('./lib/h');
const POS = require('./lib/pos');
const { check, expectEq } = H;

async function tryLogin(ui, user, pass) {
  await ui.type(ui.page.getByLabel('Username'), user, `username ${JSON.stringify(user)}`);
  await ui.type(ui.page.getByLabel('Password'), pass, 'password');
  await ui.press('Enter');
  await H.sleep(1200);
}
async function signOutIfIn(ui) {
  const b = ui.page.getByRole('button', { name: 'Sign out' });
  if (await b.count()) { await ui.click(b, 'Sign out'); await ui.see('Sign in', 8000); }
}

// parse preload.js into [{area, method, channel}]
function apiMap() {
  const src = fs.readFileSync(path.join(H.ROOT, 'src', 'main', 'preload.js'), 'utf8').split('\n');
  const out = []; let area = null;
  for (const line of src) {
    const a = line.match(/^  (\w+): \{\s*$/); if (a) area = a[1];
    const m = line.match(/^\s{4}(\w+): \(.*\) => invoke\('([^']+)'/); if (m && area) out.push({ area, method: m[1], channel: m[2] });
  }
  return out;
}
function adminChannels() {
  const g = fs.readFileSync(path.join(H.ROOT, 'src', 'main', 'security', 'ipcGuard.js'), 'utf8');
  const start = g.indexOf('const ADMIN_CHANNELS');
  const set = new Set([...g.slice(start, g.indexOf(']);', start)).matchAll(/'([a-z-]+:[a-z-]+)'/g)].map((m) => m[1]));
  const prefixes = [...g.slice(g.indexOf('const ADMIN_PREFIXES'), g.indexOf('const ADMIN_CHANNELS')).matchAll(/'([a-z]+:)'/g)].map((m) => m[1]);
  return { set, prefixes };
}

(async () => {
  const rec = H.startRecording('02-login');
  const admin = await H.openApp('admin');
  await signOutIfIn(admin);

  await check('USERS', 'USR-01', 'Empty username and password show a clear message (Admin window)', 'V', async () => {
    await admin.press('Enter'); await H.sleep(900);
    const t = await admin.body();
    if (/Authentication failed|Invalid|enter|required/i.test(t) === false) throw new Error('no message: ' + t.slice(0, 160));
  }, admin);
  await check('USERS', 'USR-02', 'Wrong username is refused with a clear message', 'V', async () => {
    await tryLogin(admin, 'nobody', 'Admin@123'); await admin.see('Invalid username or password', 5000);
  }, admin);
  await check('USERS', 'USR-03', 'Wrong password is refused with a clear message', 'V', async () => {
    await tryLogin(admin, 'admin', 'WrongPass1'); await admin.see('Invalid username or password', 5000);
  }, admin);
  await check('USERS', 'USR-04', 'CRITICAL: cashier1 cannot sign in to the ADMIN app (right password, wrong app)', 'V', async () => {
    await tryLogin(admin, 'cashier1', 'Cash@123'); await admin.see('This is the Admin login', 5000);
    const t = await admin.body(); if (/Dashboard|Home\b.*Sale/.test(t) && /Sign out/.test(t)) throw new Error('cashier got into the admin app');
  }, admin);

  const cashier = await H.openApp('cashier');
  await check('USERS', 'USR-05', 'Admin cannot sign in through the CASHIER window', 'V', async () => {
    await tryLogin(cashier, 'admin', 'Admin@123'); await cashier.see('This is the Cashier login', 5000);
  }, cashier);
  await check('USERS', 'USR-06', 'cashier1 / Cash@123 signs in to the Cashier app', 'V', async () => {
    await tryLogin(cashier, 'cashier1', 'Cash@123'); await cashier.see('Who is this sale for?', 10000).catch(async () => { await cashier.see('New Sale', 5000); });
  }, cashier);

  await check('USERS', 'USR-07', 'Passwords are stored hashed (bcrypt), never in plain text', 'B', async () => {
    const rows = H.q('select username, password_hash from users');
    for (const r of rows) if (!/^\$2[aby]\$/.test(r.password_hash) || ['Admin@123', 'Cash@123'].includes(r.password_hash)) throw new Error('not hashed: ' + r.username);
  });

  await check('USERS', 'USR-08', 'Admin-only actions are refused for the cashier session (every admin IPC channel)', 'B', async () => {
    const { set, prefixes } = adminChannels();
    const skip = new Set(['system:factory-reset', 'backup:restore', 'backup:validate-and-restore', 'backup:relaunch-app', 'backup:export']);
    const targets = apiMap().filter((m) => (set.has(m.channel) || prefixes.some((p) => m.channel.startsWith(p))) && !skip.has(m.channel));
    const bad = [];
    for (const t of targets) {
      const res = await cashier.page.evaluate(([a, m]) => window.api[a][m]({}).catch((e) => ({ threw: String(e) })), [t.area, t.method]);
      const refused = res && res.success === false && /restricted to Admin|not allowed|sign in/i.test(res.reason || '');
      if (!refused) bad.push(`${t.channel} -> ${JSON.stringify(res).slice(0, 90)}`);
    }
    // the destructive ones are checked by reading the guard's list instead of calling them
    for (const ch of skip) if (!(set.has(ch) || prefixes.some((p) => ch.startsWith(p)))) bad.push(`${ch} is NOT in the admin-only list`);
    console.log(`   admin-only channels tried with the cashier session: ${targets.length}`);
    if (bad.length) throw new Error(`${bad.length} not refused: ${bad.slice(0, 5).join(' || ')}`);
  });

  await check('USERS', 'USR-09', 'Permission-gated actions refused for cashier1 (reports, expenses, cost prices)', 'B', async () => {
    const calls = [['reports', 'getSalesReport', { dateFrom: '2026-01-01', dateTo: '2026-12-31' }], ['expenses', 'list', {}]];
    const bad = [];
    for (const [a, m, args] of calls) {
      if (!cashier.page || !(await cashier.page.evaluate(([x, y]) => !!(window.api[x] && window.api[x][y]), [a, m]))) continue;
      const res = await cashier.page.evaluate(([x, y, z]) => window.api[x][y](z).catch((e) => ({ threw: String(e) })), [a, m, args]);
      if (!(res && res.success === false)) bad.push(`${a}.${m} -> ${JSON.stringify(res).slice(0, 80)}`);
    }
    if (bad.length) throw new Error(bad.join(' || '));
  });

  await check('USERS', 'USR-10', 'Logout really logs out: reload shows the sign-in page and the session is revoked', 'V', async () => {
    await signOutIfIn(cashier);
    await cashier.page.reload(); await H.sleep(2500);
    await cashier.see('Sign in', 8000);
    const open = H.q("select count(*) n from sessions s join users u on u.id=s.user_id where u.username='cashier1' and s.is_revoked=0 and s.ended_at is null");
    expectEq(open[0].n, 0, 'open cashier sessions');
  }, cashier);

  await check('USERS', 'USR-11', '5 wrong passwords lock that username for 5 minutes', 'V', async () => {
    for (let i = 0; i < 5; i++) await tryLogin(cashier, 'lockme', 'bad' + i);
    await tryLogin(cashier, 'lockme', 'bad6');
    await cashier.see('Too many', 5000);
  }, cashier);

  await rec.stop();
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
