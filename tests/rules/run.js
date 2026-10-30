// Stage 1 rules-check runner. Prints PASS/FAIL per check ID.
//   ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe tests/rules/run.js [r05 r12 ...]
// (npm run test:rules does the same.)
const path = require('path');
const fs = require('fs');
const t = require('./lib/harness');

const only = process.argv.slice(2).map((s) => s.toLowerCase());
const dir = path.join(__dirname, 'checks');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => !only.length || only.some((o) => f.toLowerCase().startsWith(o)))
  .sort();

const results = [];

async function main() {
  for (const file of files) {
    const mod = require(path.join(dir, file));
    t.freshDb();
    const check = async (id, desc, fn) => {
      let ok = false;
      let note = '';
      try {
        const r = await fn();
        ok = r === undefined ? true : !!r;
        if (!ok) note = 'returned false';
      } catch (err) {
        note = err && err.message ? err.message : String(err);
      }
      results.push({ id, ok, desc, note });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${desc}${ok ? '' : `  -- ${note}`}`);
    };
    try {
      await mod(t, check);
    } catch (err) {
      results.push({ id: `${file}`, ok: false, desc: 'check file crashed', note: err.stack || err.message });
      console.log(`FAIL ${file}  check file crashed -- ${err.stack || err.message}`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed, ${results.length} checks`);
  t.cleanup();
  process.exit(failed.length ? 1 : 0);
}

main();
