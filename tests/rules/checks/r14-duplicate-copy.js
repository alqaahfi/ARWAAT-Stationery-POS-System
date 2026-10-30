// Rule 14: the first print after saving is the original; reprints say DUPLICATE COPY + reprint date/time.
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 100 });
  const rd = t.m('printing/receiptData');
  const s = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');

  await check('R14-01', 'before any print the receipt (and its preview) is the original', async () => {
    const r = await t.invoke('sales:get-receipt-data', { saleId: s.saleId }, 'cashier');
    assert.strictEqual(r.duplicate, false);
    assert.deepStrictEqual(r.stampLines, []);
  });

  await check('R14-02', 'a print that fails (no printer) is not counted as printed', async () => {
    const r = await t.invoke('printing:print-sale', { saleId: s.saleId, printType: 'retail-thermal' }, 'cashier');
    assert.strictEqual(r.success, false);
    assert.strictEqual(d.prepare('SELECT COUNT(*) AS n FROM sale_prints').get().n, 0);
  });

  await check('R14-03', 'first recorded print = original; after it every print/preview says DUPLICATE COPY + time', async () => {
    assert.strictEqual(rd.recordSalePrint(s.saleId, { printType: 'retail-thermal', userId: t.users.cashier }), 'original');
    const r = await t.invoke('sales:get-receipt-data', { saleId: s.saleId }, 'cashier');
    assert.strictEqual(r.duplicate, true);
    assert.strictEqual(r.stampLines[0], 'DUPLICATE COPY');
    assert.ok(/^Reprinted \d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(r.stampLines[1]), r.stampLines[1]);
    assert.strictEqual(rd.recordSalePrint(s.saleId, { printType: 'wholesale-a4' }), 'duplicate');
  });

  await check('R14-04', 'every print path uses the same stamp lines (thermal, A4 letterhead, A4 fallback, preview)', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (p) => fs.readFileSync(path.join(t.ROOT, p), 'utf8');
    assert.ok(read('src/main/printing/thermalReceipt.js').includes('data.stampLines'));
    assert.ok(read('src/main/printing/pdfInvoiceMerge.js').includes('data.stampLines'));
    assert.ok(read('src/main/printing/printA4Invoice.js').includes('buildReceiptData'));
    assert.ok(read('src/renderer/components/receipt/ThermalContent.jsx').includes('stampLines'));
    assert.ok(read('src/renderer/pages/Print/PrintInvoice.jsx').includes('stampLines'));
  });

  await check('R14-05', 'a voided bill reprint says VOIDED and DUPLICATE COPY', async () => {
    assert.ok((await t.invoke('sales:void', { saleId: s.saleId }, 'admin')).success);
    const r = await t.invoke('sales:get-receipt-data', { saleId: s.saleId }, 'cashier');
    assert.ok(r.stampLines[0].includes('VOIDED'));
    assert.ok(r.stampLines.includes('DUPLICATE COPY'));
  });

  await check('R14-06', 'prints sync (insert-only) and are cleared by factory reset', () => {
    assert.strictEqual(t.m('sync/syncSchema').SYNC_TABLES.sale_prints.kind, 'insert_only');
    assert.ok(d.prepare("SELECT 1 FROM sync_outbox WHERE table_name = 'sale_prints'").get());
    const sys = require('fs').readFileSync(require('path').join(t.MAIN, 'ipc/system.ipc.js'), 'utf8');
    assert.ok(sys.includes("'sale_prints'"));
  });
};
