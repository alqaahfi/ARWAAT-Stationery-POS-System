// test-results/meta.json: extra info the report needs (fixes, notes, shop-day table, manual list, open items).
const fs = require('fs'); const path = require('path');
const F = path.join(__dirname, '..', '..', '..', 'test-results', 'meta.json');
function load() { try { return JSON.parse(fs.readFileSync(F, 'utf8')); } catch { return { fixes: [], notes: {}, shopday: [], open: [], manual: [] }; } }
function update(fn) { const m = load(); fn(m); fs.writeFileSync(F, JSON.stringify(m, null, 2)); }
module.exports = { load, update, F };
