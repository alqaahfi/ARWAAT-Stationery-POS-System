// Rule 16: automatic daily backup (safe online backup, 30 days kept, status for Home/Settings).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async (t, check) => {
  const ab = t.m('backup/autoBackup');
  const pen = t.addProduct({ name: 'Pen', retail: 100, stock: 5 });
  const folder = path.join(t.TMP, 'Backups-' + Date.now());

  await check('R16-01', 'default folder is Documents\ARWAAT Backups', async () => {
    const st = await t.invoke('backup:get-auto-status', {});
    assert.ok(st.folder.endsWith(path.join('Documents', 'ARWAAT Backups')));
    assert.strictEqual(st.usbReminderDue, true);
  });
  await check('R16-02', 'folder change is Admin-only and must be writable', async () => {
    assert.strictEqual((await t.invoke('backup:set-auto-folder', { folder }, 'cashier')).success, false);
    assert.ok((await t.invoke('backup:set-auto-folder', { folder })).success);
    assert.strictEqual((await t.invoke('backup:set-auto-folder', { folder: 'relative/path' })).success, false);
  });
  await check('R16-03', 'the backup contains the newest data (online backup, WAL included); once a day', async () => {
    await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');
    const r = await ab.runAutoBackup();
    assert.ok(r.success && r.file, r.reason);
    const Database = require('better-sqlite3');
    const copy = new Database(r.file, { readonly: true });
    assert.strictEqual(copy.prepare('SELECT COUNT(*) AS n FROM sales').get().n, 1);
    copy.close();
    assert.strictEqual((await ab.runAutoBackup()).skipped, true);
    const st = await t.invoke('backup:get-auto-status', {});
    assert.ok(st.lastAt && !st.lastError);
  });
  await check('R16-04', 'files older than 30 days are deleted, newer kept', () => {
    fs.writeFileSync(path.join(folder, 'arwaat-auto-2000-01-01.db'), 'x');
    fs.writeFileSync(path.join(folder, 'my-own-file.db'), 'x');
    const removed = ab.pruneOld(folder);
    assert.deepStrictEqual(removed, ['arwaat-auto-2000-01-01.db']);
    assert.ok(fs.existsSync(path.join(folder, 'my-own-file.db')));
  });
  await check('R16-05', 'a failure is recorded for Home; weekly USB reminder can be marked done', async () => {
    t.db().prepare("UPDATE settings SET value = ? WHERE key = 'auto_backup_folder'").run(path.join(folder, 'my-own-file.db', 'sub'));
    const r = await ab.runAutoBackup({ force: true });
    assert.strictEqual(r.success, false);
    const home = await t.invoke('dashboard:get-summary', {});
    assert.ok(home.autoBackup.lastError);
    await t.invoke('backup:usb-reminder-done', {});
    assert.strictEqual((await t.invoke('backup:get-auto-status', {})).usbReminderDue, false);
  });
};
