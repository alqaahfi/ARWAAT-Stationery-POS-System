// Fills the local database with dummy data for trying the app out:
// 15 categories, 500 products, 50 wholesale customers, 30 suppliers.
//
// Run with the app CLOSED:
//   npx cross-env ELECTRON_RUN_AS_NODE=1 electron scripts/seed-dummy-data.js
// (Electron's Node is used so better-sqlite3's native build matches.)
// Safe to run once — it stops if dummy products (item code DMY-...) already exist.

const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const dbPath = process.argv[2] || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'stationary-pos-app', 'pos.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Start the app once first so it gets created.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

if (db.prepare("SELECT 1 FROM products WHERE sku LIKE 'DMY-%' LIMIT 1").get()) {
  console.log('Dummy data is already in this database — nothing to do.');
  process.exit(0);
}

// Deterministic random so every run gives the same data.
let seed = 20260928;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const round = (n) => Math.round(n);

// ---------- Catalog blueprint ----------
// [category, base unit, [item names], price range (per piece), pack sizes]
const CATALOG = [
  ['Pens', 'Piece', ['Ball Pen', 'Gel Pen', 'Fountain Pen', 'Roller Pen', 'Fine Liner', 'Ink Pen', 'Click Pen'], [20, 250], [['Box', 10], ['Dozen', 12]]],
  ['Pencils', 'Piece', ['HB Pencil', '2B Pencil', 'Mechanical Pencil', 'Colour Pencil Set', 'Sketch Pencil', 'Jumbo Pencil'], [10, 400], [['Box', 12]]],
  ['Notebooks', 'Piece', ['Single Line Notebook', 'Four Line Notebook', 'Graph Notebook', 'Spiral Notebook', 'Register', 'Practical Notebook'], [60, 450], [['Dozen', 12]]],
  ['Paper', 'Ream', ['A4 Copy Paper', 'Legal Paper', 'Chart Paper', 'Card Sheet', 'Sticky Notes Pad', 'Tracing Paper'], [80, 2200], [['Carton', 5]]],
  ['Files & Folders', 'Piece', ['Box File', 'Clip File', 'Document Bag', 'Ring Binder', 'Plastic Folder', 'Expanding File'], [40, 600], [['Pack', 10]]],
  ['Art Supplies', 'Piece', ['Water Colours', 'Poster Colours', 'Oil Pastels', 'Paint Brush Set', 'Crayons', 'Sketch Book', 'Canvas Board'], [80, 1800], [['Box', 6]]],
  ['Geometry', 'Piece', ['Geometry Box', 'Scale 30cm', 'Protractor', 'Compass', 'Set Square', 'Scale 15cm'], [30, 650], [['Dozen', 12]]],
  ['Erasers & Sharpeners', 'Piece', ['Eraser', 'Dust-free Eraser', 'Sharpener', 'Barrel Sharpener', 'Eraser Pencil', 'Electric Sharpener'], [10, 1500], [['Box', 20]]],
  ['Glue & Tape', 'Piece', ['Glue Stick', 'White Glue', 'Super Glue', 'Cello Tape', 'Masking Tape', 'Double Sided Tape', 'Packing Tape'], [30, 350], [['Box', 12]]],
  ['School Bags', 'Piece', ['School Bag', 'Pencil Pouch', 'Lunch Box', 'Water Bottle', 'Backpack', 'Pencil Box'], [150, 4500], []],
  ['Office Supplies', 'Piece', ['Stapler', 'Stapler Pins', 'Paper Clips', 'Punch Machine', 'Binder Clips', 'Calculator', 'Desk Organizer'], [40, 3500], [['Box', 10]]],
  ['Markers & Highlighters', 'Piece', ['Permanent Marker', 'Whiteboard Marker', 'Highlighter', 'Sign Pen', 'Paint Marker', 'Marker Set'], [40, 900], [['Box', 10]]],
  ['Books', 'Piece', ['English Grammar', 'Urdu Reader', 'Mathematics', 'General Science', 'Islamiat', 'Computer Studies', 'Social Studies'], [250, 1200], [], true],
  ['Registers & Diaries', 'Piece', ['Account Register', 'Attendance Register', 'Diary 2026', 'Receipt Book', 'Cash Memo Book', 'Order Book'], [120, 900], [['Dozen', 12]]],
  ['Gift & Craft', 'Piece', ['Gift Wrap Sheet', 'Glitter Tube', 'Craft Foam Sheet', 'Ribbon Roll', 'Greeting Card', 'Stickers Pack'], [20, 450], [['Pack', 10]]],
];

const BRANDS = ['Dollar', 'Piano', 'Pelikan', 'Faber-Castell', 'Staedtler', 'Deli', 'Uni-ball', 'Pentel', 'Classmate', 'Oxford', 'Horizon', 'Casio', 'Kangaro', 'Paper One', 'Double A'];
const BOOK_PUBLISHERS = ['Oxford University Press', 'Gohar Publishers', 'Punjab Textbook Board', 'Paramount', 'Ilmi Kitab Khana'];
const VARIANTS = ['Blue', 'Black', 'Red', 'Green'];
const SIZES = ['Small', 'Medium', 'Large'];
const STYLES = ['', '', ' Classic', ' Premium', ' Plus', ' Mini', ' Jumbo', ' Pro', ' Eco', ' Deluxe'];

// ---------- People blueprint ----------
const FIRST = ['Ahmed', 'Bilal', 'Usman', 'Hamza', 'Faisal', 'Imran', 'Kashif', 'Naveed', 'Saad', 'Tariq', 'Zubair', 'Adeel', 'Waqas', 'Asad', 'Junaid', 'Rizwan', 'Shahid', 'Sohail', 'Yasir', 'Farhan', 'Ayesha', 'Fatima', 'Sana', 'Hina', 'Nadia'];
const LAST = ['Khan', 'Ahmed', 'Malik', 'Butt', 'Qureshi', 'Sheikh', 'Chaudhry', 'Raza', 'Siddiqui', 'Mirza', 'Hussain', 'Iqbal', 'Javed', 'Aslam'];
const SHOP_WORDS = ['Book Depot', 'Stationers', 'Book Centre', 'Traders', 'School Supplies', 'Book House', 'Paper Mart', 'General Store', 'Academy', 'Grammar School', 'Public School', 'Copy Centre'];
const SHOP_PREFIX = ['Al-Noor', 'Madina', 'City', 'Star', 'New', 'Royal', 'Iqra', 'Al-Huda', 'Crescent', 'Bright', 'Faisal', 'Model', 'Green', 'Unique', 'Kashmir', 'Punjab', 'Jinnah', 'Allied', 'Sunrise', 'Pak'];
const AREAS = ['Urdu Bazaar', 'Anarkali', 'Gulberg', 'Model Town', 'Saddar', 'Johar Town', 'Iqbal Town', 'Township', 'Samanabad', 'Shadman', 'Garden Town', 'Faisal Town', 'Wapda Town', 'Cantt'];
const CITIES = ['Lahore', 'Lahore', 'Lahore', 'Gujranwala', 'Faisalabad', 'Sialkot', 'Kasur', 'Sheikhupura'];
const SUPPLIER_WORDS = ['Distributors', 'Paper Mills', 'Wholesale', 'Enterprises', 'Industries', 'Trading Co.', 'Imports', 'Agencies', 'Publishers', 'Brothers'];

const phone = () => `03${between(0, 4)}${between(0, 9)} ${between(1000000, 9999999)}`;
const address = () => `Shop ${between(1, 250)}, ${pick(AREAS)}, ${pick(CITIES)}`;

// ---------- Statements ----------
const insCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
const getCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
const insSupplier = db.prepare(
  'INSERT INTO suppliers (name, contact_person, phone, address, notes, opening_balance) VALUES (?, ?, ?, ?, ?, ?)'
);
const insCustomer = db.prepare(
  "INSERT INTO customers (name, customer_type, tier, phone, address, opening_balance) VALUES (?, 'wholesale', ?, ?, ?, ?)"
);
const insProduct = db.prepare(
  `INSERT INTO products (name, sku, company_name, category_id, supplier_id, base_unit_name, min_stock_alert, dead_stock_days,
                         pricing_type, default_percentage, is_agency_item, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
);
const insVariant = db.prepare('INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, ?, ?, ?)');
const insMovement = db.prepare(
  `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note)
   VALUES (?, 'purchase', ?, 'initial_stock', 'Initial stock on product creation')`
);
const insUnit = db.prepare(
  `INSERT INTO product_units
     (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit,
      net_rate_c1, net_rate_c2, net_rate_c3, net_rate_c4, net_rate_c5)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const seedAll = db.transaction(() => {
  // Categories
  const categoryIds = CATALOG.map(([name]) => {
    insCategory.run(name);
    return getCategory.get(name).id;
  });

  // Suppliers (30)
  const supplierIds = [];
  const usedSupplierNames = new Set();
  while (supplierIds.length < 30) {
    const name = `${pick(SHOP_PREFIX)} ${pick(SUPPLIER_WORDS)}`;
    if (usedSupplierNames.has(name)) continue;
    usedSupplierNames.add(name);
    const opening = rand() < 0.5 ? round(between(5, 300) * 1000) : 0;
    const res = insSupplier.run(name, `${pick(FIRST)} ${pick(LAST)}`, phone(), address(), rand() < 0.3 ? 'Delivers on Mondays and Thursdays.' : null, opening);
    supplierIds.push(res.lastInsertRowid);
  }

  // Wholesale customers (50)
  const usedCustomerNames = new Set();
  let customers = 0;
  while (customers < 50) {
    const name = `${pick(SHOP_PREFIX)} ${pick(SHOP_WORDS)}`;
    if (usedCustomerNames.has(name)) continue;
    usedCustomerNames.add(name);
    const tier = rand() < 0.7 ? `C${between(1, 5)}` : null;
    const r = rand();
    const opening = r < 0.45 ? round(between(2, 150) * 1000) : r < 0.55 ? -round(between(1, 20) * 1000) : 0;
    insCustomer.run(name, tier, phone(), address(), opening);
    customers++;
  }

  // Products (500) — spread across the 15 categories
  let barcode = 8960000000000;
  for (let i = 0; i < 500; i++) {
    const catIndex = i % CATALOG.length;
    const [, baseUnit, items, [minPrice, maxPrice], packs, isBook] = CATALOG[catIndex];
    const brand = isBook ? pick(BOOK_PUBLISHERS) : pick(BRANDS);
    const item = pick(items);
    const name = isBook ? `${item} Class ${between(1, 10)}` : `${brand} ${item}${pick(STYLES)}`;
    const sku = `DMY-${String(i + 1).padStart(4, '0')}`;

    const cost = between(minPrice, maxPrice);
    const retail = round(cost * (1.25 + rand() * 0.35));
    const wholesale = round(cost * (1.1 + rand() * 0.1));
    const agency = isBook || rand() < 0.05;
    const pricingType = isBook ? 'percentage' : 'fixed';

    const productId = insProduct.run(
      name,
      sku,
      brand,
      categoryIds[catIndex],
      pick(supplierIds),
      baseUnit,
      between(5, 30),
      rand() < 0.3 ? 90 : null,
      pricingType,
      isBook ? 15 : null,
      agency ? 1 : 0
    ).lastInsertRowid;

    // Stock: most items healthy, some running low, a few out of stock.
    const s = rand();
    const stockFor = () => (s < 0.08 ? 0 : s < 0.22 ? between(1, 8) : between(20, 400));

    const hasTypes = !isBook && rand() < 0.15;
    const variantNames = hasTypes ? (catIndex === 9 ? SIZES : VARIANTS.slice(0, between(2, 4))) : ['Standard'];
    for (const v of variantNames) {
      const qty = stockFor();
      const variantId = insVariant.run(productId, v, String(barcode++), qty).lastInsertRowid;
      if (qty > 0) insMovement.run(variantId, qty);
    }

    // Base unit (+ Price Levels on about a third of items), then pack sizes.
    const levels = rand() < 0.35 ? [0.99, 0.97, 0.95, 0.93, 0.9].map((f) => round(wholesale * f)) : [null, null, null, null, null];
    insUnit.run(productId, baseUnit, 1, retail, wholesale, cost, 1, ...levels);
    for (const [packName, factor] of packs) {
      if (rand() < 0.5) continue;
      insUnit.run(productId, packName, factor, round(retail * factor * 0.95), round(wholesale * factor * 0.95), cost * factor, 0, null, null, null, null, null);
    }
  }
});

const backup = `${dbPath}.before-dummy-${Date.now()}.bak`;
db.backup(backup)
  .then(() => {
    console.log(`Backup saved: ${backup}`);
    seedAll();
    const count = (t, where = '') => db.prepare(`SELECT COUNT(*) AS n FROM ${t} ${where}`).get().n;
    console.log('Dummy data added:');
    console.log(`  categories : ${count('categories')}`);
    console.log(`  products   : ${count('products', "WHERE sku LIKE 'DMY-%'")}`);
    console.log(`  customers  : ${count('customers', "WHERE customer_type = 'wholesale'")} wholesale`);
    console.log(`  suppliers  : ${count('suppliers')}`);
    db.close();
  })
  .catch((err) => {
    console.error('Seeding failed, nothing was changed:', err.message);
    db.close();
    process.exit(1);
  });
