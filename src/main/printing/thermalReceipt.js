const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { getDb } = require('../db/connection');
const { buildReceiptData } = require('./receiptData');

function getSettingsMap(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// 58mm ≈ 32 chars/line, 80mm ≈ 42-48 — 42 is a safe middle ground across
// common 80mm ESC/POS fonts.
function widthForPaper(paperWidth) {
  return paperWidth === '80mm' ? 42 : 32;
}

function money(symbol, n) {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

// Free-text, admin-authored header/footer (Settings > Receipt Header &
// Footer) — printed exactly as typed, one settings line per receipt line.
// The first header line prints bold (a nod to "shop name usually goes
// first"), everything else plain; nothing is assumed about what any line
// actually contains, unlike the old fixed shop_name/address/phone fields.
function printHeaderLines(printerDevice, settings) {
  const lines = (settings.receipt_header_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  printerDevice.alignCenter();
  lines.forEach((line, i) => {
    printerDevice.bold(i === 0);
    printerDevice.println(line);
  });
  printerDevice.bold(false);
}

function printFooterLines(printerDevice, settings) {
  const lines = (settings.receipt_footer_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return;
  printerDevice.drawLine();
  printerDevice.alignCenter();
  lines.forEach((line) => printerDevice.println(line));
}

// Silent, no dialog, no preview — the whole point of a receipt printer in an
// active checkout flow. The sale is already committed to the database by the
// time this runs, so a print failure here is reported back but never rolls
// anything back or blocks the flow that called it.
async function print(saleId, { showDues } = {}) {
  const db = getDb();
  const data = buildReceiptData(saleId, { showDues });
  if (!data) return { success: false, reason: 'Sale not found.' };
  const { sale, items, showDues: applyDues, outstandingBalance } = data;

  const settings = getSettingsMap(db);
  const printerName = settings.thermal_printer_name;
  if (!printerName) {
    return { success: false, reason: 'No thermal printer configured — set one in Settings > Printer Settings.' };
  }

  // `printer` is a native module (raw USB/Windows print-spooler access) —
  // required lazily here, never at module load, so a machine where it fails
  // to load only breaks printing, not the whole app.
  let driver;
  try {
    driver = require('printer');
  } catch {
    return { success: false, reason: 'Could not print receipt — check the printer.' };
  }

  const width = widthForPaper(settings.thermal_paper_width);
  const currency = settings.currency_symbol || 'Rs.';

  try {
    const printerDevice = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `printer:${printerName}`,
      driver,
      width,
      removeSpecialCharacters: false,
    });

    printHeaderLines(printerDevice, settings);
    printerDevice.drawLine();

    printerDevice.alignLeft();
    printerDevice.println(`Invoice: ${sale.invoice_no}`);
    printerDevice.println(`Date: ${sale.created_at}`);
    printerDevice.println(`Cashier: ${sale.cashier_name}`);
    if (sale.customer_name) printerDevice.println(`Customer: ${sale.customer_name}`);
    printerDevice.drawLine();

    for (const item of items) {
      const label =
        item.variant_name && item.variant_name !== 'Standard' ? `${item.product_name} (${item.variant_name})` : item.product_name;
      printerDevice.println(label);
      printerDevice.leftRight(`  ${item.quantity} ${item.unit_name} x ${money(currency, item.unit_price)}`, money(currency, item.line_total));
    }
    printerDevice.drawLine();

    printerDevice.leftRight('Subtotal', money(currency, sale.subtotal));
    if (sale.discount_amount > 0) printerDevice.leftRight('Discount', `-${money(currency, sale.discount_amount)}`);
    printerDevice.bold(true);
    printerDevice.leftRight('Total', money(currency, sale.total_amount));
    printerDevice.bold(false);
    printerDevice.leftRight('Paid', money(currency, sale.paid_amount));
    if (sale.balance_due > 0) printerDevice.leftRight('Balance Due', money(currency, sale.balance_due));
    if (applyDues) {
      printerDevice.bold(true);
      printerDevice.leftRight('Total Outstanding', money(currency, outstandingBalance));
      printerDevice.bold(false);
    }

    printFooterLines(printerDevice, settings);

    printerDevice.cut();

    await printerDevice.execute();
    return { success: true };
  } catch {
    return { success: false, reason: 'Could not print receipt — check the printer.' };
  }
}

// Sends a short test slip immediately — lets the admin confirm the printer
// is wired up correctly without needing to ring up a real sale.
async function testPrint() {
  const db = getDb();
  const settings = getSettingsMap(db);
  const printerName = settings.thermal_printer_name;
  if (!printerName) {
    return { success: false, reason: 'No thermal printer configured — set one first below.' };
  }

  let driver;
  try {
    driver = require('printer');
  } catch {
    return { success: false, reason: 'Could not print — check the printer.' };
  }

  const width = widthForPaper(settings.thermal_paper_width);

  try {
    const printerDevice = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `printer:${printerName}`,
      driver,
      width,
      removeSpecialCharacters: false,
    });

    printerDevice.alignCenter();
    printerDevice.println('Test print successful');
    printHeaderLines(printerDevice, settings);
    printerDevice.println(new Date().toLocaleString());
    printerDevice.cut();

    await printerDevice.execute();
    return { success: true };
  } catch {
    return { success: false, reason: 'Could not print — check the printer.' };
  }
}

// Same silent USB print approach as print(saleId) above, but for a payment
// receipt (customer or supplier) instead of a retail sale — used both when a
// payment is first recorded from the Ledgers module and for the Reprint
// action on Payment History.
async function printPaymentReceipt(paymentId) {
  const db = getDb();
  const payment = db
    .prepare(
      `SELECT p.*, u.full_name AS recorded_by_name,
              CASE WHEN p.party_type = 'customer' THEN c.name ELSE s.name END AS party_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.received_by
       LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
       LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
       WHERE p.id = ?`
    )
    .get(paymentId);
  if (!payment) return { success: false, reason: 'Payment not found.' };

  const settings = getSettingsMap(db);
  const printerName = settings.thermal_printer_name;
  if (!printerName) {
    return { success: false, reason: 'No thermal printer configured — set one in Settings > Printer Settings.' };
  }

  let driver;
  try {
    driver = require('printer');
  } catch {
    return { success: false, reason: 'Could not print receipt — check the printer.' };
  }

  const width = widthForPaper(settings.thermal_paper_width);
  const currency = settings.currency_symbol || 'Rs.';

  try {
    const printerDevice = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `printer:${printerName}`,
      driver,
      width,
      removeSpecialCharacters: false,
    });

    printHeaderLines(printerDevice, settings);
    printerDevice.drawLine();

    printerDevice.alignLeft();
    printerDevice.println(`Payment Receipt #${payment.id}`);
    printerDevice.println(`Date: ${payment.created_at}`);
    printerDevice.println(`${payment.party_type === 'customer' ? 'Customer' : 'Supplier'}: ${payment.party_name || '—'}`);
    printerDevice.println(`Recorded By: ${payment.recorded_by_name || '—'}`);
    if (payment.note) printerDevice.println(`Note: ${payment.note}`);
    printerDevice.drawLine();

    printerDevice.bold(true);
    printerDevice.leftRight('Amount', money(currency, payment.amount));
    printerDevice.bold(false);
    printerDevice.leftRight('Method', payment.payment_method);

    printFooterLines(printerDevice, settings);

    printerDevice.cut();

    await printerDevice.execute();
    return { success: true };
  } catch {
    return { success: false, reason: 'Could not print receipt — check the printer.' };
  }
}

module.exports = { print, testPrint, printPaymentReceipt };
