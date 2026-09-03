// scripts/generate-dev-panel-hash.js
//
// Run this once to get the bcrypt hash to seed into dev_panel_config, and
// again any time you want to change the Dev Panel password. This keeps the
// actual password out of the app's source code entirely.
//
// Usage: node scripts/generate-dev-panel-hash.js "yourNewPassword"

const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/generate-dev-panel-hash.js "yourPassword"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nDev Panel password hash:\n');
console.log(hash);
console.log('\nTo apply it, run this SQL against the target pos.db file (DB Browser or sqlite3 CLI):\n');
console.log(
  `INSERT INTO dev_panel_config (id, password_hash) VALUES (1, '${hash}')\n` +
  `ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash;\n`
);
