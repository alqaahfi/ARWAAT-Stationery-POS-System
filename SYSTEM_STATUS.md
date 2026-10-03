# ARWAAT Stationery Systems — System Status (project memory)

The single reference a new session needs to continue this project with no other context. It describes **what exists and how it behaves**, derived from reading the code (`src/`, every migration, `package.json`, `electron-builder.yml`). When the code and this file disagree, the code wins — fix this file.

---

## 1. What this is

An **offline-first POS and back-office app for a single stationery/book shop**, used by a non-technical owner (Admin) and cashiers. Windows desktop only; mouse + keyboard; English only, plain everyday words. Built with **Electron 44** (main process = Node + **better-sqlite3**, one local SQLite file per PC) and a **React 19** renderer built by **Vite 8**. Several PCs in the shop sync with each other **peer-to-peer over the LAN** (one Admin PC + any number of Cashier PCs). There is **no cloud, no central server, no CDN assets**.

---

## 2. Architecture

```
src/
  main/                         Electron main process (the only code with DB/Node access)
    index.js                    Bootstrap: initDatabase → install middleware → register*Ipc() → seedDummyCashier
                                → generateDueRecurringExpenses → start sync server/discovery/periodic sync → window
    preload.js                  contextBridge: window.api.<area>.<method>() → ipcRenderer.invoke('<area>:<action>')
    db/connection.js            Opens userData/pos.db (WAL, foreign_keys ON), runs every migrations/*.sql not yet
                                in the _migrations table, in filename order
    db/migrations/001–029       Schema (see §3)
    db/models/Product.js        getLowStock / getDeadStock / getProductStockStatus — the ONE definition of stock status
    ipc/*.ipc.js                One file per area; each exports register<Area>Ipc()
    pricing/priceEngine.js      resolveUnitPrice() — the only price logic (§6.2)
    ledger/balanceEngine.js     Customer/supplier balances, always derived (§6.3)
    ledger/adjustmentRows.js    Balance corrections as account-timeline rows
    ledger/returnRows.js        Returns as customer account-timeline rows
    license/                    licenseManager.js (activation), machineId.js (node-machine-id)
    printing/                   receiptData.js (shared sale data), thermalReceipt.js (ESC/POS), printA4Invoice.js,
                                pdfInvoiceMerge.js (pdf-lib letterhead stamping), receiptPreview.js (dev),
                                exportReportPdf.js (hidden window → printToPDF)
    sync/                       discovery.js (UDP), syncServer.js (Express), syncEngine.js, syncSchema.js,
                                recordCodec.js (id↔uuid), applyIncoming.js, syncTrigger.js (middleware)
    devpanel/                   auditMiddleware.js, sessionTracker.js
    activity/activityLog.js     logActivity() — cashier session activity rows
    expenses/recurringExpenses.js  generateDueRecurringExpenses()
  renderer/                     React UI — no Node/DB access, everything through window.api.*
    main.jsx                    Entry. ?print=1 → PrintRoot (print-only views), else <App/>; wraps Toast + Confirm providers
    app.jsx                     AppRouter: activation check → Setup / resume-admin / CashierInitialSync / Login / Dashboard;
                                <DevPanelTrigger/> rendered at the true root
    context/AuthContext.jsx     Session token in localStorage('pos_session_token'), user, permissions,
                                hasPermission(key) / getPermissionValue(key) (admin short-circuits to all)
    layout/                     Sidebar, SectionTabs, TopUtilityBar, SearchPalette (Ctrl+K), ShellParts (UserChip,
                                SyncChip…), useAlerts.js
    config/                     theme.js, navConfig.js, glossary.js, appIcons.js, appInfo.js
    components/                 ui.jsx (kit re-exports), kit/*, BalanceChip, BrandMark, PrintChoice, receipt/ThermalContent,
                                DevPanel/*, DevPanelTrigger, GlobalStyles, PlaceholderPage, StatTile.jsx (legacy, unused)
    pages/                      One folder per module; big pages keep state/IPC in the top-level file and put
                                presentation in a parts/ (or form/, list/, stock/, import/…) subfolder
    utils/                      format.js, csv.js, priceLevel.js, expenseRecurrence.js (renderer copy), printPayment.js
  shared/                       Plain CommonJS, required by main only (renderer keeps small copies / gets them via IPC)
    permissionDefinitions.js    The permission catalog (§5)
    expenseRecurrence.js        Recurrence types/labels + addPeriod() date math
scripts/                        seed-dummy-data.js (run with ELECTRON_RUN_AS_NODE=1 electron …; fills 500 products etc.),
                                generate-dev-panel-hash.js, private_key.pem (leftover from the old signed-key licensing; unused)
seed-dev-panel.js               (repo root) Dev Panel password seeding helper
tests/                          exists but there is no test runner (npm test is a stub)
```

**IPC pattern.** Renderer calls `window.api.reports.getSalesReport({...})` → preload → `ipcMain.handle('reports:get-sales-report')`. Handlers return plain objects; failures are `{ success: false, reason }` (plain-words message shown to the user). Role checks that matter are done **server-side** from a `requestingUserId` the renderer passes (e.g. Returns, Sales History, Sales Report, ledger adjustments, supplier payments).

**Global middleware** (installed in `index.js` *before* any `register*Ipc()`, both by monkey-patching `ipcMain.handle`, so no module opts in):
- `installAuditMiddleware` — writes one `dev_audit_log` row per IPC call (channel, user/role from `sessionTracker`, station, sanitized args ≤2000 chars with password/token/secret/license-key fields redacted, success, error, duration). `sessionTracker` learns the current user by watching `users:login` / `users:validate-session` / `users:logout` results. `pruneAuditLog()` at boot: drop rows >90 days, cap 200,000.
- `installSyncTriggerMiddleware` — counts `sync_outbox` before/after each call; if it grew, schedules a debounced sync.

**Routing — hand-rolled, no React Router.**
- `pages/Dashboard/Dashboard.jsx` splits by role: Admin → `AdminDashboard.jsx`; cashier → `CashierLayout` (in the same file).
- `AdminDashboard.jsx` holds `nav = { route, params }` in state; `navigate(route, params)` sets it; a big `switch (nav.route)` renders the page. Unknown routes fall to `PlaceholderPage`. `navigate` refuses to leave `/pos` mid-sale without a `window.confirm` (`isPosSaleInProgress()` exported from `Sale.jsx`). Shortcuts: **Ctrl+K** opens SearchPalette (go-to pages + global search); **Ctrl+Shift+G** opens `/dev/design-gallery` (dev builds only, lazy-loaded).
- `config/navConfig.js` is the Admin app map: sections (sidebar items, grouped Shop / Money / Manage) with `tabs` (shown by `SectionTabs` when ≥2 visible) and `pages` (forms/detail views; show a "‹ Section" back button). Exports `ROUTE_TITLES`, `getSectionForRoute`, `canSee`, `visibleTabs`, `visibleSections`, `sectionEntryRoute`, `NAV_GROUPS`. Visibility: `adminOnly` hard gate, else `permissionKey`.
- **Admin routes:** `/dashboard`, `/pos`; Products `/products`, `/products/new`, `/products/edit`, `/products/categories`, `/products/low-stock`, `/products/dead-stock`, `/products/bulk-import`, `/products/purchases`, `/products/stock-adjustments`, `/products/stock-movements`; Customers `/customers`, `/customers/new`, `/customers/edit`, `/customers/percentage-rules`; Suppliers `/suppliers`, `/suppliers/new`, `/suppliers/edit`; Sales `/sales`, `/sales/returns`; `/payments/record`; Accounts `/ledgers`, `/ledgers/customers`, `/ledgers/suppliers`, `/ledgers/payments`, `/ledgers/advances`, `/ledgers/aging`, `/ledgers/adjustments`; Expenses `/expenses`, `/expenses/new`, `/expenses/edit`; Reports `/reports` (home), `/reports/sales`, `/reports/profit-loss`, `/reports/stock`, `/reports/customers`, `/reports/suppliers`, `/reports/cashiers`, `/reports/expenses`; Cashiers `/cashiers`, `/cashiers/new`, `/cashiers/edit`, `/cashiers/sessions`, `/cashiers/sessions/detail`; Settings `/settings/preferences`, `/settings/receipt-content`, `/settings/letterheads`, `/settings/printers`, `/settings/sync`, `/settings/backup`, `/settings/license`; `/dev/design-gallery` (dev only). Every route has a real page — none are placeholders.
- **Cashier layout** (`CashierLayout` + `pages/Dashboard/CashierRoutes.jsx`): no sidebar or tabs. Home is `/pos`; a header **Menu** (Popover) lists the pages the cashier's permissions allow — New Sale (`make_sale`), Receive Payment (`record_payment`), Sales History `/sales` (`view_sales_history`), Expenses (+ `/expenses/new|edit`) (`manage_expenses`), Products + Running Low (`view_products`), Sales Report `/reports/sales` (`view_reports`). `CashierRoutes` re-checks the permission per route. **This Menu instead of a sidebar is intentional.**
- **Print mode** (`main.jsx`): `?print=1&printMode=receipt|payment-receipt|invoice-fallback|report(default)` renders `pages/Print/PrintReceipt|PrintPaymentReceipt|PrintInvoice|PrintReport` with no auth/shell — used by hidden/preview BrowserWindows.

---

## 3. Data model (migrations `001`–`029`)

All timestamps written with `datetime('now')` are **UTC text**; user-entered calendar dates (`expenses.expense_date`, `recurring_expenses.*_date`) are local `YYYY-MM-DD`. Soft delete via `is_active` on products, variants, units, customers, suppliers, users (sales/purchases reference them).

**Setup / auth**
- `settings(key PK, value)` — shop-wide key/value. Keys in use: `currency_symbol` (default `Rs.`), `default_cashier_discount_cap`, `receipt_header_text`, `receipt_footer_text`, `thermal_printer_name`, `thermal_paper_width` (58mm/80mm).
- `users(id, full_name, username UNIQUE, password_hash bcrypt, role 'admin'|'cashier', is_active, created_at, updated_at, uuid)`.
- `user_permissions(user_id, permission_key, value, uuid)` — row exists = granted; `value` only for valued keys (discount cap).
- `sessions(user_id, token, created_at, expires_at ISO, is_revoked, ended_at)`.
- `license_activation` — single row (id=1): `machine_id, shop_name, license_key, role, admin_host, station_code, sync_secret, activated_at`.
- `license_keys(key_value UNIQUE, is_used, used_at)` — 500 baked-in keys (025).

**Catalog / stock**
- `categories(name UNIQUE, parent_id, uuid)` — one level parent/child; hard delete (blocked while products use it).
- `suppliers(name, contact_person, phone, mobile, email, joining_date 'YYYY-MM-DD' (defaults to today on create), address, notes, opening_balance, is_active, origin_station, uuid)`. mobile/email/joining_date added in migration **028**; they sync via the generic column copy.
- `products(name, sku UNIQUE, company_name, category_id, supplier_id, base_unit_name, min_stock_alert, dead_stock_days, pricing_type 'fixed'|'percentage', default_percentage, is_agency_item, notes, is_active, origin_station, uuid)`.
- `product_variants` ("Types": `product_id, variant_name` default 'Standard', `stock_qty` in base units, `barcode` unique-if-set, `last_purchased_at, last_sold_at, is_active, uuid`). Every product has ≥1 variant; stock lives on variants.
- `product_units` ("Pack sizes": `unit_name, conversion_factor` to base unit, `retail_price, wholesale_price, cost_price` — all **per this unit**, `is_default_sale_unit, is_active, net_rate_c1..c5` (NULL = no override), `uuid`; migration **029** adds `pricing_method` TEXT NOT NULL default `'simple'` (`'simple'`|`'trade'`) and nullable `trade_price, purchase_discount` (%), `extra_discount` (amount), `sale_discount_c1..c5` (%) — see §6.4 "Trade Price pricing"; they sync via the generic column copy).
- `stock_movements(product_variant_id, movement_type 'purchase'|'sale'|'return_in'|'return_out'|'adjustment', quantity ± base units, reference_type 'sale'|'purchase'|'return'|NULL, reference_id, note, created_by, created_at, uuid)`.

**Customers / pricing**
- `customers(name, customer_type 'retail'|'wholesale', tier 'C1'..'C5'|NULL, assigned_letterhead_id, phone, mobile, email, address, opening_balance (+ = owes the shop), credit_limit REAL default 0 (stored only, **not enforced** in sales), joining_date 'YYYY-MM-DD' (defaults to today on create), notes, is_active, origin_station, uuid)`. Last four extra columns + mobile/email added in migration **027**; they sync via the generic column copy.
- `percentage_pricing_rules(product_id, customer_id XOR customer_tier, percentage, uuid)` — "Special Margins".
- `letterheads(name, image_path (unused), pdf_template_path, content_margin_top_mm=40, content_margin_bottom_mm=25, is_default, uuid)`; PDFs copied into `userData/letterheads/`.

**Sales / returns**
- `sales(invoice_no UNIQUE, sale_type, customer_id NULL=walk-in, cashier_id, letterhead_id, subtotal, discount_amount, tax_amount (always 0), total_amount, paid_amount, balance_due, payment_status 'paid'|'partial'|'unpaid' (snapshot at sale time), is_synced, origin_pc, created_at, uuid)`.
- `sale_items(sale_id, product_id, product_variant_id, product_unit_id, quantity (in unit sold), unit_price, discount_amount, line_total, uuid)`.
- `sale_returns(return_no UNIQUE, sale_id, customer_id, total_amount, cash_refund_amount, reason 'wrong_item'|'faulty'|'changed_mind'|'other', note, restocked 0/1, created_by, origin_pc, created_at, uuid)` and `sale_return_items(return_id, sale_item_id, quantity (unit sold), refund_amount, uuid)` (026; insert-only, own sync triggers).

**Money**
- `payments(party_type 'customer'|'supplier', party_id, sale_id, amount, payment_method 'cash'|'bank'|'other', note, received_by, created_at, uuid)` — supplier payments are the same table with `party_type='supplier'`.
- `ledger_adjustments(party_type, party_id, amount (+ raises what the party owes), reason, created_by, created_at, uuid)` — "Balance corrections".
- `purchases(supplier_id, reference_no, subtotal, total_amount, notes, created_by, purchase_date, created_at, uuid)` + `purchase_items(purchase_id, product_id, product_variant_id, quantity, unit_cost, line_total, uuid)`.
- `expenses(description, amount, payee, paid_by, expense_date, recurrence 'one_time'|'daily'|'weekly'|'monthly'|'annually', recurring_expense_id, created_at)` and `recurring_expenses(description, amount, payee, paid_by, frequency, start_date, next_run_date, active, created_at)`.

**Sync** — `sync_outbox(table_name, record_uuid, operation, created_at)`, `sync_peer_state(peer_machine_id PK, station/role/ip/last_seen, last_synced_outbox_id, last_received_outbox_id, last_sync_success_at)`, `sync_log(direction 'push'|'pull'|'exchange', status, peer_machine_id, peer_station_code, message, created_at)`.

**Ops / diagnostics** — `activity_log(session_id, user_id, action, description, reference_type, reference_id, created_at)`, `dev_panel_config(id=1, password_hash)`, `dev_audit_log`, `dev_panel_access_log`, `_migrations`.

**Removed / superseded — don't go looking for these:**
- `customer_categories`, `product_category_prices`, `customers.category_id`, `percentage_pricing_rules.customer_category_id` → dropped in **018** for the fixed C1–C5 tiers (`customers.tier`, `product_units.net_rate_c*`, `percentage_pricing_rules.customer_tier`).
- `expense_categories`, `expenses.category_id` → dropped in **021** (free-text `payee` + recurrence engine).
- `sync_queue` (006) → dropped in **022** for the trigger-fed `sync_outbox`. Old `sync_log` rebuilt in **024**.
- `letterheads.image_path` → made nullable in **017**, no longer written (letterheads are PDF templates).
- `license_activation.admin_host` is still written for cashiers but discovery replaced manual IPs.

---

## 4. Licensing, setup, reset, backup

- **Activation pool (025).** 500 pre-generated keys `XXXXX-XXXXX-XXXXX-XXXXX` ship in every install. `license:activate-admin` normalizes the key (strip spaces, uppercase), looks it up with `is_used = 0`, marks it used, generates a 32-hex-char `sync_secret`, and writes `license_activation` (role admin, station code default `MAIN`). **Enforcement is per-installation only** — another shop's install has the same 500 keys; not reusing a key is the developer's job (private master list kept outside the repo). This replaced an earlier Ed25519 signed-key scheme.
- **First run** (`app.jsx`): not activated → `ChooseRole` (System Admin / Point of Sale).
  - `SetupAdmin.jsx`: Shop Name + Activation Key + Station Code → shows the Sync Secret once → Create Admin Account. Alternative "restore instead" path → `backup:validate-and-restore` (opens the file read-only, requires `license_activation` + `users` tables, swaps the DB, relaunches — no key consumed).
  - **Resume:** if activated as admin but `users:has-admin-user` is false (app closed between activation and account creation), `app.jsx` reopens `SetupAdmin` straight at Create Account using the existing activation. `hasAdminUser` (not `hasAnyUser`) is required because `seedDummyCashier()` always creates a user.
  - `SetupCashier.jsx`: Station Code + the Sync Secret typed from the Admin screen (no IP entry — Admin is found by discovery). Then `CashierInitialSync.jsx` blocks until a first successful sync brings over user accounts, then Login.
  - Station codes must be hyphen-free (invoice/return numbers are split on `-`).
- **Demo cashier:** `seedDummyCashier()` runs every boot: ensures user `cashier` / `cashier123` ("Cashier (Demo)") with `make_sale` + `max_discount_percentage=10`, and backfills `record_payment`.
- **Factory reset** (`system:factory-reset`, Settings → Backup & Restore danger zone, type `RESET`): with FK enforcement off, deletes every business table (sales, returns, items, payments, purchases, stock, catalog, customers, suppliers, letterheads, rules, expenses, recurring, adjustments, activity, users, permissions, sessions, sync tables) plus `license_activation`, then relaunches to Setup. Keeps the consumed `license_keys` row (a reset needs a new key), `dev_panel_*`, `dev_audit_log`, `_migrations`.
- **Backup / restore:** `backup:export` copies `pos.db` out (`pos-backup-YYYY-MM-DD.db`); `backup:restore` (logged in) and `backup:validate-and-restore` (Setup) close the DB, copy the file over, delete stale `-wal`/`-shm`, and relaunch (`backup:relaunch-app`). On failure the original DB is reopened.
- **Cashier auto-discovery + shared secret:** see §6.11.

---

## 5. Auth, sessions, permissions, Dev Panel

- **Exactly one Admin**, created in Setup; no UI creates another. Cashiers are created by Admin (`users:create-cashier`, password ≥6 chars; new cashiers get **no** permissions until granted).
- **Login** (`users:login`): bcrypt check, inactive users rejected, creates a 7-day session (random 32-byte token), logs `login` activity. `users:validate-session` on app load; `users:logout` revokes + sets `ended_at`. Deactivating a cashier or resetting their password revokes all their sessions.
- **Permission catalog** — `src/shared/permissionDefinitions.js` (renderer gets it via `permissions:get-definitions`):

  | key | type | meaning |
  |---|---|---|
  | `make_sale` | boolean | New Sale (Cashier Mode) |
  | `view_products` | boolean | Product list + Running Low |
  | `record_payment` | boolean | Receive Payment from customers (granted by default to the demo cashier / backfilled) |
  | `max_discount_percentage` | number | Per-cashier discount cap; blank → `settings.default_cashier_discount_cap`; neither → 0 |
  | `view_sales_history` | boolean | Sales History (own sales only, enforced server-side) |
  | `view_reports` | boolean | Sales Report only (own sales only, enforced server-side) |
  | `manage_expenses` | boolean | Expenses list/add/edit |

  Admin implicitly has every permission (`hasPermission` short-circuits on role; discount cap is `null` = none for admin).
- **Hard role-gated (Admin only, regardless of permissions):** Customers + Special Margins, Suppliers, Accounts/Ledgers (incl. balance corrections, supplier payments — enforced server-side), Returns (server-side), Purchases/Fix Stock/Stock History/Categories/Not Selling/Import, Reports other than Sales, Reports home, Cashiers, Settings, Dev Panel tools. **Permission-gated:** New Sale, Receive Payment, Sales History, Expenses, Products/Running Low, Sales Report.
- **Activity log:** `logActivity()` writes login/logout/`sale_created` rows (resolving the user's active session); viewed in Cashiers → Session Activity → session detail.
- **Dev Panel** (`components/DevPanel*`, `ipc/devpanel.ipc.js`): a near-invisible fixed icon at the **bottom-right of every screen** (keep ~64px there free; pages use ~48px bottom padding); 5 clicks within 3 s + password (bcrypt in `dev_panel_config`, seeded via `scripts/generate-dev-panel-hash.js`). Every unlock attempt goes to `dev_panel_access_log`. Strictly read-only: tabs **Audit Log**, **Database Browser** (paged table view + SELECT-only query console: single statement, must start with SELECT, write keywords rejected anywhere, `stmt.reader` required, 1000-row cap), **Users & Sessions**, **System Info**, **Access Log**. `password_hash` and session `token` are always masked.

---

## 6. Feature modules (current behavior)

### 6.1 New Sale / Cashier Mode — `pages/POS/Sale.jsx` (+ `POS/parts/`)
One component owns a keyboard **stage machine**; mouse works everywhere as a fallback. Stages and keys (`STAGE_LABELS`, `getStageLegend`, on-screen `KeyHints` + `StepStrip`):
- **idle** — `S` start new; if a draft exists `R` resume / `N` new.
- **customer** — type to search, `↑↓` select, `Enter` choose, `Tab` walk-in/continue, `Esc` cancel sale.
- **item-search** — debounced grouped search or exact barcode scan. With results open: `↑↓` product, `Tab` move to Type/Unit, `←→` cycle, `Enter` confirm, `Esc` cancel sale. Results closed: `↑` edit cart, `Tab` continue to discount. Search rows show "Only N left" when stock ≤ **5** (fixed `LOW_STOCK` in `ItemSearchPanel.jsx`).
- **qty** — `Enter` add (same variant+unit merges into the existing line), `Esc` cancel item. Quantity over stock is blocked ("Only N in stock").
- **cart-edit** — `↑↓` line, `Enter` edit qty (then `Enter` confirm / `Esc` cancel), `Del`/`Backspace` remove, `Ctrl+Z` undo (UndoPill), `Esc` back to search.
- **discount** — amount or % (`Tab`/`Enter` continue, `Esc` cancel). Cap shown and enforced client-side.
- **format** — `←→` or `1`/`2`: Retail thermal vs Wholesale A4 (default from customer type; A4 letterhead = customer's, else default, else the only one).
- **payment** — `Enter` exact payment, `C`/`B`/`O` cash/bank/other. Partial/unpaid requires a named customer. "Show outstanding balance on receipt" toggle with a smart default.
- **confirm** — SaleCompleteSheet; `Enter`/`Esc` close, `R` retry print if it failed.
- **Finalize:** client re-fetches the discount cap (`sales:get-cashier-discount-cap`) immediately before submitting (permissions may change mid-shift); `sales:create` itself does **not** re-check the cap. Server: recomputes subtotal from line totals (does not trust a client total), `total = max(0, subtotal − discount)`, rejects a walk-in with balance due, rejects any line exceeding variant stock, then in one transaction inserts `sales`/`sale_items`, decrements `stock_qty` (base units), sets `last_sold_at`, writes `stock_movements('sale')`, and — **only for a named customer** — a linked `payments` row for the amount paid (walk-in money lives only in `sales.paid_amount`). Logs `sale_created`. Invoice number `{station}-{YYYYMMDD}-{seq4}` per station per day (the date part is the UTC date).
- Prices are resolved server-side per line (`sales:resolve-price`) when added and re-resolved for every line when the customer changes.
- **Draft autosave** to `localStorage` key `pos_sale_draft_{station}` (debounced); `window` event `pos:sale-completed` lets the top bar refresh.

### 6.2 Pricing engine — `main/pricing/priceEngine.js`
`resolveUnitPrice({ db, productUnitId, customerId })`, first match wins:
1. Special Margin for this customer → `cost_price × (1 + %/100)`
2. Special Margin for the customer's tier (same formula)
3. The unit's `net_rate_c{tier}` if set
4. Product `pricing_type='percentage'` → `cost × (1 + default_percentage/100)`
5. `wholesale_price` for wholesale customers, else `retail_price` (walk-in = retail)

Rounded to 2 dp. `productId` is taken from the unit row, never the caller. Special Margins only apply to products with `pricing_type='percentage'` or `is_agency_item=1` (the eligible-product list).

### 6.3 Accounts / Ledgers and balances
- **Balances are never stored.** `balanceEngine.js`:
  - Customer = `opening_balance + Σ sales.total_amount − Σ payments + Σ ledger_adjustments + Σ (sale_returns.cash_refund_amount − sale_returns.total_amount)`.
  - Supplier = `opening_balance + Σ purchases.total_amount − Σ supplier payments + Σ adjustments` (positive = shop owes supplier).
  - Batch versions `getBalancesForCustomers/Suppliers` for lists. Used by Accounts, Customer/Supplier lists, Reports statements, Home receivables, global search, returns, receipts.
- **Accounts section** (Admin): Overview (total receivable/payable/advances held/prepaid + top 5 each side), Customer Accounts & Supplier Accounts (party picker → account view with transaction timeline incl. sales, payments, purchases, corrections, returns; inline receive/pay), Payments (combined history with reprint), Paid in Advance (parties in credit), Overdue Payments (customer aging 0–30/31–60/61–90/90+ — an approximation: ages each sale's `balance_due` independently, no FIFO reallocation; customers only), Balance Corrections (`ledgers:create-adjustment`, Admin-only server-side, reason required).
- **Receive Payment** (`/payments/record`, `record_payment` permission): customer search (`customers:search-minimal`), amount/method/note, overpayment allowed after a confirm dialog ("This is more than they owe"), print receipt thermal or A4. **Pay Supplier** (`payments:create-supplier-payment`) is Admin-only server-side, from the supplier account.

### 6.4 Products & stock — `pages/Products/`
- **All Products** (`ProductList` + `list/`): filters/sort/counts in SQL (`products:list`), status badges from `getProductStockStatus` (out of stock / Running Low / Not Selling — a product can be low and dead at once), detail panel, bulk bar (activate/deactivate, move category). Rows show brand · item code.
- **Product form** (`form/`): Basics (name, item code/SKU, brand = `company_name`, category, supplier), Types (variants with barcode; no Types = single "Standard" variant with top-level barcode/starting stock), Pack sizes (units with conversion factor + Simple or Trade Price pricing), Special prices (C1–C5 net rates, or C1–C5 discount % for Trade Price units; blank = no override), More options (warn-below, not-selling days, pricing type/percentage, agency item, notes, active). Editing never changes stock; removed variants/units are soft-deleted. SKU/barcode uniqueness checked live.
- **Trade Price pricing (per pack size).** Each pack size card has a Simple | Trade Price segmented control (`pricing_method`). *Simple* = the manual fields above. *Trade Price* hides Buying/Retail/Wholesale and shows Trade price, Purchase discount % and Extra discount (amount) in the card, and five Sale discount % boxes in the Special prices table (replacing the C1–C5 net-rate boxes; the computed net rate shows under each). `ProductForm.jsx` `withTradePrices()` runs on every unit edit and **overwrites the standard fields**: `cost_price = trade − trade×purchase% − extra` (min 0), `retail_price = wholesale_price = trade`, `net_rate_cN = trade − trade×saleDiscountCN%` (blank discount → NULL, no override). Those derived values are what is saved, so `priceEngine`, POS, reports and purchases are unchanged and never read the trade columns. `products:create/update` persist the trade fields via `tradeFields()` (non-trade units store `'simple'` and NULL trade columns). Bulk import always creates Simple units. Switching to Trade seeds Trade price from the current retail price.
- **Import spreadsheet** (`BulkImport` + `import/`): CSV, one row per product×type×pack size, grouped client-side; categories must already exist; all-or-nothing preview; `products:bulk-import` runs every product through the same `create()` in one transaction.
- **Running Low / Not Selling** and the Stock Report all use `db/models/Product.js` (`total_stock ≤ min_stock_alert`; days since last sale (or creation) ≥ `dead_stock_days`).
- **Categories:** one-level parent/child, unique names, delete blocked while products use it; only direct self-parenting is prevented.
- **Purchases** (Admin): supplier + lines (product/type/pack size/qty/cost, cost editable). One transaction: `purchases` + `purchase_items`, stock += qty × conversion factor, `last_purchased_at`, `stock_movements('purchase')`. Permanent (no edit/delete); does **not** update the product's stored cost price.
- **Fix Stock Count** (`stock:adjust`): increase/decrease one variant with a reason (damaged/expired/lost/recount/other) + note; decreases can't exceed stock; writes `stock_movements('adjustment')`.
- **Stock History** (`stock:get-movements`): read-only, capped at 500 rows.

### 6.5 Customers & Suppliers — `pages/Customers/`, `pages/Suppliers/`, shared `pages/Parties/`
Admin-only. Customers: retail/wholesale, Price Level (tier C1–C5 or none; shown as "Price Level 1–5" via `utils/priceLevel.js`), letterhead (wholesale), phone + mobile + email, address, credit limit (stored only, not enforced) + joined date, notes (form is SectionCards: Basics, Contact, Address, Pricing, Credit and History, Starting Balance, Notes, More options; list search, global search and Receive Payment search match phone or mobile; list/header show phone · mobile), starting balance (set at creation only — edit form shows it read-only), active flag, recent activity card. **Special Margins** page (`/customers/percentage-rules`): per-customer or per-tier % rules on eligible products, add/delete. Suppliers: name, contact person, phone + mobile + email, address, joined date, notes, starting balance (creation only), active flag (form is SectionCards: Basics, Contact, Address, History, Starting Balance, Notes, More options; list search, global search and purchase supplier search match phone or mobile; list sub-text and profile header show phone · mobile). Lists show derived balances (BalanceChip). No active/inactive "Show" filter on either list (see §8).

### 6.6 Sales History — `pages/Sales/SalesHistory.jsx` (+ `parts/`)
`sales:list` / `sales:get-detail` (`ipc/salesHistory.ipc.js`): Admin sees all; a cashier needs `view_sales_history` and is locked to their own sales server-side. Filters: local-day date range (`date(created_at,'localtime')`), payment status, sale type, cashier (admin), search; max 200 rows. Each sale carries returned amount and return status (none/partial/full). Detail sheet shows lines, payment, current customer balance, reprint (receipt/A4), and (Admin) "Return items".

### 6.7 Returns — `pages/Sales/Returns.jsx` (+ `parts/returns/`), `ipc/returns.ipc.js`
**Admin-only, enforced server-side.** Steps: find sale → pick items/quantities → refund → success; plus a returns list + detail sheet.
- A return belongs to **one sale** and only its lines; quantity per line ≤ sold − already returned.
- Refund value per unit = `line_total ÷ qty_sold × (sale.total_amount ÷ Σ line_totals)` (spreads sale-level discount). When a return empties the sale, the total is forced to exactly `sale.total − earlier returns` (rounding lands on the last line).
- **Cash back:** walk-in → the whole total is cash. Named customer → cash ≤ `max(0, total − balance_before)` (a customer who owes money gets the debt reduced instead; cash only for the part beyond what they owe).
- **Restock** (default on): stock += qty × conversion factor and `stock_movements('return_in', reference 'return')`; `restocked=0` leaves stock untouched.
- Return number `{station}-R-{YYYYMMDD}-{seq4}`. Permanent: no edit/delete/undo; the original sale row is never modified.
- Balance effect: `−(total_amount − cash_refund_amount)` on the customer (see §6.3).

### 6.8 Reports — `pages/Reports/`, `ipc/reports.ipc.js`
- **Reports home** `/reports` (Admin): two-column grid of seven report cards (icon + title + one-line question). Sidebar "Reports" opens it; first tab "All Reports".
- **Shared envelope** from every handler: `{ success, summary:[{label,value,format}], columns:[{key,label,format}], rows, chartData, …extra fields }`. Shared UI: `components/DateRangePicker` (button + popover: Today, Yesterday, This Week, This Month, Last Month, This Year, Custom Range; value `{preset,dateFrom,dateTo}`; also used by Sales History and Returns; exports `computeRange`, `getDefaultRange`), `ReportSummaryCards`, `ReportTable` (sortable, sticky header, optional totals row, column `render` overrides), `ExportButtons` (one Export menu: CSV via `reports:export-csv`, PDF via `reports:export-pdf`), and `parts/` (`ReportShell` frame with loading/error/empty states and caveat footnotes, `ReportBarChart`, `RankedBars`, `ChartCard`, per-report parts, `useReportData`).
- **PDF export:** `exportReportPdf.js` loads the renderer in a hidden window with `?print=1&reportType=…&filters=…`; `PrintReport.jsx` fetches `reports:get-report` and renders a plain black-on-white title/range/summary/table; `printToPDF` → save dialog. The print view does not reuse the on-screen components.
- **The seven reports:**
  1. **Sales** (`reports:get-sales-report`) — Net sales, sales count, average sale (gross ÷ count), returns, retail/wholesale split; net per local day chart (click a bar filters the table to that day); rows of sales. A non-admin caller is **always locked to their own sales server-side**. Extra fields: `netRevenue, grossRevenue, returnsTotal, returnsCount, salesCount, avgSaleValue, retailTotal, wholesaleTotal`, rows carry `sale_day` (local).
  2. **Profit & Loss** — buckets by day (≤31 days), week (≤180) or month. Net sales = sales − returns (by return date); cost of goods = Σ qty × **current** `product_units.cost_price` minus the cost of returned items whose return has `restocked=1`; expenses by `expense_date`; profit. Extra: `totals`, `returnsTotal`, row `grossRevenue/returns`.
  3. **Stock** — per product stock, valuation (stock × cost per base unit from the pack size with the smallest conversion factor), status from `Product.js`; value by category (ranked bars); category filter.
  4. **Customer Statements** — balances from `balanceEngine`; tier filter; "only customers who owe"; largest first; rows open `/ledgers/customers`.
  5. **Supplier Statements** — balances from `balanceEngine`; "only suppliers I owe"; rows open `/ledgers/suppliers`.
  6. **Cashier Performance** — per cashier: sales, net sales (returns charged to the cashier of the ORIGINAL sale, on the return date), returned, average sale, discounts given.
  7. **Expense Report** — date range + recurrence filter; total/count/biggest; spending by recurrence (ranked bars); table with a Repeats badge.
- Caveats shown in-app (keep them): P&L cost uses current buying prices, not prices at time of sale; stock value uses the smallest pack size's buying price; sale payment status is a snapshot from the time of sale.

### 6.9 Home (Admin dashboard) — `pages/Dashboard/Overview.jsx` (+ `parts/`)
Greeting, Getting Started card (until set up), four StatTiles: **Sales Today** (net of today's returns; footnote "{n} sales · {amount} returned"), **Customers Owe You** (sum of positive balances from `balanceEngine` — equals Accounts Overview), **Running Low**, **Expenses This Month**; Sales chart (`dashboard:get-revenue-trend`, 7/30/90 days, net per local day, bar click → Sales Report for that day); Recent Sales; Needs Attention (from `layout/useAlerts.js`, shared with the top-bar bell); Quick Actions; Signed-in sessions. `dashboard:get-summary` also returns `todayGrossSales, todayReturns, todayReturnsCount, totalProducts, deadStockCount, totalCustomers, recentSales`.

### 6.10 Expenses — `pages/Expenses/`, `ipc/expenses.ipc.js`
One-time or repeating (daily/weekly/monthly/annually) with payee, description, amount, date. Creating a repeating expense inserts the first real occurrence **and** a `recurring_expenses` template. `generateDueRecurringExpenses()` (boot + before every expenses read, the expense report and P&L) catches up every missed occurrence; `addPeriod` clamps month/year ends (Jan 31 + monthly → Feb 28/29). Recurrence is locked after creation; "Stop repeating" sets `recurring_expenses.active = 0` (existing rows untouched). Expenses can be edited and hard-deleted. List/detail responses don't carry the series' active flag (see §8).

### 6.11 Printing
- All print paths build from `printing/receiptData.js` (sale + lines + customer + balance when `showDues`).
- **Thermal (retail):** `node-thermal-printer` ESC/POS, silent; printer name + 58/80 mm width in Settings → Printers (test print available). Header/footer are free text (`receipt_header_text/footer_text`, first header line bold). In **dev**, retail prints open `receiptPreview.js` (visible window, `?print=1&printMode=receipt`, "Export as Image").
- **A4 (wholesale):** if the sale has a letterhead with a PDF on disk, `pdfInvoiceMerge.js` stamps the invoice onto the template as vector text (paginates, keeps totals together), writes it under `userData/receipts/`, prints via a visible OS dialog; the confirm sheet embeds that PDF. No letterhead → HTML fallback (`printMode=invoice-fallback`). Missing PDF file → error asking to re-upload.
- **Payment receipts:** thermal or A4 (`printing:print-payment-receipt`).
- Receipts/invoices use `settings.currency_symbol` (default `Rs.`).
- **Report PDFs:** separate path, §6.8.

### 6.12 Multi-PC sync (LAN, no cloud)
- **Discovery** (`discovery.js`): UDP broadcast on port **41234** every 5 s `{machineId, stationCode, role, tcpPort}`; peers unseen for 30 s show offline but are kept (`sync_peer_state`).
- **Transport** (`syncServer.js`): every PC runs Express on port **4000** with `POST /sync/exchange`, requiring header `x-sync-secret` = `license_activation.sync_secret` (401 otherwise). Authenticated but **not encrypted**.
- **What travels** (`syncSchema.js`): `categories, products, product_variants (minus stock_qty), product_units, customers, suppliers, users, user_permissions, letterheads, percentage_pricing_rules` (upsert; last write wins), `sales, sale_items, sale_returns, sale_return_items, payments, purchases, purchase_items, ledger_adjustments` (insert-only, dedup by uuid), `stock_movements` (dedup by uuid, then applied as a **delta** to the local `stock_qty`). Deletes travel only for `user_permissions`, `letterheads`, `percentage_pricing_rules`. **Not synced:** `settings`, `expenses`, `recurring_expenses`, `sessions`, `activity_log`, `license_*`, dev tables, and category deletes.
- **UUIDs/outbox/triggers** (022 + 026): every synced table has a `uuid` filled by an AFTER INSERT trigger; AFTER INSERT/UPDATE(/DELETE) triggers append to `sync_outbox`, so app code never queues anything. Master tables also get `origin_station`. `recordCodec` swaps local FK ids for uuids on the wire (incl. polymorphic `payments.party_id`, `ledger_adjustments.party_id`, `stock_movements.reference_id`); `applyIncoming` applies a batch in one transaction, deferring records whose references haven't arrived and retrying until no progress.
- **Rounds:** debounced 4 s after any write that grows the outbox (middleware), plus every 25 s against all known peers; manual "Sync now" in Settings → Connected Computers. Per-peer watermarks advance only after a confirmed round trip. Results in `sync_log`.
- **Conflicts:** single writer per record is assumed; concurrent oversells can drive `stock_qty` negative and are left visible — `sync:get-reconciliation-warnings` lists negative-stock variants.
- **Letterhead PDF files are not synced** — only the row/path.

### 6.13 Settings & Cashiers — `pages/Users/` (+ `parts/`), `pages/Settings/` (+ `parts/`)
Admin-only (hard role gate on every page). Pages keep state/IPC in the top-level file; presentation lives in `parts/`.
- **Cashiers** (`CashierList`): search, sort (+ direction), DataTable rows (Avatar + name, username, "{n} permissions" badge with a tooltip — counts fetched per cashier via `permissions:get-for-user`, status badge), per-row Reset Password (`parts/ResetPasswordModal.jsx`, shared with the profile) and an active switch (deactivating asks first). Row opens `/cashiers/edit`.
- **Add/Edit Cashier** (`CashierForm`): Account card (full name; username + password/confirm on create, username read-only on edit, live uniqueness check on blur), "What this cashier can do" card rendering every `permissions:get-definitions` entry in catalog order (booleans → switch, `max_discount_percentage` → % box, blank = shop default). Plain-words titles/subtitles per key live in `parts/CashierFormParts.jsx` (`PERMISSION_COPY`, falls back to the catalog text). Edit header: Reset Password + Activate/Deactivate (acts immediately via `users:set-active`; save still sends `setActive` as before). Sticky save bar; field errors focus the first problem field.
- **Session Activity** (`CashierSessions` → `SessionDetail`): search, cashier filter (`sessions:list` `cashierId`), sort; columns signed in / signed out ("Still signed in" badge) / duration / activity count. Detail = header + vertical timeline; action names mapped to plain words (`login` Signed in, `logout` Signed out, `sale_created` Made a sale; unknown names title-cased). No date-range filter and no computer column (the data has neither).
- **Settings tabs:** Preferences (Shop: currency symbol · Products: default low-stock warning · Sales: shop default discount cap; one sticky Save), Receipt Header & Footer (form + live receipt-slip preview at the saved paper width; sticky Save), Letterheads (card grid; dashed "Upload a letterhead (PDF)" opens the picker then an add sheet with name/PDF preview/margins/default; Edit, Set as Default (same `letterheads:update` call), Delete with confirm), Printers (Receipt printer card: printer + paper width + Save + "Print a test page" — test uses the *saved* printer, so it's disabled while there are unsaved changes; A4 printer card explains A4 uses the Windows print dialog), Connected Computers (Connection Code = sync secret with copy, this computer + Sync now, negative-stock warnings, peer list with per-peer Sync now, sync history in a Disclosure; refreshes every 5 s), Backup & Restore (create backup, restore asks first then opens the picker, red Danger Zone "Erase Everything & Start Over" with type-RESET), License (read-only list of `license:get-status` fields + Computer ID copy).

### 6.14 Global search & top bar
`global:search` (products by name/SKU/barcode, customers and suppliers by name/phone, with balances) feeds `SearchPalette` (Ctrl+K), which also lists every visible page/tab. Top bar: back button + title, search trigger, sync chip, alerts bell, quick add.

---

## 7. The iOS-style redesign (13 phases)

A **UI/UX redesign layered on top of the working app — not a rewrite of logic, IPC or the database.** Each phase restyles pages and may add small read-side fields; business rules stay as in §6.

| # | Phase | Status | Covers |
|---|---|---|---|
| 1 | Design foundation | DONE | `theme.js` iOS tokens, component kit, `appIcons.js`, `glossary.js`, Inter font, GlobalStyles, Design Gallery |
| 2 | App shell & navigation | DONE | Sidebar groups, top bar, SectionTabs, Ctrl+K SearchPalette, navConfig sections/tabs/pages |
| 3 | First run / setup / login | DONE | SetupShell, ChooseRole, SetupAdmin, SetupCashier, CashierInitialSync, Login |
| 4 | Cashier Mode (POS) | DONE | Sale.jsx split into `POS/parts/` panels, StepStrip, KeyHints, UndoPill, SaleCompleteSheet |
| 5 | Dashboard | DONE | Home StatTiles, revenue chart, recent sales, needs attention, quick actions, signed-in card |
| 6 | Products core | DONE | Product list/detail/bulk bar, product form sections, categories, import |
| 7 | Stock operations | DONE | Purchases, Fix Stock Count, Stock History, Running Low, Not Selling |
| 8 | Customers & Suppliers | DONE | Lists, forms, starting balance field, Special Margins, Parties shared parts |
| 9A | Accounts | DONE | Ledgers overview, account views/timeline, payments, paid in advance, overdue, corrections |
| 9B | Receive Payment & Expenses | DONE | Record payment flow + done sheet; expense list/form |
| 10A | Sales History | DONE | Sales list/toolbar/detail sheet; cashier layout with Menu (`CashierRoutes.jsx`) |
| 10B | Returns | DONE | Returns flow, list and detail; returns in balances/timelines |
| 11 | Reports | DONE | Reports home, ReportShell + charts, all seven reports restyled, net-of-returns and local-day numbers everywhere |
| 12 | Cashiers & Settings | DONE | Cashier list/profile/permissions, reset password, activate/deactivate, Session Activity list + timeline, and all seven Settings pages restyled (`pages/Users/parts/`, `pages/Settings/parts/`) |
| 13 | Polish & final build | DONE | Colour/wording sweep, currency symbol from settings, POS low-stock uses each product's warn-below, brand on Product List rows, server-side Special Margin checks, focus-ring fix, production installer. **The redesign is complete.** |

**Design system rules (keep consistent):**
- **Styling:** inline `style={{}}` objects driven by `config/theme.js` only. No CSS files, Tailwind or CSS-in-JS (sole exception: `components/GlobalStyles.jsx` for keyframes, focus rings, placeholder/selection). **No raw hex/rgb in components.**
- **`theme.js`:** `colors` = iOS palette (`accent`, `green/red/orange/yellow/teal/indigo/purple/pink/gray/blue` each with `Tint` and `Text` variants, `bg`, `surface`, `surfaceAlt`, `fill`, `fillStrong`, `label`, `labelSecondary`, `labelTertiary`, `labelOnAccent`, `separator`, `separatorStrong`, `focusRing`…) plus legacy aliases (`primary`, `textPrimary`, `accentBlue`, `success`, …) so old pages still resolve; `spacing`, `radius`, `shadow`, `font` (Inter, `numeric` = tabular-nums), `type` (largeTitle…caption), `motion` (fast 120ms, base 180ms), `control` heights.
- **Kit** (`components/kit/*`, import from `components/ui.jsx`): Icon, IconTile, Button, IconButton, Field/Label/TextInput/NumberInput/TextArea/Select/SearchField (`FieldError` has `role="alert"`), PasswordInput, Toggle, Checkbox, SegmentedControl, Card, PageHeader (legacy), Banner, Badge, Kbd, ListSection/ListRow, Spinner, Skeleton, EmptyState, Toast (`useToast`), Modal, Confirm (`useConfirm`), Popover/Menu/MenuItem/MenuDivider/MenuHeader, Tr/tableStyles/DataTable, Disclosure, Stepper, ChipGroup, Avatar. Plus `BalanceChip` for balances.
- **`config/appIcons.js`:** one Lucide icon + color per concept (`<IconTile {...appIcons.products} />`). Lucide + Inter only — no SF Symbols / San Francisco.
- **`config/glossary.js`:** plain-words labels used everywhere (Home, New Sale, Receive Payment, Accounts, Running Low, Not Selling, Price Level, Special Margins, Fix Stock Count, Balance corrections…); `glossaryChanges` lists old→new terms.
- **Design Gallery:** Ctrl+Shift+G, dev builds only (`pages/Dev/DesignGallery.jsx`).
- Color meaning: blue action/selection, green money in/success/profit, red error/loss/overdue, orange warning, gray neutral — never color alone. Desktop density (body 14px, controls 34–36px, rows 44–56px). Animate only opacity/transform at 120–200ms. Pages don't render their own title or tab bar (the shell does).

---

## 8. Known gaps / deliberately out of scope (unresolved)

- **Customer and Supplier lists have no active/inactive "Show" filter** — both only ever show active parties, so a deactivated customer/supplier disappears from the UI with no way to review it. Open on purpose: an owner decision (does the owner ever need to see inactive parties?).
- **Recurring expenses:** no stored "stopped" status distinct from "still repeating" is returned with the expense data (`recurring_expenses.active` exists but isn't in list/detail responses); the UI works around it. Data model left as is.
- **Cashiers / Session Activity:** the cashier list has no active/inactive "Show" filter, and sessions carry no computer/station or date-range filter.
- **Intentional raw colours (not tokens):** print-only views (`pages/Print/*`, `components/receipt/ThermalContent.jsx`) are fixed black-on-white for paper, and the Dev Panel (`components/DevPanel/*`, `DevPanelTrigger.jsx`) has its own dev theme.
- **Cashiers reach their permitted pages through a Menu** in the cashier layout, not a sidebar — **intentional, not a bug.**
- Also true today: P&L uses current cost prices; Overdue Payments aging is a per-sale approximation and customers-only; category cycles deeper than self-parenting aren't checked; sync is unencrypted and doesn't copy letterhead PDFs; expenses/settings don't sync; single Admin account only; no test suite; `sales:create` doesn't re-validate the discount cap server-side.

## 9. Known gaps already fixed (don't "fix" these again)

Phase 11 fixed:
- **UTC vs local day:** Reports, Home and Sales History all filter/group by the local calendar day (`date(x,'localtime')`); period inputs are local `YYYY-MM-DD`; user-entered expense dates are used as-is.
- **Returns netted out everywhere:** net sales = Σ sales − Σ returns (counted on the return's day) in the Sales Report, P&L (incl. cost of restocked returned items), Cashier Performance (against the original sale's cashier), Home "Sales Today" and the Home chart.
- **Home "Customers Owe You"** now sums positive `balanceEngine` balances, so it equals the Accounts Overview total receivable (it used to sum `sales.balance_due` snapshots).

---

Phase 13 fixed:
- Currency symbol: `utils/format.js` reads `settings.currency_symbol` once at startup (`main.jsx`) and on Preferences save; "Rs" fallback.
- POS "Only N left" compares against each product's `min_stock_alert` (fallback 5).
- Product List rows show brand · item code (`products:list` selects `company_name`).
- `percentage-rules:create` rejects a margin ≤ 0% and duplicate product + customer/tier rules.
- Product-form "SKU" error messages now say "item code"; Item picker input shows the focus highlight.

## 10. Tech stack & scripts

```
npm run dev            concurrently: vite (5173) + wait-on tcp:5173 → cross-env NODE_ENV=development electron .
npm run build:renderer vite build  → src/renderer/dist
npm run dist           build:renderer + electron-builder --win (NSIS installer → release/)
npm test               stub (no tests)
```
- **Runtime deps:** react / react-dom / react-is 19, better-sqlite3 13, bcrypt 6, express 5 (sync server), node-thermal-printer 4, pdf-lib 1.17, node-machine-id, recharts 3, lucide-react, @fontsource-variable/inter.
- **Dev deps:** electron 44, electron-builder 26, vite 8 + @vitejs/plugin-react, @electron/rebuild, concurrently, cross-env, wait-on.
- **Packaging** (`electron-builder.yml`): appId `com.arwaat.stationerysystems`, productName "ARWAAT Stationery Systems", files `src/main/**`, `src/renderer/dist/**`, `src/shared/**`, `package.json`; `asarUnpack` better-sqlite3 + bcrypt; Windows NSIS (not one-click, choose dir, desktop + start-menu shortcuts), icon `build-resources/icon.ico`.
- **Data location:** `%APPDATA%/stationary-pos-app/pos.db` (Electron `userData`; package name `stationary-pos-app`), plus `letterheads/` and `receipts/` folders there. Dev loads `http://localhost:5173`; production loads `src/renderer/dist/index.html`.
- Native modules must match Electron's Node ABI (`@electron/rebuild`); scripts that open the DB outside the app run via `ELECTRON_RUN_AS_NODE=1 electron <script>`.
