// In-app updates: safe start-up migrations, pre-update backup, recovery, version-gated sync.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

module.exports = async (t, check) => {
  const connection = t.m('db/connection');
  const migrationsDir = path.join(t.MAIN, 'db', 'migrations');
  const pending = t.m('update/pendingUpdate');
  const updater = t.m('update/updater');
  const busy = t.m('update/entryBusy');
  const gate = t.m('sync/versionGate');
  const restoreFile = t.m('backup/restoreFile');
  const recovery = t.m('update/recovery');
  const BAD = path.join(migrationsDir, '999_rules_check_bad.sql');
  const latest = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((f) => parseInt(f, 10)).sort((a, b) => b - a)[0];

  await check('R19-01', 'a failing migration is rolled back, not marked applied, and start-up reports it (never opens the app)', async () => {
    fs.writeFileSync(BAD, 'CREATE TABLE rules_half_done (x); INSERT INTO table_that_does_not_exist VALUES (1);');
    try {
      connection.closeDatabase();
      let problem = null;
      try {
        connection.initDatabase();
      } catch (err) {
        problem = err;
      }
      assert.ok(problem, 'initDatabase should refuse');
      assert.strictEqual(problem.kind, 'migration');
      assert.ok(/999_rules_check_bad\.sql/.test(problem.detail) && /table_that_does_not_exist/.test(problem.detail), problem.detail);
      assert.throws(() => connection.getDb(), /not initialized/, 'no open database after a failed migration');
      const peek = new Database(connection.getDbPath(), { readonly: true });
      assert.ok(!peek.prepare("SELECT 1 FROM sqlite_master WHERE name = 'rules_half_done'").get(), 'half-applied table must be rolled back');
      assert.ok(!peek.prepare("SELECT 1 FROM _migrations WHERE filename = '999_rules_check_bad.sql'").get(), 'must not be marked applied');
      peek.close();
    } finally {
      fs.rmSync(BAD, { force: true });
      connection.initDatabase();
    }
    assert.ok(t.db().prepare('SELECT COUNT(*) AS n FROM users').get().n >= 1, 'data untouched');
  });

  await check('R19-02', 'data from a newer version is refused (downgrade guard) and the schema version is reported', async () => {
    assert.strictEqual(connection.getSchemaVersion(), latest);
    t.db().prepare("INSERT INTO _migrations (filename) VALUES ('900_from_the_future.sql')").run();
    connection.closeDatabase();
    let problem = null;
    try {
      connection.initDatabase();
    } catch (err) {
      problem = err;
    }
    assert.ok(problem && problem.kind === 'newer', problem && problem.message);
    const fix = new Database(connection.getDbPath());
    fix.prepare("DELETE FROM _migrations WHERE filename = '900_from_the_future.sql'").run();
    fix.close();
    connection.initDatabase();
  });

  await check('R19-03', 'pre-update backup is verified, named pre-update_<version>_<date_time>.db, newest 5 kept, copy goes to the auto-backup folder', async () => {
    const pb = t.m('update/preUpdateBackup');
    const autoFolder = path.join(t.TMP, 'AutoCopy');
    let last;
    for (let i = 0; i < 7; i++) {
      last = await pb.createPreUpdateBackup(t.db(), '1.0.0', { autoFolder: i === 6 ? autoFolder : null, now: new Date(2026, 9, 30, 10, i) });
      assert.ok(last.success, last.reason);
    }
    assert.ok(/pre-update_1\.0\.0_2026-10-30_1006\.db$/.test(last.file), last.file);
    const kept = fs.readdirSync(path.dirname(last.file)).filter((f) => /^pre-update_.*\.db$/.test(f));
    assert.strictEqual(kept.length, 5);
    assert.ok(fs.existsSync(path.join(autoFolder, path.basename(last.file))));
    assert.ok(pb.verifyBackup(last.file).ok);
    fs.writeFileSync(path.join(t.TMP, 'junk.db'), 'not a database');
    assert.strictEqual(pb.verifyBackup(path.join(t.TMP, 'junk.db')).ok, false);
  });

  await check('R19-04', 'the pending-update record survives (file) and recovery offers the restore only when the backup exists', async () => {
    const pb = t.m('update/preUpdateBackup');
    const b = await pb.createPreUpdateBackup(t.db(), '1.0.0', { now: new Date(2026, 9, 30, 11, 0) });
    pending.writePending({ from: '1.0.0', to: '1.1.0', backupPath: b.file, at: 'x', windows: ['admin', 'cashier'] }, t.db());
    assert.strictEqual(pending.readPending().to, '1.1.0');
    assert.ok(t.db().prepare("SELECT value FROM settings WHERE key = 'pending_update'").get().value.includes('1.1.0'));
    const info = recovery.buildInfo({ kind: 'migration', detail: 'Step 041 failed' });
    assert.strictEqual(info.title, "The update couldn't finish. Your data is safe.");
    assert.strictEqual(info.canRestore, true);
    assert.ok(info.contact.includes('0319 2224504'));
    assert.strictEqual(recovery.buildInfo({ kind: 'newer' }).title, 'This data was made by a newer version of ARWAAT. Install the latest version.');
    assert.strictEqual(recovery.buildInfo({ kind: 'newer' }).canRestore, false);
    pending.writePending({ from: '1.0.0', to: '1.1.0', backupPath: path.join(t.TMP, 'gone.db') }, null);
    assert.strictEqual(recovery.buildInfo({ kind: 'migration' }).canRestore, false);
    pending.clearPending(t.db());
    assert.strictEqual(pending.readPending(), null);
    assert.ok(!t.db().prepare("SELECT 1 FROM settings WHERE key = 'pending_update'").get());
  });

  await check('R19-05', "restoring a backup validates it, and keeps this PC's sync identity for a pre-update backup", async () => {
    const stationId = t.m('setup/stationIdentity').getStationId();
    const file = path.join(t.TMP, 'identity-backup.db');
    await t.db().backup(file);
    assert.ok(restoreFile.isValidBackupFile(file, { full: true }));
    assert.strictEqual(restoreFile.isValidBackupFile(path.join(t.TMP, 'junk.db')), false);
    const keep = path.join(t.TMP, 'target-keep.db');
    const drop = path.join(t.TMP, 'target-drop.db');
    fs.copyFileSync(file, keep);
    fs.copyFileSync(file, drop);
    restoreFile.copyBackupOverDatabase(file, keep, { keepStationId: true });
    restoreFile.copyBackupOverDatabase(file, drop, { keepStationId: false });
    const idOf = (p) => {
      const d = new Database(p, { readonly: true });
      const row = d.prepare("SELECT value FROM settings WHERE key = 'station_id'").get();
      d.close();
      return row && row.value;
    };
    assert.strictEqual(idOf(keep), stationId);
    assert.ok(!idOf(drop));
  });

  await check('R19-06', 'updates:* is Admin-only; dev builds say updates only work in the installed app', async () => {
    const asCashier = await t.invoke('updates:get-state', {}, 'cashier');
    assert.strictEqual(asCashier.success, false);
    for (const ch of ['updates:check', 'updates:download', 'updates:install', 'updates:consume-updated-notice']) {
      assert.strictEqual((await t.invoke(ch, {}, 'cashier')).success, false, ch);
    }
    const st = await t.invoke('updates:get-state', {});
    assert.strictEqual(st.supported, false);
    assert.strictEqual(st.message, 'Updates only work in the installed app.');
    assert.strictEqual((await t.invoke('updates:check', {})).supported, false);
  });

  await check('R19-07', 'install is refused while any window is entering a bill; busy flags clear with the window', async () => {
    const app = t.electronMock.app;
    app.isPackaged = true;
    try {
      updater._state.status = 'downloaded';
      updater._state.available = { version: '9.9.9', notes: '', sizeBytes: 1 };
      await t.invoke('app:set-busy', { key: 'pos-sale-1', busy: true }, 'cashier');
      assert.strictEqual(busy.isAnyBusy(), true);
      const refused = await updater.installNow();
      assert.strictEqual(refused.success, false);
      assert.strictEqual(refused.reason, 'Finish or hold the bill in the Cashier window first.');
      await t.invoke('app:set-busy', { key: 'pos-sale-1', busy: false }, 'cashier');
      assert.strictEqual(busy.isAnyBusy(), false);
      await t.invoke('app:set-busy', { key: 'quick-sale-2', busy: true }, 'admin');
      assert.strictEqual((await updater.installNow()).code, 'busy');
      busy.clearWindow(1); // the Admin window closed
      assert.strictEqual(busy.isAnyBusy(), false);
    } finally {
      app.isPackaged = false;
      updater._state.status = 'idle';
      updater._state.available = null;
    }
  });

  await check('R19-08', 'update messages: offline, forbidden/expired token, plain-text release notes, no token in errors', () => {
    assert.strictEqual(updater.describeError(new Error('getaddrinfo ENOTFOUND api.github.com'), 'check').kind, 'offline');
    assert.strictEqual(updater.describeError(new Error('net::ERR_INTERNET_DISCONNECTED'), 'download').kind, 'offline');
    const denied = updater.describeError(new Error('HttpError: 403 rate limit / Bad credentials'), 'check');
    assert.strictEqual(denied.kind, 'unreachable');
    assert.strictEqual(denied.message, "Updates can't be reached. Contact ARWAAT: 0319 2224504.");
    assert.strictEqual(updater.describeError(new Error('socket closed unexpectedly'), 'download').kind, 'download');
    const leaked = updater.describeError(new Error('401 for token ghp_abcdefghijklmnopqrstuvwxyz0123456789'), 'check');
    assert.ok(!JSON.stringify(leaked).includes('ghp_abcdefghijklmnopqrstuvwxyz'), 'token must be scrubbed');
    assert.strictEqual(updater.plainText('<h2>New</h2><ul><li>Faster &amp; safer</li></ul>'), 'New\n- Faster & safer');
    assert.strictEqual(updater.plainText('## Fixes\n**Bold** `code` [link](http://x)'), 'Fixes\nBold code link');
  });

  const peerBody = (extra) => ({ fromMachineId: 'peer-1', fromStationCode: 'CASH1', fromRole: 'cashier', sinceOutboxId: 0, callerOutboxWatermark: 0, records: [], ...extra });
  const exchange = (body) =>
    new Promise((resolve) => {
      const res = {
        statusCode: 200,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(b) {
          resolve({ status: this.statusCode, body: b });
        },
      };
      t.m('sync/syncServer').handleExchange({ body, headers: {}, ip: '10.0.0.9', socket: {} }, res);
    });

  await check('R19-09', 'sync exchange: different migration number (or none) is refused both ways, nothing applied; matching one works and resumes', async () => {
    const before = t.db().prepare('SELECT COUNT(*) AS n FROM products').get().n;
    const record = { table: 'products', uuid: 'aaaaaaaa-0000-4000-8000-000000000001', operation: 'insert', data: { name: 'Should Not Arrive' } };
    for (const extra of [{ fromAppVersion: '0.9.0', fromMigration: latest - 1 }, { fromAppVersion: '2.0.0', fromMigration: latest + 3 }, {}]) {
      const r = await exchange(peerBody({ ...extra, records: [record] }));
      assert.strictEqual(r.status, 409, JSON.stringify(extra));
      assert.strictEqual(r.body.error, 'version-mismatch');
      assert.strictEqual(r.body.migration, latest);
      assert.strictEqual(r.body.records, undefined, 'nothing is sent back');
    }
    assert.strictEqual(t.db().prepare('SELECT COUNT(*) AS n FROM products').get().n, before, 'nothing applied');

    const peers = await t.invoke('sync:get-peers', {});
    const row = peers.find((p) => p.machineId === 'peer-1');
    assert.ok(row, 'the paused computer is listed');
    assert.strictEqual(row.versionPaused, 'Paused: CASH1 is on an older version, this computer is on version 0.0.0-test. Update both computers to the same version.');
    const chip = await t.invoke('sync:get-status', {});
    assert.strictEqual(chip.versionPaused, null, 'the sync chip only counts computers that are online');

    const ok = await exchange(peerBody({ fromAppVersion: '0.0.0-test', fromMigration: latest }));
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.migration, latest);
    assert.strictEqual(ok.body.appVersion, '0.0.0-test');
    assert.strictEqual(gate.getMismatch('peer-1'), null, 'resumes automatically');
  });

  await check('R19-10', 'sync client: a peer announcing another migration is skipped before any record is sent; the outbox is kept', async () => {
    const eng = t.m('sync/syncEngine');
    const outboxBefore = t.db().prepare('SELECT COUNT(*) AS n FROM sync_outbox').get().n;
    const realFetch = global.fetch;
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error('must not be called');
    };
    try {
      await assert.rejects(
        eng.syncWithPeer({ machineId: 'peer-2', stationCode: 'CASH2', role: 'cashier', ip: '10.0.0.8', migration: latest - 2, appVersion: '0.8.0' }),
        (err) =>
          err.versionPaused === true &&
          /^Paused: CASH2 is on version 0\.8\.0, this computer is on version 0\.0\.0-test\. Update both computers to the same version\.$/.test(err.message)
      );
      assert.strictEqual(called, false);
      // A server reply that doesn't report the same layout is not applied either.
      global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ records: [{ table: 'products', uuid: 'x', operation: 'insert', data: {} }], newWatermark: 5 }) });
      await assert.rejects(eng.syncWithPeer({ machineId: 'peer-3', stationCode: 'CASH3', role: 'cashier', ip: '10.0.0.7' }), (err) => err.versionPaused === true);
      assert.strictEqual(t.db().prepare('SELECT COUNT(*) AS n FROM sync_outbox').get().n, outboxBefore);
      const w = t.db().prepare('SELECT last_synced_outbox_id AS s FROM sync_peer_state WHERE peer_machine_id = ?').get('peer-3');
      assert.ok(!w || !w.s, 'watermark not advanced');
    } finally {
      global.fetch = realFetch;
    }
  });

  await check('R19-11', 'Dev Panel: every install has a default password; it can be changed from the unlocked panel (current password needed)', async () => {
    const wrong = await t.invoke('devpanel:verify-password', { password: 'nope-nope' });
    assert.strictEqual(wrong.success, false);
    assert.strictEqual((await t.invoke('devpanel:change-password', { currentPassword: 'x', newPassword: 'abcdefgh1' })).success, false, 'locked panel refuses');
    assert.ok((await t.invoke('devpanel:verify-password', { password: '34y25879423s39e87$%&rtf7b87ve545$#&%rvT%$&^RYT' })).success, 'default password from migration 042');
    assert.strictEqual((await t.invoke('devpanel:change-password', { currentPassword: 'wrong-one', newPassword: 'abcdefgh1' })).success, false);
    assert.strictEqual((await t.invoke('devpanel:change-password', { currentPassword: '34y25879423s39e87$%&rtf7b87ve545$#&%rvT%$&^RYT', newPassword: 'short' })).success, false);
    assert.ok((await t.invoke('devpanel:change-password', { currentPassword: '34y25879423s39e87$%&rtf7b87ve545$#&%rvT%$&^RYT', newPassword: 'a-brand-new-pass' })).success);
    assert.strictEqual((await t.invoke('devpanel:verify-password', { password: '34y25879423s39e87$%&rtf7b87ve545$#&%rvT%$&^RYT' })).success, false, 'old password no longer works');
    assert.ok((await t.invoke('devpanel:verify-password', { password: 'a-brand-new-pass' })).success);
    const stored = t.db().prepare('SELECT password_hash FROM dev_panel_config WHERE id = 1').get().password_hash;
    assert.ok(stored.startsWith('$2') && !stored.includes('a-brand-new-pass'), 'only a hash is stored');
  });

  await check('R19-12', 'Forgot password: only the owner master key resets a password (wrong key refused; the right key works, locks lifted)', async () => {
    const accounts = await t.invoke('users:get-recovery-accounts', {});
    assert.ok(Array.isArray(accounts) && accounts.length > 0, 'accounts listed signed out');
    assert.ok(accounts.every((a) => !('password_hash' in a)), 'no hashes leak');
    const admin = accounts.find((a) => a.role === 'admin');
    const bad = await t.invoke('users:recover-password', { username: admin.username, recoveryKey: 'not-the-key', newPassword: 'whatever123' });
    assert.strictEqual(bad.success, false);
    assert.match(bad.reason, /Invalid master recovery key/);
    // The real key is a secret and is never stored in the repo: this half runs only when the
    // owner points ARWAAT_TEST_RECOVERY_KEY_FILE at a local file holding it.
    const keyFile = process.env.ARWAAT_TEST_RECOVERY_KEY_FILE;
    if (keyFile) {
      const key = require('fs').readFileSync(keyFile, 'utf8');
      const ok = await t.invoke('users:recover-password', { username: admin.username, recoveryKey: key, newPassword: 'recovered-pass-1' });
      assert.ok(ok.success, ok.reason);
      assert.ok((await t.invoke('users:login', { username: admin.username, password: 'recovered-pass-1' })).success, 'new password works');
    }
  });
};
