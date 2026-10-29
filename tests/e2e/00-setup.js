// First run: Admin setup through the UI (no activation exists in this build - see TEST_RESULTS).
const H = require('./lib/h');
const { check, expectEq } = H;

(async () => {
  const rec = H.startRecording('00-setup');
  if (process.env.KEEP_DATA !== '1') H.wipeData();
  const ui = await H.openApp('admin', { fresh: true });
  const p = ui.page;

  await check('SETUP', 'SET-01', 'First run shows the setup screen (nothing usable before setup)', 'V', async () => {
    await ui.see('Set up this computer');
    const t = await ui.body();
    if (/Dashboard|New Sale/i.test(t) && !/Set up this computer/.test(t)) throw new Error('app usable before setup');
  }, ui);

  await check('SETUP', 'SET-02', 'Empty setup form is refused with clear messages', 'V', async () => {
    await ui.click(ui.btn(/^Admin/), 'Admin card');
    await ui.click(ui.btn('Finish setup'), 'Finish setup (empty)');
    await ui.pause(800);
    const t = await ui.body();
    if (!/required|enter|Please|at least/i.test(t)) throw new Error('no validation message shown: ' + t.slice(0, 200));
  }, ui);

  await check('SETUP', 'SET-03', 'Short password (<6) is refused', 'V', async () => {
    await ui.type(p.getByLabel('Shop Name'), 'Test Stationery', 'shop name');
    await ui.type(p.getByLabel('Full name'), 'Shop Admin', 'full name');
    await ui.type(p.getByLabel('Username'), 'admin', 'username');
    await ui.type(p.getByLabel('Password'), 'abc', 'short password');
    await ui.click(ui.btn('Finish setup'), 'Finish setup');
    await ui.see('at least 6', 6000);
  }, ui);

  await check('SETUP', 'SET-04', 'Admin account is created (admin / Admin@123) and signs in to the dashboard', 'V', async () => {
    await ui.type(p.getByLabel('Password'), 'Admin@123', 'password');
    await ui.click(ui.btn('Finish setup'), 'Finish setup');
    await p.getByText('Home', { exact: false }).first().waitFor({ timeout: 20000 });
    await ui.pause();
  }, ui);

  await ui.shot('setup-done');
  await rec.stop();
  const rows = H.q('select username, role, is_active, substr(password_hash,1,4) as pfx from users');
  console.log('users in DB:', JSON.stringify(rows));
  process.exit(0);
})().catch((e) => { console.error('SETUP SCRIPT ERROR', e); process.exit(1); });
