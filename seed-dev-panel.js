const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'stationary-pos-app', 'pos.db');
const db = new Database(dbPath);

const hash = '$2b$10$8bm06Ohe1rJYucfyc8ZQkuic8/74uM3kTfW99oxHedafycSsoLXNS';

db.prepare(`
  INSERT INTO dev_panel_config (id, password_hash) VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash
`).run(hash);

console.log('Done');
db.close();