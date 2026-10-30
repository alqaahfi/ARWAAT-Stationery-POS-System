# AGENTS.md - handoff for any coding agent

Read this file first, then SYSTEM_STATUS.md (code wins when they disagree), then TEST_PROGRESS.txt (detailed log).

## What this is
- ARWAAT Stationery Systems: offline Electron 44 + React 19 + better-sqlite3 POS for ONE stationery/book shop in Pakistan (Rs, UTC+5).
- One process, two windows (Admin, Cashier), separate sign-ins, single-instance lock, one shared SQLite database. Optional LAN sync.
- Inline styles from src/renderer/config/theme.js tokens only, no CSS files, hand-rolled router. The shop is real: a wrong total, lost sale or crash costs the developer's reputation.

## How to run
- Dev app: `npm run dev` (Vite + Electron admin), `npm run dev:cashier` for the cashier window.
- E2E tests (dev mode only, no installer builds): `node tests/e2e/run-all.js [script names]`
  - scripts: 00-setup 01-data 02-login 03a-restore 03-shopday 03b-shopday-admin 03c-shopday-verify 04-checks 05-ops 06-concurrency-crash
  - env: `TEST_SPEED=slow|normal|fast` (use fast), `KEEP_DATA=1` keep the DB, `ARWAAT_TEST_MODE=1` (Stage 2: file pickers read a path from env instead of a native dialog; dev only), `ARWAAT_INSTALLED=1` drive an installed exe.
  - harness starts Vite (5173) + `node_modules/electron/dist/electron.exe . --mode=<m> --remote-debugging-port=9333`; ELECTRON_RUN_AS_NODE must be deleted from the spawn env (done in tests/e2e/lib/h.js).
  - `node tests/e2e/report.js` builds test-results/TEST_RESULTS.txt from test-results/results.json + meta.json.
  - App-only screenshots: `node tests/e2e/tools/app-shot.js <label>`.
- Stage 1 rules checks (no GUI): `npm run test:rules` (or `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe tests/rules/run.js [r01 r05 ...]`). Prints PASS/FAIL per check ID; all must pass.
- Renderer build check: `npx vite build --outDir <temp dir> --emptyOutDir`.
- Build (the developer does this, not agents): `npm run dist`.

## Status
| Stage | What | Status | Next concrete step |
|---|---|---|---|
| 1 | 17 business rules + anomaly handling (server first, then UI), one commit per rule | DONE (R1-R17 + anomalies R18; `npm run test:rules` = 138/138 incl. the R19 update checks) | - |
| 2 | Reliable harness (ARWAAT_TEST_MODE, state-based waits, TEST_SPEED=fast, CLEAN-MASTER rebuild) | DONE | - |
| 3 | Full e2e A-Q, bombard, crash, concurrency, load, dates, security | SKIPPED by the owner (short on time/quota). Done instead: big-database freeze fixed + load targets measured (SYSTEM_STATUS 11.1), `07-stage1-ui` run | Optional later: run the chain in FINAL-TEST.md section 5 |
| 4 | Screenshot every page/form/print at 3 sizes | SKIPPED by the owner | Optional later |
| Updater | In-app updates from the private GitHub repo, safe start-up migrations + recovery screen, pre-update backup, version-gated sync, release scripts | DONE (SYSTEM_STATUS section 11) | Real publish/install cycle is a MANUAL check (see below) |

Model note: Recommended: run Stage 1 with the strongest available model (money/stock/balance logic), Stages 2-4 with a faster one. If a bug survives 3 honest attempts in Stages 2-4, hand just that bug to the strongest model.

## Owner's business decisions (Stage 1 list)
1. Server re-resolves every line price (price engine, per customer + pack size); mismatch > 0.01 refused unless caller is Admin (manual override Admin only). Store the server's price.
2. Credit limit = warning only (show numbers, user can accept, never block).
3. Whole positive numbers only for every quantity (sale, FOC, return, purchase, stock add/remove/fix, quick-add); server enforces, inputs refuse decimals.
4. Barcodes stay per product/Type. Scan adds 1 of the default pack size.
5. Voids are kept (sales.is_voided, voided_at, voided_by): stock restored, visible in Sales History with red "Voided" badge, reprint says VOIDED, no edit/return, counts as ZERO everywhere (reports, Home, cashier performance, balances, ledgers, day totals, statements, sync); linked payments stop counting too. Invoice numbers never reused.
6. Below-cost price = warning (product form + Admin price override), allowed after confirm. Cashiers never sell below cost unless Admin set that price on the product.
7. Duplicate customer phone/mobile = warning, allowed after confirm.
8. No exchange screen: return + new sale.
9. Cash only everywhere (POS, Receive Payment, Pay Supplier); server records 'cash'; old records keep their method. POS payment step: "Amount received" and "Change". Credit for named customers stays.
10. No rounding of totals.
11. Quick-add a missing item at the POS (permission "Add missing items at the counter", default on for cashiers): barcode optional+unique, name required (warn on similar), retail price > 0; creates product flagged needs_review with one "Piece" pack size; sellable with no stock (goes negative). Admin "Needs review" list (Products tab, count badge, Home "Needs attention"): set prices/category/stock then Approve, or Merge into an existing product. P&L and stock report flag "buying price missing".
12. Admin approval box on the cashier screen (admin username+password, server-verified, lockout rules apply) for: discount above cap, selling more than stock (stock goes negative, added to "Stock to recount"), voiding/editing a bill older than 10 minutes. New approvals log. Cashier stays signed in.
13. Cashier edits/voids: own bills only, within 10 minutes of saving; later only with Admin approval. Admin unrestricted (except bills with returns).
14. Reprints print "DUPLICATE COPY" + reprint date/time (thermal and A4). First print after saving is the original.
15. Wrong computer clock warning banner in both windows (earlier than newest saved sale, year < 2026 or > 2 years ahead); selling still allowed.
16. Automatic daily backup (first start of the day + midnight), same safe method as manual, folder setting default Documents\ARWAAT Backups, keep 30 days, weekly "copy to USB" reminder on Home, Settings -> Backup shows last auto backup + folder change, failure shown on Home.
17. Returns step 1 also searches bills by item name/barcode, customer, date. No-bill return (Admin only): product + quantity, refund at the item's lowest selling price in last 30 days of sales (else current retail), cash, stock back in, recorded as a return with no sale link.
Anomalies to handle + test (Stage 3): see the brief list (draft recovery after crash, held bill on close, same item on two windows, price change while bill open, product/customer deactivated mid-sale, scanner spaces/newline/lowercase, barcode equals product name, exact amount via Enter, walk-in underpay blocked, qty > 100 or line > Rs 100,000 confirm, double Enter/click on Pay = one sale, printer off = sale saved + clear message, window switch mid-sale, sign-out with open cart holds it, two cashiers selling the last unit).

## Rules for agents
- Read SYSTEM_STATUS.md first. Inline theme.js styles only, no CSS files, no new dependencies (dev deps only if a test tool needs it).
- Fix every bug in code (smallest correct fix), re-run the failing check, commit with a one-line message. Never weaken a check or a business rule; never add sleeps to hide an app timing bug.
- Migrations: next free number (042+); register new/changed synced columns/tables in src/main/sync/syncSchema.js; factory reset must clear new tables.
- Every money/stock/balance fix needs a check that proves it.
- Do not stop to ask questions: choose the safest behaviour for a real shop, note the decision in TEST_PROGRESS.txt.
- Update this file and TEST_PROGRESS.txt and commit before stopping for any reason.
- Hardware-only checks go in test-results/TEST_RESULTS.txt as MANUAL with exact steps.

## Where files live
- tests/e2e/ (scripts, lib/, tools/), test-results/ (results.json, screens/<window>/<size>/<page>-<state>.png, TEST_RESULTS.txt), test-backups/ (CLEAN-MASTER.db etc.), TEST_PROGRESS.txt, SYSTEM_STATUS.md.

## Releasing (in-app updates) - the developer does this, not agents
1. Set env `GH_TOKEN` (uploads the release) and `GH_UPDATE_TOKEN` (read-only token baked into the app); restart VS Code. Never print/commit/log them.
2. Commit everything (the release script refuses a dirty tree; electron-builder sometimes makes two half-filled drafts - `scripts/consolidate-draft.js` merges them automatically at the end of the release, or run it alone). `npm run release` (patch) or `npm run release:minor`: bumps the version, commits "Release vX", pushes, builds, uploads a **draft** GitHub release (installer + blockmap + latest.yml).
3. On GitHub -> Releases: add short notes, press **Publish** (installed apps only see published releases).
4. First install of the updater build in the shop: by hand (data stays). Later updates: commit -> `npm run release` -> publish -> the Admin uses Settings -> Updates -> Update now.
5. `npm run dist` builds the installer locally without publishing. Do NOT run it while e2e tests are running (it rebuilds native modules).
- MANUAL check (needs two published versions): install N, publish N+1, Update now; the pre-update backup appears in `%APPDATA%\stationary-pos-appackups\pre-update\`, the app returns on N+1 and Home says "Updated to version N+1".
- Never change package.json `name` (`stationary-pos-app` decides the userData folder), `appId` or `productName`.

## LATEST (see FINAL-TEST.md)
- FINAL-TEST.md is the earlier end-of-session report (its open problems are addressed in SYSTEM_STATUS section 11 and TEST_PROGRESS.txt, finish-up run). The 50k-sale load DB is kept at test-backups/antigravity-load-db/ (git-ignored).
