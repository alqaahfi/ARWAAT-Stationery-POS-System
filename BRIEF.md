# Battle test brief (owner's full text; AGENTS.md has the condensed rules)

Battle test: harden the app for real shop use, test everything to its limits in dev mode, fix as you go.

## 0. How to work
- Written for any coding agent. Read SYSTEM_STATUS.md, AGENTS.md, TEST_PROGRESS.txt first. Code beats docs.
- Continue from the first unfinished stage in AGENTS.md. After EVERY stage (and long pieces of work inside one) update the handoff files and commit.
- Do NOT stop to ask questions. Choose the safest behaviour for a real shop, write the decision in TEST_PROGRESS.txt, continue.
- Every bug: fix in code (smallest correct fix), re-run the failing check until it passes, commit with a one-line message. Never weaken a check or a business rule. Never "fix" a test by adding sleeps when the app has a timing bug.
- All testing in DEV mode (Vite + Electron from node_modules), driving the real Admin and Cashier windows with the Playwright harness in tests/e2e/. No installer builds.
- No interactive UI walkthroughs for the developer - run automated; look at screenshots yourself.
- When done: update SYSTEM_STATUS.md (new rules, features, test harness, manual-only items), write test-results/TEST_RESULTS.txt (one line per check: ID, PASS/FAIL, note), mark AGENTS.md "ALL STAGES DONE", final message <= ~20 lines.
- Model split: Stage 1 (money/stock/balance logic) = strongest model; Stages 2-4 = faster model; a bug unfixed after 3 honest attempts goes to the strongest model.

## 1. Context
ARWAAT Stationery Systems - offline Electron 44 + React 19 + better-sqlite3 POS for one stationery/book shop in Pakistan (Rs, UTC+5). One process, two windows: Admin and Cashier (separate sign-ins, single-instance lock, one shared database). Optional LAN sync. Inline styles from config/theme.js tokens only, no CSS files, hand-rolled router. Previous session built tests/e2e/ and fixed 8 bugs (backup via SQLite online backup, busy_timeout, scanner focus/glue/Enter, server-side sale validation, invoice number reuse, restore validation). The shop is real.

## 2. Stage 1 - Business rules (implement all, server-side first, then UI)
Do these BEFORE the big test run, each with its own commit. Add migrations where needed (next free number), register any new/changed synced columns or tables in sync/syncSchema.js the same way existing ones are. Factory reset must clear new tables.

1. **Server checks every sale price.** In sales:create and sales:update, re-resolve each line's unit price with the price engine for that customer and pack size. If the sent price differs (beyond 0.01), refuse - unless the caller is the Admin (manual price override only for Admin). Store the server's price.
2. **Credit limit = warning only.** When a credit sale would push a named customer over a non-blank credit limit, show a clear warning with the numbers ("This puts Ahmed at Rs 12,500, over his limit of Rs 10,000") that the user can accept. Never block.
3. **Whole numbers only, everywhere.** Sale, free (FOC), return, purchase, stock add/remove, fix stock count, quick-add quantities: positive whole numbers only. Enforce on the server; inputs refuse decimals as you type.
4. **Barcodes stay per product/Type** (no per-pack-size barcodes). Scanning adds 1 of the default pack size.
5. **Voids are kept, not deleted.** Add to sales: is_voided, voided_at, voided_by (no reason needed). A voided bill puts its stock back (as today), stays visible in Sales History with a red "Voided" badge, prints "VOIDED" if reprinted, can't be edited/returned, and counts as ZERO everywhere: every report, Home, cashier performance, balances (balanceEngine), ledgers, day totals, customer statements, sync. Its linked payments must also stop counting (mark them voided too, or exclude by join - pick one and apply consistently). Grep EVERY query that sums or lists sales, sale_items or payments and exclude voided rows. Invoice numbers are never reused.
6. **Below-cost price = warning.** Product form and Admin price override warn when a selling price (retail, wholesale, any price level, or override) is below the buying price; allowed after confirm. Cashiers can never sell below cost unless that price was set by the Admin on the product.
7. **Duplicate customer phone/mobile = warning**, allowed after confirm.
8. **No exchange screen.** Return + new sale is the process.
9. **Cash only, everywhere.** Remove the Cash/Bank/Other choice from the POS, Receive Payment and Pay Supplier screens; the server records 'cash' for every new payment. Old records keep their method and still display it. POS payment step: "Amount received" and "Change" only. Credit (udhaar) for named customers stays.
10. **No rounding** of totals.
11. **Quick-add a missing item at the POS.** New permission "Add missing items at the counter" (on by default for cashiers; Admin always can). In the item search, when nothing matches, offer "Add new item" (also a key, e.g. F6 - note F6 is currently Return, pick a free key): Barcode (optional, must be unique, pre-filled if the search text was a scanned barcode), Name (required; warn if a similar name exists and show it so they can pick it instead), Retail price (required, > 0). Creates a real product flagged needs_review with one "Piece" pack size (retail = wholesale = typed price, buying price unknown), adds it to the cart. It can be sold even with no stock (stock goes negative). Admin side: a "Needs review" list (Products tab, with a count badge and a Home "Needs attention" row): set buying price, other prices, category, stock, then Approve - or Merge into an existing product (moves its sales/stock history to that product, then deactivates it). Profit & Loss and the stock report clearly flag "buying price missing" items instead of silently using 0.
12. **Admin approval on the cashier screen.** A small "Admin approval" box (Admin username + password, server-verified, lockout rules apply) for: discount above the cashier's cap, selling an item with not enough stock (stock goes negative; item added to a "Stock to recount" list on the Admin side), voiding or editing a bill older than 10 minutes. Record every approval in a new approvals log (what, bill, cashier, admin, when). The cashier stays signed in.
13. **Cashier bill edits/voids:** their own bills only, within 10 minutes of saving; after that only with Admin approval. Admin unrestricted (except bills with returns, as today).
14. **Reprints print "DUPLICATE COPY"** with the reprint date/time (thermal and A4). The first print after saving is the original.
15. **Wrong computer clock = warning.** If the clock is earlier than the newest saved sale, or the year is before 2026 or more than 2 years ahead, show a persistent warning banner in both windows ("The computer's date/time looks wrong - fix it before selling"); selling is still allowed.
16. **Automatic daily backup.** Once a day (at first app start of the day and at midnight if running), make a backup with the same safe method as manual backup into a folder (setting, default Documents\ARWAAT Backups), keep 30 days, delete older ones. Home shows a weekly reminder "Copy a backup to a USB drive" with the folder path; Settings -> Backup shows the last automatic backup time and lets the Admin change the folder. A failed automatic backup shows on Home.
17. **Return search without the bill.** In Returns step 1, also search bills by item name/barcode, customer and date. No-bill return (Admin only): pick product + quantity, refund at that item's lowest selling price in its last 30 days of sales (or current retail if never sold), cash only, stock back in, recorded as a return with no sale link (adjust the schema/rules so this is clean, and keep it out of the per-sale returnable logic).

Also research and handle common real-world counter anomalies the app may still miss. At minimum make sure these behave sensibly and test them in Stage 3: power cut/crash mid-sale (draft recovery), app closed with a held bill, the same item scanned on two windows at once, price changed by Admin while a bill is open (bill re-priced with a notice when the line is next touched, or at payment), product deactivated while in a cart, customer deactivated while selected, scanner sending a barcode with spaces/newline/lowercase, a barcode that matches a product name, paying with exact amount by pressing Enter, cash received less than total for a walk-in (blocked with clear message), very large quantity typo (confirm when a line's quantity is > 100 or its total > Rs 100,000), double Enter / double click on Pay (one sale only), printer off/out of paper/unplugged (sale saved, clear message, reprint later), switching windows mid-sale, signing out with an open cart (held automatically), two cashiers on two PCs selling the last unit. Add anything else you find in research of real POS failure modes that fits a small shop. Note each one in TEST_PROGRESS.txt.

## 3. Stage 2 - Make the test harness reliable
- Native file dialogs blocked the last run. Add a test-only bypass: when env ARWAAT_TEST_MODE=1 is set (dev only, ignored in packaged builds), backup/restore/export/letterhead pickers read the path from env/test hook instead of opening a native dialog. Remove tools/file-dialog.ps1 use.
- Fix flaky waits by waiting on real app state (element text, IPC result, DB row), never fixed sleeps.
- Speed: TEST_SPEED=fast for the full run. Each script must start from a known state (restore CLEAN-MASTER via the bypass).
- Rebuild CLEAN-MASTER.db through the app with the data in TEST_PROGRESS.txt.

## 4. Stage 3 - Run everything, fix everything
Run and pass every section in TEST_PROGRESS.txt "TESTS STILL TO RUN" A-Q (rule changes above replace conflicting items: voids kept, cash-only payments, whole-number quantities), plus checks for every Stage 1 rule and every anomaly.
- A: the full shop day in ONE clean run. Recompute every expected number from the rules (hand-check) and compare every report, Home tile, ledger and stock figure. Every total must equal the sum of its rows.
- Bad input sweep (O) on EVERY text and number field of EVERY form: empty, whitespace only, 500+ characters, emoji, Urdu, quotes, ' OR 1=1 --, <script>, negative, zero, 1e9, -0, "abc", pasted values. Never crash, never store garbage, never show a raw error/stack trace; plain-words messages.
- Concurrency (L): Admin and Cashier windows at the same time - cashier selling continuously while Admin edits prices, adds stock, runs reports, makes a backup. No "database is locked", no lost or duplicated sale, no duplicate invoice number.
- Crash (M): kill Electron at random points during sale save, return, purchase, backup, restore. After restart: data fully saved or fully absent, PRAGMA integrity_check = ok, stock = opening + purchases - sales + returns +/- adjustments for every item.
- Bombard: thousands of random but valid operations (sales, returns, payments, purchases, stock fixes, voids, quick-adds, approvals) as both users, then verify invariants: every stock = sum of its movements; every customer/supplier balance from balanceEngine = ledger timeline's last running balance = statement report; sum of all (sales - returns) non-voided = Sales report net; no negative stock except approved/quick-add cases (all on the recount/review lists); invoice numbers unique and never reused.
- Load (P): 10,000 items, 2,000 customers, 50,000 sales over 5 years (realistic). Targets: item search < 300 ms, barcode add < 200 ms, sale save < 500 ms, one-month report < 3 s, one-year report < 10 s, app start < 10 s, every list page usable (paged, no freeze). Fix slow queries with indexes (migration) or paging, not by removing features.
- Dates (N): sales at 23:59 and 00:01 local, month end, year end, 29 Feb 2028, wrong clock warning.
- Security (Q): repeat the IPC permission sweep for every channel incl. new ones (approval, quick-add, review, auto-backup settings); no secrets in logs or audit rows.

## 5. Stage 4 - Screenshot every page and form, fix UI/UX bugs
For BOTH windows at 1366x768, 1920x1080 and a half-screen window (683x768): every route, tab, form (empty, filled, validation errors), modal/sheet/confirm, empty state (fresh DB), loading state where reachable, and the large-data state. Save to test-results/screens/<window>/<size>/<page>-<state>.png. Look at each screenshot and fix: cut-off/overlapping text, horizontal scroll, controls off-screen, buttons hidden behind the bottom-right Dev Panel icon, misaligned columns, unreadable contrast, numbers not right-aligned/tabular, raw hex colours, untranslated old labels, "undefined"/"NaN"/"null" on screen, missing empty/loading/error states, broken keyboard focus order, Esc not closing overlays. Re-shoot after fixing. Also screenshot every printed document via the print preview views (thermal, A4 on letterhead and fallback, payment receipts, reports PDF, duplicate copy, voided) and check the ARWAAT line is at the bottom and nothing overlaps.

## 6. Rules
- Inline styles from theme.js tokens only; no new dependencies unless a test tool truly needs one (dev dependency only).
- Don't change features beyond Stage 1 and bug fixes. Keep every existing route and permission.
- Every fix that changes money, stock or balance logic needs a check that proves it.
- Hardware-only checks (real scanner, thermal printer, power cut, sleep, USB drive, real shop use) can't be automated: list them in TEST_RESULTS.txt as MANUAL with exact steps.
- Before stopping for any reason: update AGENTS.md and TEST_PROGRESS.txt, then commit.

## 7. Done when
1. All Stage 1 rules work and are proven by checks.
2. Every Stage 3 check passes in one clean full run, incl. full shop day, bombard invariants, crash, concurrency, load targets.
3. Every page/form/print screenshotted at the three sizes and UI issues fixed.
4. TEST_RESULTS.txt and SYSTEM_STATUS.md written/updated, AGENTS.md says ALL STAGES DONE, TEST_PROGRESS.txt final, everything committed.
