// Writes the static parts of test-results/meta.json (fixes, notes, manual list, clean-start facts). Run before report.js.
const M = require('./lib/meta');
M.update((m) => {
  m.runDate = new Date().toString();
  m.testedCommit = 'bd5e0ed (first installed build had f75c079); final installed build includes up to the last Fix commit listed below';
  m.zip = 'test-backups/old-dev-dbs-2026-10-29_1629.zip';
  m.deleted = ['%APPDATA%/stationary-pos-app (pos.db, pos.db.before-dummy-1790596712241.bak, declarative_performance_observer.db*, Partitions/*, letterheads/, receipts/, caches)', 'release/ (old installer + win-unpacked)', 'src/renderer/dist (old renderer build)'];
  m.uninstalled = 'no old version was installed (nothing in Windows Apps list, Program Files or shortcuts)';
  m.fixes = [
    { problem: 'Backup file was missing recent data (only pos.db was copied while the database keeps new writes in the WAL file; backup had 2 of 11 products)', fix: 'Backup now uses SQLite online backup, which writes one complete consistent file', files: 'src/main/ipc/backup.ipc.js', commit: 'f75c079', checks: ['DAT-BK', 'BAK-01'] },
    { problem: 'No busy_timeout on the database', fix: 'busy_timeout = 5000 ms so a briefly locked database waits instead of failing', files: 'src/main/db/connection.js', commit: 'bd5e0ed', checks: ['TWO-01'] },
    { problem: 'Scanning a barcode sent focus to the Quantity box; the next scan was typed into it (3 quick scans gave a Rs 300.9M line and an empty cart)', fix: 'A scan adds one unit straight to the cart and keeps focus in the search box; stock is checked including what is already in the cart', files: 'src/renderer/pages/POS/Sale.jsx', commit: '4a7f181', checks: ['SEL-02', 'SEL-03', 'SEL-03b'] },
    { problem: 'Server accepted negative discount, discount bigger than the bill, negative payment, zero/negative/NaN quantity, wrong line totals, and did not enforce the cashier discount cap', fix: 'sales:create/update now validate all of these in the main process and enforce the cashier cap (Admin has none)', files: 'src/main/ipc/sales.ipc.js', commit: '3155ee1', checks: ['DIS-01', 'DIS-02', 'DIS-03', 'DIS-04', 'DIS-05', 'DIS-06', 'DIS-07', 'DIS-08'] },
    { problem: 'Very fast back-to-back scans were glued together (S1 saved 30 instead of 270)', fix: 'Search box is emptied immediately on Enter before the lookup; scans not yet drawn are counted in the stock check', files: 'src/renderer/pages/POS/Sale.jsx', commit: '622ee8f', checks: ['S1', 'S2', 'S3', 'S5', 'S6'] },
    { problem: 'A voided bill number could be given to the next sale', fix: 'The last invoice number issued for the day is remembered (settings key) and never goes back down', files: 'src/main/ipc/sales.ipc.js', commit: '0b436b4', checks: ['VOID-02'] },
  ];
  m.manual = [
    'Real barcode scanner hardware', 'Real thermal printer (receipt look, paper running out, unplugging it)', 'Real power cut and laptop sleep', 'USB backup to a real drive',
    'Screen readability on the shop laptop', 'Ease of use for a non-technical person', 'Go-live checklist in the shop',
  ];
  m.notes = m.notes || {};
  m.notes['SETUP'] = 'NOTE: this build has NO activation or key pool (removed in migration 035). Section 1 (Activation) is therefore NOT APPLICABLE; the first-run setup screen is the only gate. No key was used or consumed.';
  m.notes['DISCOUNTS'] = 'NOTE: there is no tax feature and no item-level discount in the app; those tests are NOT APPLICABLE and need an owner decision if wanted.';
  m.notes['TWO APPS'] = 'NOTE: both apps are ONE process with two windows (not two processes). Tests use two windows of the same process.';
  m.open = m.open || [];
  for (const o of [
    'NEEDS DECISION: tax (5%) does not exist in the app. Add it, or leave it out?',
    'NEEDS DECISION: customer credit limit is stored but not enforced. Block credit sales above the limit?',
    'NEEDS DECISION: barcodes belong to Types, not pack sizes, so Box barcodes 1002 and 1005 cannot exist. Add a barcode per pack size?',
    'NEEDS DECISION: quantities may be decimals for any item (no "whole numbers only" flag per product).',
    'NOT RUN: 10,000-item / 50,000-sale speed database, dates (11:59 PM / month-end / 29 Feb) and the Urdu/emoji sweep of every field were not run in this one-hour pass.',
    'NOT FIXED: the unit price in a sale is still taken from the screen (main process checks quantity x price = line total, but does not re-look-up the price).',
    'No cash drawer / opening cash screen exists, so "cash 4,730" was computed from the database, not read from a screen.',
  ]) if (!m.open.includes(o)) m.open.push(o);
});
console.log('meta.json updated');
