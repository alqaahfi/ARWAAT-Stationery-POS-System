// Restore CLEAN-MASTER visibly (first use) so the shop day starts from the clean data set.
const path = require('path');
const H = require('./lib/h'); const D = require('./lib/data'); const S = require('./lib/shop');
const { check, expectEq, q } = H;

(async () => {
  const rec = H.startRecording('03a-restore');
  let A = await H.openApp('admin'); await S.loginIf(A, 'admin', 'Admin@123');
  const file = path.join(H.ROOT, 'test-backups', 'CLEAN-MASTER.db');
  await check('BACKUP', 'BAK-00', 'Restore CLEAN-MASTER through the Backup & Restore screen: the clean data comes back, the day\'s sales are gone', 'V', async () => {
    const before = q('select count(*) n from sales')[0].n;
    A = await D.restoreBackup(A, file, { mode: 'admin', restart: true });
    await S.loginIf(A, 'admin', 'Admin@123');
    const after = q('select count(*) n from sales')[0].n;
    console.log(`   sales before restore ${before}, after ${after}`);
    expectEq(after, 0, 'sales after restoring CLEAN-MASTER');
    expectEq(q('select count(*) n from products')[0].n, 11, 'products');
    expectEq(q('select count(*) n from customers')[0].n, 3, 'customers');
  }, A);
  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
