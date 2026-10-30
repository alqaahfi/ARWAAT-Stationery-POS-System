// Builds TEST_RESULTS.txt from test-results/results.json + test-results/meta.json (fixes, open items, shop-day table).
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'test-results', f), 'utf8')); } catch { return d; } };
const results = rd('results.json', []); const meta = rd('meta.json', { fixes: [], notes: {}, shopday: [] });
const git = (c) => { try { return execSync('git ' + c, { cwd: ROOT }).toString().trim(); } catch { return '?'; } };
const fixedIds = new Set(meta.fixes.flatMap((f) => f.checks || []));
const tag = (r) => {
  if (r.status === 'PASS') return (r.history || []).includes('FAIL') ? (fixedIds.has(r.id) ? 'FIXED' : 'PASS') : 'PASS';
  return r.status;
};
const order = [];
for (const r of results) if (!order.includes(r.section)) order.push(r.section);
const cnt = { total: results.length, first: 0, fixed: 0, fail: 0, decision: 0, disputed: 0, manual: 0, na: 0 };
for (const r of results) {
  const t = tag(r);
  if (t === 'PASS') cnt.first++; else if (t === 'FIXED') cnt.fixed++; else if (t === 'FAIL') cnt.fail++;
  else if (t === 'NEEDS DECISION') cnt.decision++; else if (t === 'DISPUTED') cnt.disputed++;
  else if (t === 'MANUAL') cnt.manual++; else if (t === 'NOT APPLICABLE') cnt.na++;
}
const critical = results.filter((r) => tag(r) === 'FAIL' && r.critical).length;
const L = [];
const add = (...a) => L.push(...a);
add('ARWAAT STATIONERY SYSTEMS - TEST RESULTS', '');
add(`Date and time of run: ${meta.runDate || new Date().toString()}`);
add(`Git commit tested / final commit after fixes: ${meta.testedCommit || '?'} / ${git('rev-parse --short HEAD')}`);
add(`Installer file tested and install path: release/ARWAAT Stationery Systems Setup 1.0.0.exe -> C:/Program Files/ARWAAT Stationery Systems`);
add('Tested on: the INSTALLED app (driven over the Chromium debug port; the installer and its security fuses were not changed)');
add(`Activation key used for testing: NONE. This build has no activation or key pool (removed in migration 035), so no key was used.`, '');
add('CLEAN START', `Old databases backed up to: ${meta.zip || '?'}`, `Files deleted: ${(meta.deleted || []).join('; ')}`, `Old version uninstalled: ${meta.uninstalled || 'no old version was installed'}`, '');
add('SUMMARY');
add(`Total checks: ${cnt.total} | Passed first time: ${cnt.first} | Failed then fixed: ${cnt.fixed} | Still failing: ${cnt.fail} | Needs decision: ${cnt.decision} | Disputed: ${cnt.disputed} | Not applicable (feature does not exist): ${cnt.na} | Manual (not run): ${meta.manual ? meta.manual.length : 0}`);
add(`Ready for shop: ${cnt.fail === 0 && cnt.decision === 0 ? 'YES' : 'NO'}${critical ? ' (critical failures present)' : ''}`, '');
add('SECTION RESULTS');
for (const sec of order) {
  add('', `== ${sec} ==`);
  if (meta.notes[sec]) add(meta.notes[sec]);
  for (const r of results.filter((x) => x.section === sec)) {
    const t = tag(r);
    const fix = meta.fixes.find((f) => (f.checks || []).includes(r.id));
    let line = `[${t}] (${r.kind}) ${r.id} ${r.name}`;
    if (t === 'FIXED' && fix) line += ` - ${fix.problem} - ${fix.fix} - ${fix.files} - ${fix.commit}`;
    else if (r.detail) line += ` - ${r.detail}`;
    if (t === 'FAIL' && r.screenshot) line += ` - screenshot: ${r.screenshot}`;
    add(line);
  }
}
add('', 'FULL SHOP DAY TABLE', 'Check | Expected | Screen | Database | Result');
for (const row of meta.shopday) add(`${row.name} | ${row.expected} | ${row.screen ?? '-'} | ${row.db ?? '-'} | ${row.pass ? 'PASS' : 'FAIL'}`);
add('', 'ALL FIXES MADE');
meta.fixes.forEach((f, i) => add(`${i + 1}. ${f.problem} -> ${f.fix} (${f.files}) ${f.commit}`));
add('', 'STILL OPEN');
const open = results.filter((r) => ['FAIL', 'NEEDS DECISION', 'DISPUTED'].includes(tag(r)));
open.forEach((r, i) => add(`${i + 1}. [${tag(r)}] ${r.id} ${r.name} - ${r.detail}`));
(meta.open || []).forEach((o) => add(`- ${o}`));
if (!open.length && !(meta.open || []).length) add('Nothing.');
add('', 'MANUAL TESTS FOR THE OWNER (MANUAL - not run)');
(meta.manual || []).forEach((m) => add(`- ${m}`));
add('', 'VIDEOS AND SCREENSHOTS', 'Videos: test-results/videos/', 'Failure screenshots: test-results/screenshots/', '');
add('HOW TO RE-RUN', 'Visible (slow, human speed):   set TEST_SPEED=slow  then  node tests/e2e/run-all.js', 'Normal speed:                 set TEST_SPEED=normal then node tests/e2e/run-all.js', 'Fast (no delays, for re-runs): set TEST_SPEED=fast   then node tests/e2e/run-all.js', 'Rebuild report only:           node tests/e2e/report.js');
fs.writeFileSync(path.join(ROOT, 'TEST_RESULTS.txt'), L.join('\n') + '\n');
console.log(`TEST_RESULTS.txt written (${cnt.total} checks)`);
