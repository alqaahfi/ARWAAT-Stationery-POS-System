// Restore CLEAN-MASTER visibly (first use) so the shop day starts from the clean data set.
const path = require('path');
const H = require('./lib/h'); const D = require('./lib/data'); const S = require('./lib/shop');
const { check, expectEq, q } = H;

(async () => {
  const rec = H.startRecording('03a-restore');
  const A = await H.openApp('admin'); await S.loginIf(A, 'admin', 'Admin@123');
  const file = path.join(H.ROOT, 'test-backups', 'CLEAN-MASTER.db');
  await check('BACKUP', 'BAK-00', 'Restore CLEAN-MASTER through the Backup & Restore screen: the clean data comes back, the day\'s sales are gone', 'V', async () => {
    const before = q('select count(*) n from sales')[0].n;
    await D.openBackupTab(A);
    const dlg = D.answerFileDialog(file);
    await A.click(A.btn('Choose a backup file'), 'Choose a backup file');
    // the app asks to confirm first
    await H.sleep(800); await A.shot('restore-confirm');
    await dlg;
    await H.sleep(1500); await A.shot('restore-after-dialog');
    await A.see('Backup restored', 8000); await A.shot('restore-done');
    await A.click(A.page.getByText(/Restart now/i).first(), 'Restart now');
    // app relaunches itself; wait for it to be back
    for (let i = 0; i < 40; i++) { await H.sleep(1000); if (await H.cdpUp()) { try { await H.connect(); break; } catch { /* retry */ } } }
    await H.sleep(3000);
    const after = q('select count(*) n from sales')[0].n;
    console.log(`   sales before restore ${before}, after ${after}`);
    expectEq(after, 0, 'sales after restoring CLEAN-MASTER');
    expectEq(q('select count(*) n from products')[0].n, 11, 'products');
    expectEq(q('select count(*) n from customers')[0].n, 3, 'customers');
  }, A);
  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
