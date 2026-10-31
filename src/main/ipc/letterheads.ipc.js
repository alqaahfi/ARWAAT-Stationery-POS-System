const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { PDFDocument, PageSizes, StandardFonts, rgb } = require('pdf-lib');
const { getDb } = require('../db/connection');
const { showOpenDialog, showSaveDialog } = require('../system/fileDialog');
const { buildLetterheadDocx } = require('../printing/docxTemplate');

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
  const result = await showOpenDialog({
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
  const { count: supplierCount } = db.prepare('SELECT COUNT(*) AS count FROM suppliers WHERE assigned_letterhead_id = ?').get(id);
  if (supplierCount > 0) {
    return { success: false, reason: `${supplierCount} supplier${supplierCount === 1 ? '' : 's'} still ${supplierCount === 1 ? 'has' : 'have'} this letterhead assigned — reassign or clear it first.` };
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

async function generateLetterheadTemplatePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const MM_TO_PT = 2.83465;
  const mm = (n) => n * MM_TO_PT;

  const headerHeight = mm(40);
  const footerHeight = mm(25);
  const marginSide = mm(20);

  // 1. Header Safe Zone (top 40 mm)
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: rgb(0.2, 0.45, 0.8),
    borderWidth: 1.5,
  });

  page.drawText('HEADER ZONE (Top 40 mm)', {
    x: marginSide,
    y: height - mm(12),
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.3, 0.65),
  });
  page.drawText('Design your shop logo, shop name, address, contact numbers, and header graphics here.', {
    x: marginSide,
    y: height - mm(19),
    size: 9,
    font,
    color: rgb(0.2, 0.25, 0.35),
  });
  page.drawText('Default top content margin in settings: 40 mm (invoice text starts below this line).', {
    x: marginSide,
    y: height - mm(26),
    size: 8.5,
    font,
    color: rgb(0.3, 0.4, 0.5),
  });
  page.drawText('[ Tip: You can adjust the top margin in Settings > Letterheads if your header is taller or shorter ]', {
    x: marginSide,
    y: height - mm(33),
    size: 8,
    font,
    color: rgb(0.25, 0.45, 0.7),
  });

  // 2. Middle Content Zone (~232 mm)
  const contentHeight = height - headerHeight - footerHeight;
  page.drawRectangle({
    x: 0,
    y: footerHeight,
    width,
    height: contentHeight,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const centerText = (str, yPos, size, isBold, color) => {
    const f = isBold ? fontBold : font;
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, {
      x: (width - w) / 2,
      y: yPos,
      size,
      font: f,
      color,
    });
  };

  const midY = footerHeight + contentHeight / 2;
  centerText('INVOICE CONTENT ZONE (~232 mm)', midY + mm(24), 14, true, rgb(0.2, 0.25, 0.35));
  centerText('LEAVE THIS MIDDLE AREA BLANK / WHITE IN YOUR PRE-PRINTED DESIGN', midY + mm(16), 10, true, rgb(0.4, 0.45, 0.55));
  centerText('The ARWAAT POS print engine will dynamically stamp invoice data here:', midY + mm(7), 9, false, rgb(0.3, 0.35, 0.45));
  centerText('* Customer name, phone, invoice number, date, time & cashier name', midY - mm(1), 8.5, false, rgb(0.4, 0.45, 0.5));
  centerText('* Item table: Product name, pack size, quantity, unit price & line total', midY - mm(8), 8.5, false, rgb(0.4, 0.45, 0.5));
  centerText('* Financial summary: Subtotal, item discounts, bill discount, tax & grand total', midY - mm(15), 8.5, false, rgb(0.4, 0.45, 0.5));
  centerText('* Payment breakdown: Cash received, change returned, and remaining customer dues', midY - mm(22), 8.5, false, rgb(0.4, 0.45, 0.5));
  centerText('Side margins used during printing: 20 mm left and right', midY - mm(30), 8, true, rgb(0.5, 0.55, 0.65));

  // 3. Footer Zone (bottom 25 mm)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: footerHeight,
    color: rgb(0.94, 0.97, 0.94),
    borderColor: rgb(0.25, 0.6, 0.3),
    borderWidth: 1.5,
  });

  // Reserved band: the lowest 12 mm carries the ARWAAT credit line on every printed page.
  page.drawRectangle({ x: 0, y: 0, width, height: mm(12), color: rgb(0.97, 0.88, 0.88), borderColor: rgb(0.75, 0.25, 0.25), borderWidth: 1 });
  page.drawText('RESERVED 12 mm - keep empty (ARWAAT credit line is printed here)', { x: marginSide, y: mm(5), size: 8, font: fontBold, color: rgb(0.6, 0.15, 0.15) });

  page.drawText('FOOTER ZONE (Bottom 25 mm)', {
    x: marginSide,
    y: footerHeight - mm(6),
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.42, 0.18),
  });
  page.drawText('Place bank account details, payment terms, return policy, and signatures here.', {
    x: marginSide,
    y: footerHeight - mm(11),
    size: 9,
    font,
    color: rgb(0.2, 0.3, 0.25),
  });
  page.drawText('NOTICE: The bottom 12 mm carries the system credit line (Powered by ARWAAT POS System). Keep essential text above 12 mm.', {
    x: marginSide,
    y: footerHeight - mm(20),
    size: 7.5,
    font: fontBold,
    color: rgb(0.55, 0.2, 0.2),
  });

  return await doc.save();
}

async function downloadTemplate() {
  const result = await showSaveDialog({
    title: 'Download Letterhead A4 Design Template',
    defaultPath: 'ARWAAT-Letterhead-A4-Template.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  try {
    const pdfBytes = await generateLetterheadTemplatePdf();
    fs.writeFileSync(result.filePath, Buffer.from(pdfBytes));
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, reason: `Could not save template: ${err.message}` };
  }
}

// Editable Word version of the template: A4, header/footer zones, bottom 12 mm kept free for
// the ARWAAT credit line. The owner designs in Word, saves as PDF and uploads it.
async function downloadWordTemplate() {
  const result = await showSaveDialog({
    title: 'Download Letterhead Word Template',
    defaultPath: 'ARWAAT-Letterhead-A4-Template.docx',
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, buildLetterheadDocx());
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, reason: `Could not save template: ${err.message}` };
  }
}

function registerLetterheadsIpc() {
  ipcMain.handle('letterheads:list', () => list());
  ipcMain.handle('letterheads:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('letterheads:pick-pdf', () => pickPdf());
  ipcMain.handle('letterheads:create', (event, payload) => create(payload || {}));
  ipcMain.handle('letterheads:update', (event, payload) => update(payload || {}));
  ipcMain.handle('letterheads:delete', (event, { id } = {}) => remove(id));
  ipcMain.handle('letterheads:download-template', () => downloadTemplate());
  ipcMain.handle('letterheads:download-word-template', () => downloadWordTemplate());
}

module.exports = { registerLetterheadsIpc };
