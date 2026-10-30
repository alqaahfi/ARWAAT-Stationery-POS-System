const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

let db = null;
let schemaVersion = 0;

// Why the shop data could not be opened safely at start-up. index.js shows the
// recovery screen instead of the app (see update/recovery.js).
//   kind: 'integrity' (file damaged / unreadable), 'migration' (an update step failed),
//         'newer' (data was made by a newer version of the app)
class StartupProblem extends Error {
  constructor(kind, message, detail) {
    super(message);
    this.name = 'StartupProblem';
    this.kind = kind;
    this.detail = detail || '';
  }
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'pos.db');
}

function migrationNumber(filename) {
  const m = /^(\d+)/.exec(String(filename));
  return m ? parseInt(m[1], 10) : 0;
}

function pendingUpdateRecord() {
  try {
    return require('../update/pendingUpdate').readPending();
  } catch {
    return null;
  }
}

function initDatabase() {
  const dbPath = getDbPath();
  const pending = pendingUpdateRecord();
  let handle;
  try {
    handle = new Database(dbPath);
    handle.pragma('foreign_keys = ON');
    handle.pragma('journal_mode = WAL');
    // Wait (instead of failing at once) if another connection briefly holds the write lock.
    handle.pragma('busy_timeout = 5000');
    // First thing, before anything touches the data: after an update the full check, otherwise the quick one.
    const result = handle.pragma(pending ? 'integrity_check' : 'quick_check', { simple: true });
    if (result !== 'ok') throw new StartupProblem('integrity', 'The database failed its safety check.', String(result).slice(0, 300));
  } catch (err) {
    if (handle) {
      try {
        handle.close();
      } catch {
        // already closed
      }
    }
    if (err instanceof StartupProblem) throw err;
    throw new StartupProblem('integrity', 'The database could not be opened.', err && err.message ? err.message : String(err));
  }

  db = handle;
  try {
    runMigrations(pending);
  } catch (err) {
    closeDatabase();
    throw err;
  }
  return db;
}

// Table rebuilds switch foreign keys off (a no-op inside a transaction) and a few older
// files carry their own BEGIN/COMMIT. Those are handled here instead, so every
// migration still runs as ONE transaction.
function stripTransactionControl(sql) {
  return sql.replace(/^[ \t]*(PRAGMA\s+foreign_keys\s*=\s*(ON|OFF)|BEGIN\s+TRANSACTION|COMMIT)\s*;[ \t]*$/gim, '');
}

// One migration = one transaction; it is recorded as applied only if it fully succeeded.
function applyMigration(migrationsDir, file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const managesForeignKeys = /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql);
  if (managesForeignKeys) db.pragma('foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    try {
      db.exec(managesForeignKeys ? stripTransactionControl(sql) : sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // nothing open
      }
      throw err;
    }
  } finally {
    if (managesForeignKeys) db.pragma('foreign_keys = ON');
  }
}

// A consistent copy of existing data before any pending step runs (skipped when an
// update just took its own pre-update backup).
function safetyCopyBeforeMigrating(pending) {
  if (pending && pending.backupPath && fs.existsSync(pending.backupPath)) return;
  try {
    const folder = path.join(app.getPath('userData'), 'backups', 'pre-migration');
    fs.mkdirSync(folder, { recursive: true });
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `pre-migration_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;
    db.prepare('VACUUM INTO ?').run(path.join(folder, name));
    const old = fs
      .readdirSync(folder)
      .filter((n) => /^pre-migration_.+\.db$/.test(n))
      .map((n) => ({ n, t: fs.statSync(path.join(folder, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const f of old.slice(5)) fs.rmSync(path.join(folder, f.n), { force: true });
  } catch (err) {
    console.warn('Could not make the safety copy before migrating:', err && err.message);
  }
}

function runMigrations(pending) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedList = db.prepare('SELECT filename FROM _migrations').all().map((r) => r.filename);
  const applied = new Set(appliedList);

  // Downgrade guard: data that already has steps newer than anything this app knows.
  const known = new Set(files);
  const newestKnown = Math.max(0, ...files.map(migrationNumber));
  const unknownNewer = appliedList.filter((f) => !known.has(f) && migrationNumber(f) > newestKnown);
  if (unknownNewer.length) {
    throw new StartupProblem(
      'newer',
      'This data was made by a newer version of ARWAAT.',
      `The data has update step ${unknownNewer.sort().pop()}, which this version doesn't know.`
    );
  }

  const todo = files.filter((f) => !applied.has(f));
  if (todo.length && appliedList.length > 0) safetyCopyBeforeMigrating(pending);

  for (const file of todo) {
    console.log(`Applying migration: ${file}`);
    try {
      applyMigration(migrationsDir, file);
    } catch (err) {
      throw new StartupProblem('migration', `An update step failed.`, `Step ${file} failed: ${err && err.message ? err.message : err}`);
    }
  }

  schemaVersion = Math.max(0, ...db.prepare('SELECT filename FROM _migrations').all().map((r) => migrationNumber(r.filename)));
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// Number of the newest migration applied to this database (sync refuses to run
// between computers whose numbers differ).
function getSchemaVersion() {
  return schemaVersion;
}

// Backup & Restore needs the file handle released before it can safely copy
// over pos.db (SQLite's WAL files also need to be checkpointed/closed first,
// which db.close() does).
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDb, getDbPath, closeDatabase, getSchemaVersion, StartupProblem };
