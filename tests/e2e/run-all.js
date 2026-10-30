// One orchestrator for the whole visible run: node tests/e2e/run-all.js [script names...]
// TEST_SPEED=slow|normal|fast (default slow). Refuses to start while another run is active.
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const LOCK = path.join(ROOT, 'test-results', '.run.lock');
fs.mkdirSync(path.dirname(LOCK), { recursive: true });
try {
  const pid = Number(fs.readFileSync(LOCK, 'utf8'));
  if (pid) { try { process.kill(pid, 0); console.error('Another run is active (pid ' + pid + '). Stop it first.'); process.exit(2); } catch { /* stale lock */ } }
} catch { /* no lock */ }
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch { /* ignore */ } });

const ALL = ['00-setup', '01-data', '02-login', '03a-restore', '03-shopday', '03b-shopday-admin', '03c-shopday-verify', '04-checks', '05-ops', '06-concurrency-crash', '07-stage1-ui', '08-bombard-dates-load', '09-screenshots-ui'];
const list = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
if (list.includes('00-setup') && !process.env.KEEP_DATA) fs.writeFileSync(path.join(ROOT, 'test-results', 'results.json'), '[]');
for (const name of list) {
  console.log(`\n=== ${name}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], { stdio: 'inherit', cwd: ROOT, env: process.env });
  if (r.status !== 0) console.log(`=== ${name} exited with ${r.status}`);
}
console.log('\n=== ALL DONE');
