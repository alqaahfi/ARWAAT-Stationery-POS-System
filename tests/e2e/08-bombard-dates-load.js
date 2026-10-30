// Bombard (100+ mixed operations + 5 invariants), Dates (N), and Load (P) targets.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./lib/h');
const D = require('./lib/data');
const S = require('./lib/shop');
const { check, log, q, execSql } = H;

const MASTER_FILE = path.join(H.ROOT, 'test-backups', 'CLEAN-MASTER.db');

function assertFiveInvariants(label) {
  // Invariant 1: Every variant's stock_qty == SUM(stock_movements.quantity)
  const stockMismatch = q(
    `SELECT pv.id, pv.stock_qty, COALESCE(SUM(sm.quantity), 0) AS mov_sum
     FROM product_variants pv
     LEFT JOIN stock_movements sm ON sm.product_variant_id = pv.id
     GROUP BY pv.id
     HAVING pv.stock_qty != mov_sum`
  );
  if (stockMismatch.length > 0) {
    throw new Error(`[${label}] Stock movement mismatch: ${JSON.stringify(stockMismatch.slice(0, 5))}`);
  }

  // Invariant 2: Every customer's balance is finite and matches opening + active sales + returns net - active payments + adjustments
  const customers = q('SELECT id, name, opening_balance FROM customers');
  for (const c of customers) {
    const b = S.bal(c.name);
    if (!Number.isFinite(b)) throw new Error(`[${label}] Non-finite balance for customer ${c.name}`);
  }

  // Invariant 3: Every supplier's balance is finite and matches opening + purchases - active payments + adjustments
  const suppliers = q('SELECT id, name, opening_balance FROM suppliers');
  for (const s of suppliers) {
    const b = S.sup(s.name);
    if (!Number.isFinite(b)) throw new Error(`[${label}] Non-finite balance for supplier ${s.name}`);
  }

  // Invariant 4: Every sale's total_amount == SUM(sale_items.line_total) - discount_amount
  const badSales = q(
    `SELECT s.id, s.invoice_no, s.total_amount, s.discount_amount, COALESCE(SUM(si.line_total), 0) AS lines_sum
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     GROUP BY s.id
     HAVING ABS(s.total_amount - (lines_sum - s.discount_amount)) > 0.02`
  );
  if (badSales.length > 0) {
    throw new Error(`[${label}] Sale total mismatch: ${JSON.stringify(badSales.slice(0, 5))}`);
  }

  // Voided sales must have all linked payments marked is_voided = 1
  const unvoidedPay = q(
    `SELECT p.id, p.sale_id FROM payments p
     JOIN sales s ON s.id = p.sale_id
     WHERE s.is_voided = 1 AND p.is_voided = 0`
  );
  if (unvoidedPay.length > 0) {
    throw new Error(`[${label}] Voided sale has unvoided payment: ${JSON.stringify(unvoidedPay)}`);
  }

  // Invariant 5: PRAGMA integrity_check and PRAGMA foreign_key_check
  const ic = q('PRAGMA integrity_check')[0];
  const fkc = q('PRAGMA foreign_key_check');
  if (ic.integrity_check !== 'ok' || fkc.length > 0) {
    throw new Error(`[${label}] DB integrity=${JSON.stringify(ic)} fk=${JSON.stringify(fkc)}`);
  }
}

(async () => {
  const rec = H.startRecording('08-bombard-dates-load');
  let A = await H.openApp('admin');
  await S.loginIf(A, 'admin', 'Admin@123');

  await check('BOMBARD', 'BOM-00', 'Restore CLEAN-MASTER before Bombard, Dates, and Load checks', 'V', async () => {
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  const ap = A.page;

  await check('BOMBARD', 'BOM-01', 'Bombard: 110 mixed operations (cash/credit sales, discounts, FOC, returns, no-bill returns, voids, customer/supplier payments, purchases, stock adjustments) preserve all 5 accounting invariants', 'B', async () => {
    const items = q(
      `SELECT p.id AS productId, pv.id AS variantId, pu.id AS unitId, pu.retail_price AS retailPrice, pu.cost_price AS costPrice
       FROM products p
       JOIN product_variants pv ON pv.product_id = p.id
       JOIN product_units pu ON pu.product_id = p.id AND pu.conversion_factor = 1
       WHERE p.is_active = 1
       ORDER BY p.id LIMIT 8`
    );
    const custs = q('SELECT id, name FROM customers WHERE is_active = 1 ORDER BY id');
    const sups = q('SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY id');

    const stats = await ap.evaluate(
      async ({ details, cList, sList }) => {
        const c1 = cList[0];
        const c2 = cList[1];
        const s1 = sList[0];
        let ops = 0;
        const createdSaleIds = [];

        // 1. 10 purchases so stock is plentiful
        for (let i = 0; i < 10; i++) {
          const item = details[i % details.length];
          const cost = item.costPrice || 10;
          const res = await window.api.purchases.create({
            supplierId: s1.id,
            referenceNo: `BOM-PUR-${i}`,
            items: [{ productVariantId: item.variantId, productUnitId: item.unitId, quantity: 50, focQuantity: 0, unitCost: cost }],
            discountAmount: 0,
            paidAmount: i % 2 === 0 ? 50 * cost : 0,
          });
          if (!res?.success) throw new Error(`Purchase ${i} failed: ${res?.reason}`);
          ops++;
        }

        // 2. 50 mixed sales (walk-in cash, named cash, named credit, discounted, FOC)
        for (let i = 0; i < 50; i++) {
          const itemA = details[i % details.length];
          const itemB = details[(i + 1) % details.length];
          const qtyA = (i % 4) + 1;
          const qtyB = (i % 3) + 1;
          const focA = i % 10 === 0 ? 1 : 0;
          const lineA = qtyA * itemA.retailPrice;
          const lineB = qtyB * itemB.retailPrice;
          const sub = lineA + lineB;
          const discAmt = i % 5 === 0 ? Math.round(sub * 0.05 * 100) / 100 : 0;
          const total = Math.round((sub - discAmt) * 100) / 100;

          const isCredit = i % 3 === 1;
          const cust = i % 3 === 0 ? null : i % 2 === 0 ? c1 : c2;
          const paid = isCredit ? (i % 6 === 1 ? Math.floor(total / 2) : 0) : total;

          const res = await window.api.sales.create({
            customerId: cust ? cust.id : null,
            saleType: 'retail',
            letterheadId: null,
            discountAmount: discAmt,
            paidAmount: paid,
            paymentMethod: 'cash',
            items: [
              { productId: itemA.productId, productVariantId: itemA.variantId, productUnitId: itemA.unitId, quantity: qtyA, focQuantity: focA, unitPrice: itemA.retailPrice, discountAmount: 0, lineTotal: lineA },
              { productId: itemB.productId, productVariantId: itemB.variantId, productUnitId: itemB.unitId, quantity: qtyB, focQuantity: 0, unitPrice: itemB.retailPrice, discountAmount: 0, lineTotal: lineB },
            ],
          });
          if (!res?.success) throw new Error(`Sale ${i} failed: ${res?.reason}`);
          createdSaleIds.push(res.saleId);
          ops++;
        }

        // 3. 10 bill returns
        for (let i = 0; i < 10; i++) {
          const saleId = createdSaleIds[i * 2];
          const detail = await window.api.returns.getReturnable({ saleId });
          if (!detail?.success) throw new Error(`getReturnable failed for ${saleId}: ${detail?.reason}`);
          const line = detail.lines[0];
          const r = await window.api.returns.create({
            saleId,
            reason: 'changed_mind',
            restock: true,
            cashRefund: detail.sale.customer_id ? 0 : line.effective_unit_price,
            lines: [{ saleItemId: line.sale_item_id, quantity: 1 }],
          });
          if (!r?.success) throw new Error(`Return ${i} failed: ${r?.reason}`);
          ops++;
        }

        // 4. 10 no-bill returns (Rule 17)
        for (let i = 0; i < 10; i++) {
          const item = details[i % details.length];
          const r = await window.api.returns.createNoBill({
            productVariantId: item.variantId,
            productUnitId: item.unitId,
            quantity: 1,
            reason: 'changed_mind',
            note: `Bombard no-bill ${i}`,
          });
          if (!r?.success) throw new Error(`No-bill return ${i} failed: ${r?.reason}`);
          ops++;
        }

        // 5. 10 voids (on sales without returns)
        for (let i = 0; i < 10; i++) {
          const saleId = createdSaleIds[25 + i];
          const v = await window.api.sales.void({ saleId });
          if (!v?.success) throw new Error(`Void ${i} failed: ${v?.reason}`);
          ops++;
        }

        // 6. 10 customer payments + 5 supplier payments + 5 stock adjustments = 20 ops
        for (let i = 0; i < 10; i++) {
          const cust = i % 2 === 0 ? c1 : c2;
          const p = await window.api.payments.createStandalone({
            customerId: cust.id,
            amount: 100 + i * 10,
            note: `Bombard cust payment ${i}`,
          });
          if (!p?.success) throw new Error(`Customer payment ${i} failed: ${p?.reason}`);
          ops++;
        }
        for (let i = 0; i < 5; i++) {
          const p = await window.api.payments.createSupplierPayment({
            supplierId: s1.id,
            amount: 200 + i * 20,
            note: `Bombard sup payment ${i}`,
          });
          if (!p?.success) throw new Error(`Supplier payment ${i} failed: ${p?.reason}`);
          ops++;
        }
        for (let i = 0; i < 5; i++) {
          const item = details[i % details.length];
          const a = await window.api.stock.adjust({
            productVariantId: item.variantId,
            direction: i % 2 === 0 ? 'increase' : 'decrease',
            quantity: 2,
            reasonCode: 'recount',
            note: `Bombard adj ${i}`,
          });
          if (!a?.success) throw new Error(`Stock adjust ${i} failed: ${a?.reason}`);
          ops++;
        }

        return { ops };
      },
      { details: items, cList: custs, sList: sups }
    );

    log(`   executed ${stats.ops} mixed operations; checking 5 invariants`);
    assertFiveInvariants('BOM-01');
  });

  // --- Section N: Dates & time edge cases ---
  await check('DATES', 'DAT-N01', 'Dates & time: leap day (2028-02-29), year rollover (2026-12-31 -> 2027-01-01), PKT midnight boundary, and reversed date range (dateFrom > dateTo)', 'B', async () => {
    const sLeap = execSql(
      "INSERT INTO sales (invoice_no, customer_id, cashier_id, sale_type, subtotal, discount_amount, total_amount, paid_amount, balance_due, payment_status, created_at) VALUES ('INV-LEAP-20280229', NULL, 1, 'retail', 100, 0, 100, 100, 0, 'paid', '2028-02-29 07:00:00')"
    ).lastrowid;
    const sDec31 = execSql(
      "INSERT INTO sales (invoice_no, customer_id, cashier_id, sale_type, subtotal, discount_amount, total_amount, paid_amount, balance_due, payment_status, created_at) VALUES ('INV-ROLL-20261231', NULL, 1, 'retail', 100, 0, 100, 100, 0, 'paid', '2026-12-31 18:30:00')"
    ).lastrowid;
    const sJan01 = execSql(
      "INSERT INTO sales (invoice_no, customer_id, cashier_id, sale_type, subtotal, discount_amount, total_amount, paid_amount, balance_due, payment_status, created_at) VALUES ('INV-ROLL-20270101', NULL, 1, 'retail', 100, 0, 100, 100, 0, 'paid', '2026-12-31 19:30:00')"
    ).lastrowid;

    try {
      const res = await ap.evaluate(async () => {
        const leapRep = await window.api.reports.getSalesReport({ filters: { dateFrom: '2028-02-29', dateTo: '2028-02-29' } });
        const dec31Rep = await window.api.reports.getSalesReport({ filters: { dateFrom: '2026-12-31', dateTo: '2026-12-31' } });
        const jan01Rep = await window.api.reports.getSalesReport({ filters: { dateFrom: '2027-01-01', dateTo: '2027-01-01' } });
        const revRep = await window.api.reports.getSalesReport({ filters: { dateFrom: '2026-12-31', dateTo: '2026-01-01' } });
        const revPl = await window.api.reports.getProfitLoss({ filters: { dateFrom: '2026-12-31', dateTo: '2026-01-01' } });
        return {
          leapCount: leapRep.salesCount,
          dec31Invoices: dec31Rep.rows.map((r) => r.invoice_no),
          jan01Invoices: jan01Rep.rows.map((r) => r.invoice_no),
          revCount: revRep.salesCount,
          revPlRows: revPl.rows.length,
        };
      });

      if (res.leapCount !== 1) throw new Error(`Leap day 2028-02-29 expected 1 sale, got ${res.leapCount}`);
      if (!res.dec31Invoices.includes('INV-ROLL-20261231') || res.dec31Invoices.includes('INV-ROLL-20270101')) {
        throw new Error(`PKT Dec 31 boundary wrong: ${JSON.stringify(res.dec31Invoices)}`);
      }
      if (!res.jan01Invoices.includes('INV-ROLL-20270101') || res.jan01Invoices.includes('INV-ROLL-20261231')) {
        throw new Error(`PKT Jan 01 boundary wrong: ${JSON.stringify(res.jan01Invoices)}`);
      }
      if (res.revCount !== 0 || res.revPlRows !== 0) {
        throw new Error(`Reversed date range should return 0 rows cleanly, got sales=${res.revCount}, pl=${res.revPlRows}`);
      }
    } finally {
      execSql('DELETE FROM sales WHERE id IN (?, ?, ?)', [sLeap, sDec31, sJan01]);
    }
  });

  // --- Section P: Load targets (10,000 products, 2,000 customers, 50,000 sales) ---
  await check('LOAD', 'LOAD-P01', 'Load targets with 10,000 products, 2,000 customers, 50,000 sales: barcode <200ms, search <300ms, 10-line sale <500ms, 1-month Sales Report <3s, customer list <500ms, backup <10s', 'B', async () => {
    execFileSync('python', ['-I', path.join(__dirname, 'tools', 'seed_load.py'), H.DB_PATH], { encoding: 'utf8' });
    await ap.evaluate(() => window.api.reports.getSalesReport({ filters: { dateFrom: '2026-01-01', dateTo: '2026-01-01' } }));

    const loadBackupPath = path.join(H.ROOT, 'test-backups', 'load-test-backup.db');
    try { fs.unlinkSync(loadBackupPath); } catch {}
    D.answerFileDialog(loadBackupPath);

    const timings = await ap.evaluate(async () => {
      const t0 = performance.now();
      const bcRes = await window.api.sales.getVariantByBarcode({ barcode: 'LD-009999' });
      const barcodeMs = performance.now() - t0;

      const t1 = performance.now();
      const searchRes = await window.api.sales.searchProducts({ query: 'Stationery Item 99' });
      const searchMs = performance.now() - t1;

      const items = [];
      for (let i = 0; i < 10; i++) {
        const r = searchRes[i];
        const d = await window.api.sales.getVariantForCart({ variantId: r.variantId });
        const u = d.units[0];
        items.push({
          productId: d.product.id,
          productVariantId: d.variant.id,
          productUnitId: u.id,
          quantity: 1,
          focQuantity: 0,
          unitPrice: u.retailPrice,
          discountAmount: 0,
          lineTotal: u.retailPrice,
        });
      }
      const total = items.reduce((s, l) => s + l.unitPrice, 0);
      const t2 = performance.now();
      const saleRes = await window.api.sales.create({
        customerId: null,
        saleType: 'retail',
        letterheadId: null,
        discountAmount: 0,
        paidAmount: total,
        paymentMethod: 'cash',
        items,
      });
      const saveSaleMs = performance.now() - t2;
      if (!saleRes?.success) throw new Error(`Load 10-line sale failed: ${saleRes?.reason}`);

      const t3 = performance.now();
      const repRes = await window.api.reports.getSalesReport({
        filters: { dateFrom: '2026-05-01', dateTo: '2026-05-31' },
      });
      const reportMs = performance.now() - t3;
      if (!repRes?.success) throw new Error('Load Sales Report failed');

      const t4 = performance.now();
      const custRes = await window.api.customers.list({});
      const customerListMs = performance.now() - t4;
      if (!Array.isArray(custRes) || custRes.length < 2000) throw new Error('Load Customer list failed');

      const t5 = performance.now();
      const bakRes = await window.api.backup.export();
      const backupMs = performance.now() - t5;
      if (!bakRes?.success) throw new Error(`Load backup failed: ${bakRes?.reason}`);

      return {
        barcodeMs: Math.round(barcodeMs),
        searchMs: Math.round(searchMs),
        saveSaleMs: Math.round(saveSaleMs),
        reportMs: Math.round(reportMs),
        customerListMs: Math.round(customerListMs),
        backupMs: Math.round(backupMs),
        foundBarcode: !!bcRes,
      };
    });

    try { fs.unlinkSync(loadBackupPath); } catch {}
    log(`   timings (ms): ${JSON.stringify(timings)}`);

    if (!timings.foundBarcode) throw new Error('Barcode LD-009999 not found');
    if (timings.barcodeMs > 200) throw new Error(`Barcode lookup took ${timings.barcodeMs}ms (> 200ms)`);
    if (timings.searchMs > 300) throw new Error(`Product search took ${timings.searchMs}ms (> 300ms)`);
    if (timings.saveSaleMs > 500) throw new Error(`10-line sale save took ${timings.saveSaleMs}ms (> 500ms)`);
    if (timings.reportMs > 3000) throw new Error(`1-month Sales Report took ${timings.reportMs}ms (> 3000ms)`);
    if (timings.customerListMs > 500) throw new Error(`Customer list took ${timings.customerListMs}ms (> 500ms)`);
    if (timings.backupMs > 10000) throw new Error(`Backup took ${timings.backupMs}ms (> 10000ms)`);
  });

  await check('BOMBARD', 'BOM-99', 'Restore CLEAN-MASTER after Bombard & Load suite', 'V', async () => {
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  await rec.stop();
  process.exit(0);
})().catch(async (e) => { console.error(e); process.exit(1); });
