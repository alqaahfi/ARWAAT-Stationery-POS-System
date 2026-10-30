// Rule 4: barcodes stay per product Type; a scan adds 1 of the default pack size.
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pid = d.prepare("INSERT INTO products (name, base_unit_name) VALUES ('Gel Pen', 'Piece')").run().lastInsertRowid;
  const blue = d.prepare("INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, 'Blue', '1001', 50)").run(pid).lastInsertRowid;
  d.prepare("INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, 'Red', '1002', 50)").run(pid);
  d.prepare("INSERT INTO product_units (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit) VALUES (?, 'Piece', 1, 20, 18, 10, 0)").run(pid);
  const box = d.prepare("INSERT INTO product_units (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit) VALUES (?, 'Box', 10, 190, 180, 100, 1)").run(pid).lastInsertRowid;

  await check('R04-01', 'pack sizes have no barcode column (barcodes belong to the Type)', () => {
    const cols = d.prepare('PRAGMA table_info(product_units)').all().map((c) => c.name);
    assert.ok(!cols.includes('barcode'));
    assert.ok(d.prepare('PRAGMA table_info(product_variants)').all().some((c) => c.name === 'barcode'));
  });
  await check('R04-02', 'a scanned barcode finds that one Type of a several-Types product', async () => {
    const v = await t.invoke('sales:get-variant-by-barcode', { barcode: '1001' }, 'cashier');
    assert.strictEqual(v.variantId, blue);
  });
  await check('R04-03', 'the scanned Type comes with its default pack size (what one scan adds)', async () => {
    const detail = await t.invoke('sales:get-variant-for-cart', { variantId: blue }, 'cashier');
    assert.strictEqual(detail.defaultUnitId, box);
  });
  await check('R04-04', 'the same barcode on two Types is refused', async () => {
    const r = await t.invoke('products:create', { name: 'Clash', variants: [{ variantName: 'A', barcode: '1001' }], units: [{ unitName: 'Piece', conversionFactor: 1, retailPrice: 5, wholesalePrice: 5, costPrice: 3 }] });
    assert.strictEqual(r.success, false);
  });
  await check('R04-05', 'one scan = sale of 1 default pack (10 pieces leave stock)', async () => {
    const r = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [{ productVariantId: blue, productUnitId: box, quantity: 1, focQuantity: 0, unitPrice: 190, lineTotal: 190 }], discountAmount: 0, paidAmount: 190, paymentMethod: 'cash' }, 'cashier');
    assert.ok(r.success, r.reason);
    assert.strictEqual(t.stockOf(blue), 40);
  });
};
