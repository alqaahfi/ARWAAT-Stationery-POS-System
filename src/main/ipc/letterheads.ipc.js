const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/connection');

function letterheadsDir() {
  const dir = path.join(app.getPath('userData'), 'letterheads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SELECT_COLUMNS = 'id, name, pdf_template_path, content_margin_top_mm, content_margin_bottom_mm, is_default, created_at';

function list() {
  const db = getDb();
  return db.prepare(`SELECT ${SELECT_COLUMNS} FROM letterheads ORDER BY name`).all();
}

function getById(id) {
  const db = getDb();
  return db.prepare(`SELECT ${SELECT_COLUMNS} FROM letterheads WHERE id = ?`).get(id);
}

// Native file picker rather than an HTML <input type="file"> — Electron's
// contextIsolation makes pulling a real filesystem path back out of a File
// object unreliable across versions, and every other export/import flow in
// this app already goes through a native dialog, so this stays consistent.
// The picked PDF is copied into userData so the letterhead survives even if
// the original file is later moved or deleted.
async function pickPdf() {
  const result = await dialog.showOpenDialog({
    title: 'Choose Letterhead PDF (A4 page)',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  const src = result.filePaths[0];
  const destName = `${Date.now()}_${path.basename(src)}`;
  const dest = path.join(letterheadsDir(), destName);
  fs.copyFileSync(src, dest);
  return { canceled: false, pdfTemplatePath: dest };
}

function create({ name, pdfTemplatePath, contentMarginTopMm, contentMarginBottomMm, isDefault }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Name is required.' };
  if (!pdfTemplatePath) return { success: false, reason: 'Please choose a PDF template.' };

  const run = db.transaction(() => {
    // The shop's very first letterhead is forced default regardless of the
    // checkbox — with nothing else it could mean, requiring the admin to
    // remember to flip "Set as default" is just a trap where a freshly
    // uploaded (and only) letterhead silently never gets used at print time.
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM letterheads').get();
    const resolvedIsDefault = count === 0 ? true : isDefault;

    if (resolvedIsDefault) db.prepare('UPDATE letterheads SET is_default = 0').run();
    const result = db
      .prepare(
        `INSERT INTO letterheads (name, pdf_template_path, content_margin_top_mm, content_margin_bottom_mm, is_default)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        name.trim(),
        pdfTemplatePath,
        Number(contentMarginTopMm) || 40,
        Number(contentMarginBottomMm) || 25,
        resolvedIsDefault ? 1 : 0
      );
    return result.lastInsertRowid;
  });

  return { success: true, id: run() };
}

// pdfTemplatePath is optional here — omitting it (editing without picking a
// new PDF) leaves the existing template in place via COALESCE.
function update({ id, name, pdfTemplatePath, contentMarginTopMm, contentMarginBottomMm, isDefault }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Name is required.' };

  const run = db.transaction(() => {
    if (isDefault) db.prepare('UPDATE letterheads SET is_default = 0').run();
    db.prepare(
      `UPDATE letterheads
       SET name = ?, pdf_template_path = COALESCE(?, pdf_template_path),
           content_margin_top_mm = ?, content_margin_bottom_mm = ?, is_default = ?
       WHERE id = ?`
    ).run(
      name.trim(),
      pdfTemplatePath || null,
      Number(contentMarginTopMm) || 40,
      Number(contentMarginBottomMm) || 25,
      isDefault ? 1 : 0,
      id
    );
  });
  run();

  return { success: true };
}

// Blocked if any customer still has this letterhead assigned — same
// protective pattern used everywhere else in the app (categories, etc.):
// reassign or clear first, don't silently orphan the reference.
function remove(id) {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM customers WHERE assigned_letterhead_id = ?').get(id);
  if (count > 0) {
    return { success: false, reason: `${count} customer${count === 1 ? '' : 's'} still ${count === 1 ? 'has' : 'have'} this letterhead assigned — reassign or clear it first.` };
  }

  const row = db.prepare('SELECT pdf_template_path FROM letterheads WHERE id = ?').get(id);
  db.prepare('DELETE FROM letterheads WHERE id = ?').run(id);

  if (row && row.pdf_template_path) {
    try {
      fs.unlinkSync(row.pdf_template_path);
    } catch {
      // Missing/already-gone file — not worth failing the delete over.
    }
  }

  return { success: true };
}

function registerLetterheadsIpc() {
  ipcMain.handle('letterheads:list', () => list());
  ipcMain.handle('letterheads:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('letterheads:pick-pdf', () => pickPdf());
  ipcMain.handle('letterheads:create', (event, payload) => create(payload || {}));
  ipcMain.handle('letterheads:update', (event, payload) => update(payload || {}));
  ipcMain.handle('letterheads:delete', (event, { id } = {}) => remove(id));
}

module.exports = { registerLetterheadsIpc };
