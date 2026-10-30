// Shop day verification: every hand-calculated number checked in the database (B).
const H = require('./lib/h'); const M = require('./lib/meta'); const S = require('./lib/shop');
const { check, q } = H;
(async () => {
  const rows = []; const add = (name, expected, db) => { rows.push({ name, expected, screen: '-', db, pass: Math.abs(Number(db) - Number(expected)) < 0.005 }); };
  await check('SHOP DAY', 'DAY-DB', 'Shop-day numbers in the database match the hand-calculated figures', 'B', async () => {
    const one = (sql) => Object.values(q(sql)[0])[0] ?? 0;
    const subtotal = one('select sum(subtotal) from sales'), disc = one('select sum(discount_amount) from sales'), bills = one('select count(*) from sales');
    const ret = one('select sum(total_amount) from sale_returns');
    const cogsSold = one('select sum((si.quantity+si.foc_quantity)*u.cost_price) from sale_items si join product_units u on u.id=si.product_unit_id');
    const cogsRet = one('select sum(sri.quantity*u.cost_price) from sale_return_items sri join sale_items si on si.id=sri.sale_item_id join product_units u on u.id=si.product_unit_id');
    const cogs = cogsSold - cogsRet, exp = one('select sum(amount) from expenses');
    const gross = subtotal - disc, net = gross - ret;
    const cashIn = one('select sum(paid_amount) from sales') + one("select sum(amount) from payments where party_type='customer' and sale_id is null");
    const cash = 5000 + cashIn - one('select sum(cash_refund_amount) from sale_returns') - exp - one("select sum(amount) from payments where party_type='supplier'");
    add('Gross sales', 7260, gross); add('Returns', 180, ret); add('Net sales', 7080, net); add('Total discounts', 410, disc); add('Bills', 6, bills);
    add('Cost of goods sold', 6058, cogs); add('Gross profit', 1022, net - cogs); add('Expenses', 2650, exp); add('Net profit', -1628, net - cogs - exp);
    add('Cash from 5,000 opening (computed from DB; the app has no cash drawer)', 4730, cash);
    const a = S.bal('Ahmed Raza'), b = S.bal('Bilal Hussain'), s = S.bal('Sana Bibi');
    add('Ahmed owes', 1000, a); add('Bilal owes', 1500, b); add('Sana advance (negative = in credit)', -300, s);
    add('Receivable (sum of positive balances)', 2500, Math.max(0, a) + Math.max(0, b) + Math.max(0, s));
    add('Lahore Stationers payable', 6000, S.sup('Lahore Stationers')); add('Gujranwala payable', 0, S.sup('Gujranwala Book Depot'));
    const stock = Object.fromEntries(q('select p.name n, sum(v.stock_qty) s from products p join product_variants v on v.product_id=p.id group by p.id').map((r) => [r.n, r.s]));
    const want = { 'Dollar Pointer Pen Blue': 287, 'Piano Ball Pen': 100, 'Dux Pencil': 102, 'Oxford Notebook': 45, 'Single Line Register Small': 30, 'Single Line Register Large': 19, 'A4 Paper Rim': 19, 'Deer Geometry Box': 14, 'UHU Glue Stick': 38, 'Casio fx-991 Calculator': 4, 'Urdu Textbook Class 5': 35 };
    for (const [n, v] of Object.entries(want)) add('Stock: ' + n, v, stock[n]);
    add('Stock value at cost', 71362, one('select sum(v.stock_qty*u.cost_price) from product_variants v join product_units u on u.product_id=v.product_id and u.conversion_factor=1'));
    const inv = q('select invoice_no from sales order by id').map((r) => Number(r.invoice_no.split('-').pop()));
    rows.push({ name: 'Receipt numbers sequential, no gaps or repeats', expected: '1..6', screen: '-', db: inv.join(','), pass: inv.every((n, i) => n === i + 1) });
    M.update((m) => { m.shopday = rows; });
    rows.forEach((r) => console.log(`   ${r.pass ? 'ok  ' : 'BAD '} ${r.name}: expected ${r.expected}, db ${r.db}`));
    const bad = rows.filter((r) => !r.pass);
    if (bad.length) throw new Error(`${bad.length} numbers differ: ` + bad.map((x) => `${x.name} (want ${x.expected}, got ${x.db})`).join('; '));
  });
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
