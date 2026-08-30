const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/connection');

function letterheadsDir() {
  const dir = path.join(app.getPath('userData'), 'letterheads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function list() {
  const db = getDb();
  return db.prepare('SELECT id, name, image_path, is_default, created_at FROM letterheads ORDER BY name').all();
}

function getById(id) {
  const db = getDb();
  return db.prepare('SELECT id, name, image_path, is_default, created_at FROM letterheads WHERE id = ?').get(id);
}

// Native file picker rather than an HTML <input type="file"> — Electron's
// contextIsolation makes pulling a real filesystem path back out of a File
// object unreliable across versions, and every other export/import flow in
// this app already goes through a native dialog, so this stays consistent.
// The picked file is copied into userData so the letterhead survives even if
// the original file is later moved or deleted.
async function pickImage() {
  const result = await dialog.showOpenDialog({
    title: 'Choose Letterhead Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  const src = result.filePaths[0];
  const destName = `${Date.now()}_${path.basename(src)}`;
  const dest = path.join(letterheadsDir(), destName);
  fs.copyFileSync(src, dest);
  return { canceled: false, imagePath: dest };
}

function create({ name, imagePath, isDefault }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Name is required.' };
  if (!imagePath) return { success: false, reason: 'Please choose an image.' };

  const run = db.transaction(() => {
    if (isDefault) db.prepare('UPDATE letterheads SET is_default = 0').run();
    const result = db
      .prepare('INSERT INTO letterheads (name, image_path, is_default) VALUES (?, ?, ?)')
      .run(name.trim(), imagePath, isDefault ? 1 : 0);
    return result.lastInsertRowid;
  });

  return { success: true, id: run() };
}

// imagePath is optional here — omitting it (editing without picking a new
// image) leaves the existing file in place via COALESCE.
function update({ id, name, imagePath, isDefault }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Name is required.' };

  const run = db.transaction(() => {
    if (isDefault) db.prepare('UPDATE letterheads SET is_default = 0').run();
    db.prepare('UPDATE letterheads SET name = ?, image_path = COALESCE(?, image_path), is_default = ? WHERE id = ?').run(
      name.trim(),
      imagePath || null,
      isDefault ? 1 : 0,
      id
    );
  });
  run();

  return { success: true };
}

function registerLetterheadsIpc() {
  ipcMain.handle('letterheads:list', () => list());
  ipcMain.handle('letterheads:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('letterheads:pick-image', () => pickImage());
  ipcMain.handle('letterheads:create', (event, payload) => create(payload || {}));
  ipcMain.handle('letterheads:update', (event, payload) => update(payload || {}));
}

module.exports = { registerLetterheadsIpc };
