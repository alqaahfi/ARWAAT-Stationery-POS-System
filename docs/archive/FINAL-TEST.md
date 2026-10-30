# FINAL-TEST report - ARWAAT Stationery POS battle test (2026-10-30)

Status: **NOT COMPLETE.** Stage 1 (business rules) and Stage 2 (test harness) are done. Stage 3 (full test run) is only partly run. Stage 4 (screenshots) was not done. The run was stopped on request. Nothing below is claimed as passing unless it was seen passing.

## 1. What is proven (seen passing)

| What | Result | How it was checked |
|---|---|---|
| Stage 1 rules 1-17 + counter anomalies (R18) at the server/data level | **128 / 128 PASS** | `npm run test:rules` (tests/rules/checks/r01..r18), re-run by me at the end of this session |
| Renderer builds | PASS | `npx vite build` to a temp folder |
| All main-process JS files parse | PASS | `node --check` on every file |
| No TODO/FIXME markers left in src/ | PASS | grep |
| Fresh setup screen, empty form and short password refused (SET-01..03) | PASS (6 e2e checks passed in my last, aborted run) | tests/e2e 00-setup, start of 02-login |

Rule check IDs: R01 price, R02 credit limit, R03 whole numbers, R04 barcodes, R05 voids, R06 below cost, R07 duplicate phone, R08 no exchange, R09 cash only, R10 no rounding, R11 quick-add, R12 approvals, R13 cashier 10-minute window, R14 duplicate copy, R15 clock, R16 auto-backup, R17 returns search + no-bill return, R18 anomalies (scanner whitespace/case, deactivated product/customer, qty > 100 / line > Rs 100,000 confirm, price changed while open, two cashiers last unit, printer off).

## 2. Antigravity's e2e run (earlier today) - recorded from memory of the results file
The results file for that run (123 checks) was **overwritten** when I reset `test-results/results.json` to start a clean re-run, so only this summary survives. Counts at the time: 109 PASS, 9 FAIL, 4 NOT APPLICABLE, 1 NEEDS DECISION.

Failures at that time (all need a re-run to know whether they are app bugs or test-selector problems):
- LOAD-P01: one-month Sales Report took 20,294 ms on 10,000 items / 2,000 customers / 50,000 sales (target 3,000 ms). A later commit (85c50ca) changed the report to filter on `created_at` directly (an index `idx_sales_created` already exists). **Not re-measured.** Other reports (one-year, profit/loss, stock) were not looked at.
- UI-ADMIN-1366x768 / 1920x1080 / 683x768: Admin visual audit timed out waiting for "Customer Name" (customer form) - **test or app, unknown**.
- UI-R12-01 (admin approval box), UI-R05-14 (voided badge + VOIDED print), UI-R02-01 (credit-limit warning), UI-R17-01 (returns by item + no-bill return), UI-R18-01 (qty > 100 confirm, held cart): all failed on waiting for on-screen text. The matching server logic passes in the 128 rules checks, so these are probably UI timing/selector issues, but that is **unconfirmed**.
- NOT APPLICABLE: tax (DIS-09), item-level discount (DIS-10), deleting customers/suppliers (MAS-11), and one more - the app does not have these features.
- NEEDS DECISION: MAS-13 - barcodes are per Type, so a Box cannot have its own barcode (matches the owner's rule 4, so it can be closed).

## 3. Open problems found in this session
1. **Admin window freeze with the load-test database (possible real bug).** Starting the dev app on Antigravity's 10,000-product / 50,000-sale database left the main process at ~100% CPU, "Not responding", and the Admin screen never loaded; the WAL file kept growing to 50 MB. With a small database the app started normally. Cause not found (a stack sample was not obtained). The database is kept for reproduction at `test-backups/antigravity-load-db/pos.db` (git-ignored). To reproduce: copy it to `%APPDATA%\stationary-pos-app\pos.db`, run `npm run dev`, then attach a Node inspector (`ARWAAT_INSPECT=9230` is now supported by the e2e harness) and pause to see the hot function. Suspects: a startup task that scans all sales (auto-backup, clock check, recurring expenses, sync outbox).
2. Removed a `CREATE INDEX` that ran inside every Sales Report call (reports.ipc.js); the index already exists from an older migration.
3. Test-only: `tests/e2e/lib/h.js` can pass `--inspect` when `ARWAAT_INSPECT` is set.

## 4. Not done
- **Stage 3 not complete:** the full chain (00-setup ... 09-screenshots-ui) was started on a fresh database and stopped after ~6 checks. These were never run to completion in one clean pass: full shop day (A) with hand-checked numbers, bad-input sweep (O), concurrency (L), crash (M), bombard invariants, load targets (P), dates (N), security sweep for the new channels (Q).
- **Stage 4 not started:** screenshots of every page/form/print at 1366x768, 1920x1080, 683x768 for both windows (the screenshot script `tests/e2e/09-screenshots-ui.js` exists but has not run successfully).
- `test-results/TEST_RESULTS.txt` was not generated; SYSTEM_STATUS.md was not updated for the new rules/features/harness.
- MANUAL (hardware, cannot be automated): real barcode scanner, real thermal printer (receipt look, paper out, unplugged), power cut mid-sale, laptop sleep, USB copy of the daily backup, readability on the shop laptop, go-live checklist.

## 5. How to continue (exact commands)
1. Reproduce/fix the freeze in section 3.1 first - it would also fail the "app start < 10 s" target.
2. `rm test-results/.run.lock` if a stale lock exists, then run scripts one at a time (never two UI scripts at once):
   `TEST_SPEED=fast node tests/e2e/run-all.js 00-setup 01-data 02-login 03a-restore 03-shopday 03b-shopday-admin 03c-shopday-verify`
   then `04-checks 05-ops 06-concurrency-crash 07-stage1-ui 08-bombard-dates-load 09-screenshots-ui`.
3. Fix each FAIL (app bug -> code + one commit; test bug -> fix the test), `node tests/e2e/report.js`, update SYSTEM_STATUS.md, mark AGENTS.md "ALL STAGES DONE".

## 6. Commits (newest first, this session's end)
See `git log`: Stage 3 WIP e2e scripts (14decc7), Antigravity's Stage 2 harness + anomaly + UI-alert commits, Rules 1-17 (one commit each, see AGENTS.md for hashes).
