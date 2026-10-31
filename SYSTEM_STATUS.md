# ARWAAT Stationery Systems — System Status (single project memory)

The one file every coding agent reads before touching anything, and updates after every piece of work. It describes **what exists, how it behaves and why**, derived from reading the code. **When the code and this file disagree, the code wins — fix this file.** No secrets are ever written here (only where they are stored and how they are set).

## Table of contents
- [0. Rules for every agent (read first)](#0-rules-for-every-agent-read-first)
- [1. Start here (one screen)](#1-start-here-one-screen)
- [2. Run, build, test, release](#2-run-build-test-release)
- [3. Architecture](#3-architecture)
- [4. Data model](#4-data-model)
- [5. Access control](#5-access-control)
- [6. Business rules](#6-business-rules)
- [7. Screens](#7-screens)
- [8. Printing](#8-printing)
- [9. Sync](#9-sync)
- [10. Updates](#10-updates)
- [11. Security](#11-security)
- [12. Design system](#12-design-system)
- [13. Decisions log](#13-decisions-log)
- [14. Known gaps and open problems](#14-known-gaps-and-open-problems)
- [15. Bugs fixed history](#15-bugs-fixed-history)
- [16. Change log](#16-change-log)

---

## 0. Rules for every agent (read first)

Covers: how to use this file, what you must do before finishing any task, and the project's hard rules.

1. **Read this whole file before touching anything.** It is the single source of truth for this project (Claude Code, Gemini CLI, Codex and any other tool all start here; `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` are one-line pointers to this file).
2. **Code wins over this file.** If you find a mismatch, fix the file in the same change. Never guess: if something cannot be determined, write "unknown" and say where to look.
3. **Before finishing ANY task:** update every section your change affects (not just the log), add an entry to the **Change log (§16)**, update **Known gaps (§14)** and **Bugs fixed (§15)** if relevant, and commit this file together with the code. Keep entries factual and short.
4. **Never write secrets here or in code/logs:** no token values (`GH_TOKEN`, `GH_UPDATE_TOKEN`), passwords, sync secrets/Connection Codes or the Dev Panel password. Write only *where* they are stored and *how* they are set.
5. **Hard rules**
   - Styling: **inline styles from `src/renderer/config/theme.js` tokens only**. No CSS files (only `components/GlobalStyles.jsx` may hold keyframes/focus rings), no raw hex/rgb in components (print views and the Dev Panel are the documented exceptions).
   - No new dependencies without a reason (and say why in the change log). Dev dependencies only for test tools.
   - **Migrations:** next free number (`src/main/db/migrations/NNN_name.sql`, currently next = **043**). Each runs in its own transaction at start-up, so write idempotent, self-contained SQL. Any new/changed synced column or table must be registered in `src/main/sync/syncSchema.js` (+ triggers, see §9). Any new business table must be added to `TABLES_TO_CLEAR` in `src/main/ipc/system.ipc.js` (factory reset). Never edit an applied migration.
   - **Never change `package.json` `name`** (`stationary-pos-app`): it decides the userData folder (`%APPDATA%\stationary-pos-app`), so renaming makes the shop's data "disappear". Also never change `appId`, `productName`, or the Admin/Cashier shortcut setup (`build-resources/installer.nsh`).
   - **Server-side checks** for anything about money, stock, permissions or identity. The renderer is never trusted; the caller's identity comes only from the main process (§5/§11).
   - **Every money / stock / balance change needs a check** in `tests/rules/checks/` that proves it. Never weaken a check or a business rule; never add sleeps to hide a timing bug.
   - **One commit per fix**, one-line message.
   - Never touch the shop's `pos.db` except through migrations and the existing backup/restore code.
   - Plain-words messages: `{ success:false, reason }` with everyday English; never show a raw error or stack trace to the user.
   - When unsure, choose the safest behaviour for a real shop's data and record the decision in §13.
6. This is a real shop. A wrong total, a lost sale or a crash costs the developer's reputation. Prefer small, proven changes.

---

## 1. Start here (one screen)

Covers: what the app is, who uses it, current version, state and what is unfinished.

**What:** ARWAAT Stationery Systems — an **offline-first POS and back-office app for ONE stationery/book shop in Pakistan** (Rs, UTC+5, English UI in plain words, Urdu product names). Used by the owner (Admin) and cashiers on Windows PCs with mouse + keyboard (+ barcode scanner, thermal receipt printer, A4 printer). **Electron 44** main process (Node, **better-sqlite3**, one SQLite file per PC) + **React 19** renderer built by **Vite 8**. PCs in the shop sync peer-to-peer over the LAN. No cloud, no central server, no CDN assets. The only network features: Urdu-name button (Google endpoints), in-app updates from a private GitHub repo.

**Current version:** `1.1.0` (package.json). Draft release v1.1.0 is on GitHub (private repo `arwaheed/arwaat-pos-system`); not yet published at the time of writing. Migrations: **43** (`001`–`043`). Migration 043 added customer special pricing, updated the default dev panel password, and added thermal receipt font configuration.

**Current state (10 bullets)**
1. Business rules 1–17 + counter anomalies are implemented and proven: `npm run test:rules` = **139/139** checks (R01–R19).
2. One process, two windows (Admin, Cashier) with separate sign-ins and storage partitions; single-instance lock; one shared DB; optional LAN sync (UDP discovery 41234, Express 4000, secret-protected).
3. Voids are kept (count as zero everywhere), cash-only payments, whole-number quantities, server re-prices every sale line, Admin approval box on the cashier screen, quick-add of missing items with Admin review, no-bill returns, duplicate-copy reprints, wrong-clock banner, automatic daily backup.
4. Stage 1 UI dialogs verified with the e2e script `07-stage1-ui` (11/11).
5. Big-database freeze fixed (aging report N+1); on a 10k-item/2k-customer/50k-sale DB every handler tested is < 0.4 s.
6. In-app updater built (Admin-only Settings → Updates, guarded install, pre-update backup, recovery screen, downgrade guard, version-gated sync).
7. Release process: `npm run release[:minor]` uploads a **draft** GitHub release; the owner publishes it by hand.
8. Safe start-up: integrity check → downgrade guard → per-migration transactions → recovery screen instead of a half-migrated app.
9. Dev Panel (5 taps on the bug icon bottom-right): read-only diagnostics, per-PC password (default seeded by migration 042), change-password tab.
10. Docs consolidated into this file; old briefs are in `docs/archive/`.

**Unfinished (5 bullets)**
1. Stage 3/4 of the battle test (full e2e chain, bombard, crash/concurrency runs, 3-size screenshot audit) were **skipped by the owner**; only targeted checks were run (§14).
2. The real GitHub download + silent installer relaunch has never been run end to end (needs two published versions) — MANUAL check in §14.
3. Hardware-only checks (scanner, thermal printer, power cut, sleep, USB copy, shop go-live) are MANUAL (§14).
4. Counter (cashier-only) PCs have no update UI; they must be updated by running the installer by hand.
5. Known small gaps: `sync:get-status` has no `pendingCount` (sync chip text), no inactive filter on customer/supplier lists, expenses/settings do not sync (§14).

**Counts verified against the code when this file was written (2026-10-30):** 36 tables (35 + `_migrations`), 47 triggers, 55 indexes, 23 synced tables, **186 IPC channels** (183 in `preload.js` + 3 `recovery:*`), 59 `case` routes in the Admin switch (58 pages + `/dev/design-gallery`), 10 Cashier routes (7 menu + 3 hidden), 8 permission keys, 43 migrations, 20 static settings keys (+ dynamic `last_invoice_seq:*`), 8 static + 2 per-station localStorage keys, 139 rules checks, 453 tracked files mapped in §3.8 (excluding the generated `dist`).

---

## 2. Run, build, test, release

Covers: exact commands, environment variables, where data lives, new-PC setup and the release/update procedure.

### 2.1 Commands (`package.json` scripts)
| Command | What it does |
|---|---|
| `npm run dev` | Vite (5173, `strictPort`) + Electron admin window (`NODE_ENV=development electron . --mode=admin`) |
| `npm run dev:cashier` | While `npm run dev` runs: `electron . --mode=cashier`; the single-instance lock hands it to the running app (opens the Cashier window) |
| `npm run build:renderer` | `vite build` → `src/renderer/dist` |
| `npm run test:rules` | Stage 1 rules checks (no GUI), `ELECTRON_RUN_AS_NODE=1 electron tests/rules/run.js [r01 r05 …]`; prints PASS/FAIL per ID; **all must pass** (139) |
| `node tests/e2e/run-all.js [scripts]` | Playwright-over-CDP e2e in **dev mode** (needs Vite on 5173; the harness starts one and leaves it running — stop it before `npm run dev`) |
| `node tests/e2e/report.js` | Builds `test-results/TEST_RESULTS.txt` from `results.json` + `meta.json` |
| `node tests/e2e/tools/app-shot.js <label>` | Screenshot of the app window only |
| `npm run dist` | `scripts/write-update-token.js` → `build:renderer` → `electron-builder --win --publish never`: local NSIS installer in `release/` (no publish). Includes the update token only if `GH_UPDATE_TOKEN` is set |
| `npm run release` / `npm run release:minor` | `scripts/release.js patch|minor` — see §2.5 |
| `npx vite build --outDir <tmp> --emptyOutDir` | Renderer build check without touching `dist` |
| `node scripts/generate-dev-panel-hash.js "pw"` | Prints the bcrypt hash + SQL to set a Dev Panel password |
| `ELECTRON_RUN_AS_NODE=1 electron scripts/seed-dummy-data.js` | Fills the DB with ~500 dummy products etc. (dev) |

Native modules (better-sqlite3, bcrypt) must match Electron's ABI; scripts that open the DB outside the app run through `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe <script>`. **Do not run `npm run dist`/`release` while the dev app or e2e tests run** — electron-builder rebuilds the native modules and breaks the running app.

### 2.2 Environment variables
| Variable | Used by | Meaning |
|---|---|---|
| `GH_TOKEN` | `npm run release` (electron-builder upload) | Write token for the release repo. Dev PC only; never baked into the app |
| `GH_UPDATE_TOKEN` | `scripts/write-update-token.js` (dist/release) | Read-only token written into `src/main/update/updateToken.generated.js` (git-ignored) and packed into the app so installed copies can check for updates. `release` fails if missing; `dist` builds without it (no update checks) |
| `NODE_ENV=development` | `windows.js`, `ipcGuard.js` | Loads `http://localhost:5173`; the guard accepts the dev-server origin; DevTools open automatically (unless test mode) |
| `ARWAAT_TEST_MODE=1` | `system/fileDialog.js`, `windows.js` | Dev only (ignored when packaged): file dialogs read their path from `<userData>/.test-dialog-path` or `ARWAAT_TEST_FILE`; DevTools not auto-opened |
| `TEST_SPEED=slow|normal|fast` | e2e harness | Typing/click pacing (default fast since Stage 2) |
| `KEEP_DATA=1` | e2e harness | Keep the DB between runs (otherwise `00-setup` wipes) |
| `ARWAAT_INSTALLED=1` | e2e harness | Drive the installed exe instead of dev Electron |
| `ARWAAT_INSPECT=<port>` | e2e harness | Adds `--inspect=<port>` to the launched Electron (CPU profiling) |
| `ELECTRON_RUN_AS_NODE` | tests/scripts | Run Electron as plain Node (must be **deleted** from the spawn env when launching the real app — the harness does) |
| `APPDATA` | harness | Data dir = `%APPDATA%\stationary-pos-app` |

Names only — values are never recorded anywhere in the repo.

### 2.3 Where things live
| What | Where |
|---|---|
| Live database | `%APPDATA%\stationary-pos-app\pos.db` (+ `-wal`, `-shm`). Dev and installed copies share it on the same PC (same package name) |
| Letterhead PDFs / merged invoices | `userData/letterheads/`, `userData/receipts/` |
| Pre-update backups | `userData/backups/pre-update/pre-update_<version>_<YYYY-MM-DD_HHmm>.db` (newest 5; copy also goes to the automatic-backup folder if set) |
| Pre-migration safety copies | `userData/backups/pre-migration/pre-migration_<date>_<time>.db` (newest 5; made when pending migrations meet existing data) |
| Pending update record | `userData/pending-update.json` (+ setting `pending_update`) |
| Automatic daily backups | setting `auto_backup_folder`, default `Documents\ARWAAT Backups`, files `arwaat-auto-YYYY-MM-DD.db`, 30 days kept |
| Restore leftovers | `pos.db.before-restore.bak` next to `pos.db` |
| Update downloads cache | electron-updater's cache dir `stationary-pos-app-updater` (`updaterCacheDirName`) |
| Test data | `test-backups/` (git-ignored): `CLEAN-MASTER.db` (known-good fixture rebuilt through the UI), `antigravity-load-db/` (10k items/2k customers/50k sales), `appdata-before-finishup/`, old zips. `test-results/` (git-ignored): `results.json`, `meta.json`, `screens/`, `screenshots/`, `videos/`, run logs |
| Build output | `release/` (git-ignored): installer, blockmap, `latest.yml`, `win-unpacked/` |
| Archived briefs | `docs/archive/` (BRIEF.md, FINAL-TEST.md, TEST_PROGRESS.txt) |

### 2.4 Setting up a new dev PC
1. Install Node 24 + npm 11, Git. `git clone` the repo, `npm install` (builds native modules for Electron).
2. `npm run dev`. First run shows Setup: pick Admin, fill shop name + account. (Dev builds also seed a demo cashier `cashier` — see §5.)
3. Optional: set `GH_TOKEN`/`GH_UPDATE_TOKEN` as user environment variables (restart VS Code/terminal) to be able to release.
4. Tests: `npm run test:rules` (no GUI). For e2e, `test-backups/CLEAN-MASTER.db` is needed (git-ignored; rebuild with `00-setup 01-data`).
5. Dev Panel password: default from migration 042 (set by the owner; change from the Dev Panel's Password tab).

### 2.5 Release and update procedure for the shop
1. Developer PC: commit everything (the release script refuses a dirty tree). Set `GH_TOKEN` and `GH_UPDATE_TOKEN`.
2. `npm run release` (patch) or `npm run release:minor`: checks both tokens are set (prints only set/missing) → clean tree → `write-update-token.js --require` (fails early if token missing) → `npm version` (package.json + lock) → commit "Release vX" → `git push -u origin HEAD` → `vite build` → `electron-builder --win --publish always` → `scripts/consolidate-draft.js` merges duplicate drafts electron-builder sometimes makes. Result: ONE **draft** release `vX` on `arwaheed/arwaat-pos-system` holding `ARWAAT-Stationery-Systems-Setup-X.exe`, `.blockmap`, `latest.yml`.
3. On GitHub → Releases: add short notes (shown in the app), press **Publish**. Installed apps only see published releases.
4. First install of the updater build in the shop: run the installer by hand once (data stays; migrations run on first start with a safety copy).
5. Later updates: Admin opens **Settings → Updates → Update now** (see §10). Counter PCs have no update UI: run the new installer on them by hand. Computers on different versions pause syncing until they match (§9).
6. Installer facts: NSIS (not one-click, per-user, folder changeable), two shortcuts (Admin/Cashier, Desktop + Start Menu) made by `build-resources/installer.nsh`, `deleteAppDataOnUninstall: false`.
7. MANUAL verification of the full cycle (never run end-to-end): install N by hand, publish N+1, Update now; confirm the pre-update file exists, the app returns on N+1, Home shows "Updated to version N+1".
8. Git remote note: `origin` = `alqaahfi/ARWAAT-Stationery-POS-System` (where code is pushed) while releases go to `arwaheed/arwaat-pos-system` (`electron-builder.yml` `publish`). Both are intentional as configured; the mismatch was reported to the owner, not changed.



## 3. Architecture

Covers: process model, start-up order, IPC pattern, global middlewares, identity, routing, print windows and a one-line map of every file.

### 3.1 Process model
- **One Electron process, two windows.** `main/index.js` takes `app.requestSingleInstanceLock()`; a second launch (the other shortcut, `--mode=admin|cashier`) is handed to the running process through `second-instance` and opens/focuses that mode's window. Only one process may own the DB, sync port **4000**, UDP **41234**, migrations and the recurring-expense catch-up.
- `windows.js openModeWindow(mode)`: at most one window per mode, titles "ARWAAT Stationery — Admin/Cashier" (page `<title>` ignored), icons `admin.ico`/`cashier.ico` (`process.resourcesPath/icons/` packaged, `build-resources/` in dev), `win.setAppDetails({ appId: 'com.arwaat.stationerysystems.<mode>', … })` so the two group separately on the taskbar. Each uses its own persistent partition `persist:admin` / `persist:cashier`, so `localStorage` (session token, lock state, held bills, POS drafts, view modes) is completely separate. The mode reaches the renderer as `additionalArguments: ['--arwaat-mode=…']` → preload → `window.api.app.mode` (display only). Main keeps its own `webContents.id → mode` map and never trusts a mode from the renderer. Closing one window leaves the other running; the app quits when the last one closes (except while an update installs).
- Both windows share one DB, so a sale in the Cashier window shows in the Admin window's lists on refresh. Invoice numbers use the same station code and are generated synchronously in one process, so they never collide.
- **What each window shows** (`renderer/app.jsx`): not set up → Setup (either window; when it finishes, main reloads the other window). **Admin window** on an Admin PC → Admin login (Admin account only) → Admin dashboard. **Cashier window** (any PC) → the same Login page with a green "Cashier" badge → cashiers only → `CashierLayout`. **Admin window on a counter PC** (`station_config.role='cashier'`) → card "This is a counter computer…" with **Open Cashier** (`app:open-window {mode:'cashier', closeThis:true}`).
- **The role check is server-side** in `users:login` / `users:validate-session` from the calling window's mode (checked only after the password is right): a cashier in the Admin window → "This is the Admin login. Cashiers sign in from the ARWAAT Cashier shortcut."; the Admin in the Cashier window → "This is the Cashier login. Use the ARWAAT Admin shortcut to manage the shop."; anyone in the Admin window on a counter PC → the counter-computer message.
- Recovery mode: if the DB cannot be opened safely, **only** a recovery window exists (no IPC, no sync, no app) — §10.3.

### 3.2 Start-up order (`main/index.js`)
1. `app.requestSingleInstanceLock()`; if refused → quit. `installWebContentsHardening()`; `app.whenReady()` → `boot()`.
2. `initDatabase()` (`db/connection.js`): open `pos.db` (WAL, `foreign_keys=ON`, `busy_timeout=5000`) → `PRAGMA integrity_check` when `userData/pending-update.json` exists, else `quick_check` → downgrade guard (applied migration newer than any file this app knows → `StartupProblem('newer')`) → safety copy `VACUUM INTO …/backups/pre-migration/` when pending migrations meet existing data (skipped when a pre-update backup was just made) → each pending migration in its own transaction, recorded in `_migrations` only on success → `schemaVersion` = newest applied number. Any failure → `StartupProblem` (`integrity | migration | newer`) → `showRecoveryWindow()` and **stop** (nothing else starts).
3. `finishPendingUpdate()`: if a pending record exists: `to === app.getVersion()` → queue the one-time "Updated to version X" notice (`settings.updated_notice`) and remember the windows to reopen; clear the record (file + settings).
4. Middlewares (order matters): `installAuditMiddleware(ipcMain)` → `installSyncTriggerMiddleware(ipcMain)` → `installIpcGuard(ipcMain)` (last = innermost). Then `pruneAuditLog()`.
5. `register*Ipc()` for: setup, users (+permissions, sessions), dashboard, categories, products, stock, suppliers, customers, ledgers, letterheads, sales, salesHistory, returns, printing, payments, reports, expenses, sync, purchases, settings, backup, system, global, devpanel, app, approvals, updates (27 registrations).
6. Dev only: `seedDummyCashier()`. `generateDueRecurringExpenses()`.
7. `startSyncServer(4000)`, `startDiscovery(4000)`, `startPeriodicSync()`, `startAutoBackup()` (first run 5 s later + every midnight), `updater.start()` (installed app only: quiet check after 30 s, then every 24 h).
8. `ipcMain.handle('ping')`; open the window for `--mode` (default admin); after an update also reopen the other window that was open.
9. `window-all-closed`: unless `updater.isInstalling()`: stop timers/discovery/server → `app.quit()`.

### 3.3 IPC pattern
Renderer calls `window.api.<area>.<method>(payload)` → `preload.js` `invoke(channel, …)` → `ipcMain.handle('<area>:<action>')`. Handlers return plain objects; failures are `{ success:false, reason }` (plain-words message shown to the user). `preload.js invoke()` also: fires `pos:stock-changed` after any channel in `STOCK_CHANNELS` (products/stock/purchases/sales/returns writes) so the Running Low badge refreshes, and fires `pos:session-ended` when a result is `{success:false, reason:'Please sign in again.'}` (the window returns to Login). **Add new stock-affecting channels to `STOCK_CHANNELS`.** The renderer still sends `requestingUserId`/`userId`/`cashierId`/`createdBy`/`receivedBy` in some payloads but they are **ignored**: handlers that read an acting user from the payload get it overwritten with the caller's id by `withCallerId(event, payload, …fields)`.

### 3.4 Global middlewares (monkey-patch `ipcMain.handle`, so no module opts in)
- **Audit** (`devpanel/auditMiddleware.js`): one `dev_audit_log` row per IPC call (channel, user/role of the *calling window*, station, sanitised args ≤ 2000 chars with `password|token|secret` keys redacted, success, error, duration). Refused calls are logged too. `pruneAuditLog()` at boot: rows > 90 days dropped, cap 200,000.
- **Sync trigger** (`sync/syncTrigger.js`): counts `sync_outbox` before/after each call; if it grew → debounced sync (4 s).
- **IPC guard** (`security/ipcGuard.js`): authorises every call before the handler runs (§5, §11).

### 3.5 Identity
`devpanel/sessionTracker.js` keeps `webContents.id → { userId, role, sessionToken, isPrintWindow }`, set by a successful `users:login`/`users:validate-session` from that window, cleared by logout, session revoke or window close; hidden print windows are linked to their creator's identity (`linkPrintWindow`). `getCaller(event)` re-checks the session row (not revoked, not expired, user active). `currentCaller()` (AsyncLocalStorage) lets `windows.js` attach the identity to a print window created during a handler. Client-sent user ids are never trusted.

### 3.6 Routing (renderer, hand-rolled — no React Router)
`pages/Dashboard/Dashboard.jsx` splits by role: Admin → `AdminDashboard.jsx` (holds `nav = {route, params}`; `navigate(route, params)`; big `switch(nav.route)`; unknown → `PlaceholderPage`; leaving `/pos` mid-sale asks `window.confirm` via `isPosSaleInProgress()`); cashier → `CashierLayout` + `CashierRoutes.jsx` (no sidebar; header Menu). `config/navConfig.js` is the Admin map (sections with `group`, `tabs`, `pages`; exports `ROUTE_TITLES, getSectionForRoute, canSee, visibleTabs, visibleSections, sectionEntryRoute, NAV_GROUPS`). Shortcuts: **Ctrl+K** SearchPalette, **Ctrl+L** lock, **Ctrl+Shift+G** Design Gallery (dev builds only). The full route list is in §7.

### 3.7 Print windows
`?print=1&printMode=receipt|payment-receipt|invoice-fallback|purchase-fallback|report` loads `pages/Print/*` with no auth/shell in a **hidden** BrowserWindow made by `windows.js createHiddenRendererWindow()` (identity borrowed from the caller; the guard lets it call only `sales:get-receipt-data`, `purchases:get-receipt-data`, `ledgers:get-payment-by-id`, `settings:get-all`, `reports:get-report`). `createPdfWindow()` shows a PDF file for printing. See §8.

### 3.8 Folder and file map (every tracked file under `src/`, plus build/test/script files)
One row per tracked file (`git ls-files`, excluding the generated `src/renderer/dist/` build and the 42 migration SQL files, which are listed in §4.5). `src/main/db/migrations/` = `001_init.sql` … `042_dev_panel_default_password.sql`.

**`(repository root)`**

| File | What it is |
|---|---|
| .gitignore | node_modules, dist, release, *.db, .env, test-backups, test-results, `src/main/update/updateToken.generated.js` |
| AGENTS.md | One-line pointer to this file |
| CLAUDE.md | One-line pointer to this file |
| GEMINI.md | One-line pointer to this file |
| SYSTEM_STATUS.md | THIS FILE — the single project memory |
| electron-builder.yml | Packaging: appId, productName, files, asarUnpack, extraResources (icons), Electron fuses, NSIS options (`deleteAppDataOnUninstall: false`), `publish` (GitHub, private, draft) |
| package-lock.json | npm lockfile |
| package.json | name `stationary-pos-app` (decides the userData folder — never change), version, scripts, dependencies, `allowScripts` |
| seed-dev-panel.js | One-off helper that writes a fixed Dev Panel password HASH into `%APPDATA%/stationary-pos-app/pos.db` (legacy; migration 042 now seeds a default) |
| vite.config.js | Vite root `src/renderer`, `base: ./`, port 5173 strict, dev-only CSP widening, build to `src/renderer/dist` |

**`docs/archive/`**

| File | What it is |
|---|---|
| BRIEF.md | Archived: the owner brief for the battle test (Stage 1–4 plan); everything still true is folded into §13/§14 |
| FINAL-TEST.md | Archived: the end-of-session test report (open problems then; freeze since fixed, §15) |
| TEST_PROGRESS.txt | Archived: detailed per-rule implementation notes, decisions D1–D14, test history, finish-up run notes (folded into §6, §13–§15) |

**`build-resources/`**

| File | What it is |
|---|---|
| admin.ico | Admin window + shortcut icon |
| cashier.ico | Cashier window + shortcut icon |
| icon.ico | Installer/exe icon |
| installer.nsh | NSIS include: creates the ARWAAT Admin / ARWAAT Cashier shortcuts (Desktop + Start Menu, own AppUserModelIDs) and removes them on uninstall |

**`scripts/`**

| File | What it is |
|---|---|
| consolidate-draft.js | Merges duplicate draft releases into one holding installer + blockmap + latest.yml |
| generate-dev-panel-hash.js | Prints a bcrypt hash + SQL to set a Dev Panel password |
| release.js | `npm run release[:minor]`: tokens check, clean tree, bump, commit, push, build, upload draft, consolidate |
| seed-dummy-data.js | Fills the local DB with dummy data (~500 products etc.) for trying the app out |
| write-update-token.js | Build step: writes `updateToken.generated.js` from env `GH_UPDATE_TOKEN` (never prints it; `--require` fails the build if missing) |

**`src/main/`**

| File | What it is |
|---|---|
| index.js | Entry point: single-instance lock, boot(): open DB safely (else recovery window) → middlewares → register all IPC → services (sync, discovery, auto-backup, updater) → open the window for `--mode` |
| preload.js | contextBridge `window.api.*` (one method per IPC channel), `window.api.app.mode`, `pos:stock-changed` / `pos:session-ended` events |
| windows.js | Creates every BrowserWindow (Admin/Cashier mode windows with own partitions/icons/taskbar ids, hidden print windows, PDF window), web-contents hardening, relaunchApp, getOpenModes, closeAllAppWindows |

**`src/main/activity/`**

| File | What it is |
|---|---|
| activityLog.js | Shared by anything that records what a cashier did during a session |

**`src/main/backup/`**

| File | What it is |
|---|---|
| autoBackup.js | Rule 16: automatic daily backup. |
| restoreFile.js | Shared by Settings -> Restore, the Setup screen's restore and the update |

**`src/main/db/`**

| File | What it is |
|---|---|
| connection.js | Opens userData/pos.db (WAL, FK on, busy_timeout 5 s); integrity check → downgrade guard → migrations (each in a transaction) → `StartupProblem`; getDb/closeDatabase/getSchemaVersion |
| Product.js | getLowStock / getDeadStock / getProductStockStatus — the one definition of stock status |
| nextId.js | getNextId(db, table): preview of the next AUTOINCREMENT id (customers/suppliers only) |

**`src/main/devpanel/`**

| File | What it is |
|---|---|
| auditMiddleware.js | Wraps ipcMain.handle so every channel registered anywhere in the app gets |
| sessionTracker.js | webContents.id → signed-in identity per window; Dev Panel unlock flags; print-window links |

**`src/main/expenses/`**

| File | What it is |
|---|---|
| recurringExpenses.js | Materializes real `expenses` rows for every active recurring_expenses |

**`src/main/ipc/`**

| File | What it is |
|---|---|
| app.ipc.js | app:* — open window, clock status, busy flag |
| approvals.ipc.js | approvals:request/list + stock:list-recount / stock:resolve-recount |
| backup.ipc.js | backup:* — export, restore, setup restore, relaunch, automatic-backup settings |
| categories.ipc.js | categories:* (list/create/update/delete) |
| customers.ipc.js | customers:* — CRUD, ledger timeline, search, credit check, duplicate-phone check, next id |
| dashboard.ipc.js | dashboard:* — Home summary, revenue trend, active sessions |
| devpanel.ipc.js | devpanel:* — read-only diagnostics + unlock + change password |
| expenses.ipc.js | expenses:* — CRUD, stop recurrence (catches up recurring first) |
| global.ipc.js | global:search — Ctrl+K search |
| ledgers.ipc.js | ledgers:* — overview, payment history, advances, aging, adjustments, payment by id |
| letterheads.ipc.js | letterheads:* — CRUD + native PDF picker |
| payments.ipc.js | payments:* — standalone customer payment, supplier payment, delete (all cash) |
| printing.ipc.js | printing:* + printers:* — preview/print sale/purchase/payment receipts, save PDF, printer list/test |
| products.ipc.js | products:* — CRUD with Types/pack sizes, search uniqueness checks, bulk import, Urdu transliteration, quick-add/review channels |
| purchases.ipc.js | purchases:* — create, list, detail, receipt data |
| reports.ipc.js | reports:* — the seven reports, generic get-report, CSV/PDF export |
| returns.ipc.js | returns:* — search bills, returnable lines, create (with bill / no-bill), list, detail, return numbering |
| sales.ipc.js | sales:* — price re-check, saveSale (create/update), void, approvals/stock/large-qty checks, invoice numbers, item search, barcode lookup |
| salesHistory.ipc.js | sales:list / sales:get-detail — Sales History (cashier locked to own sales) |
| settings.ipc.js | settings:get-all / set / set-many over the `settings` table |
| setup.ipc.js | setup:* — first-run status, create Admin, join as counter PC; reloads the other window afterwards |
| stock.ipc.js | stock:* — add/remove/adjust stock, movements, product stats, adjustment reasons |
| suppliers.ipc.js | suppliers:* — CRUD, ledger, search, next id |
| sync.ipc.js | sync:* — status, peers (with version-pause), log, secret, sync now, reconciliation warnings |
| system.ipc.js | system:factory-reset (TABLES_TO_CLEAR list) |
| updates.ipc.js | updates:* — Admin-only updater channels |
| users.ipc.js | users:* / permissions:* / sessions:* — login, lockout, sessions, cashier CRUD, permissions, verify password, seedDummyCashier (dev only) |

**`src/main/ledger/`**

| File | What it is |
|---|---|
| adjustmentRows.js | Balance corrections (ledger_adjustments) as account-ledger rows, so the |
| balanceEngine.js | Customer/supplier balances, always derived (single source of truth), single and batch versions |
| creditLimit.js | Rule 2: a customer's credit limit is a WARNING only — it never blocks a sale. |
| returnRows.js | Customer returns as account-ledger rows, so the customer account timeline |

**`src/main/pricing/`**

| File | What it is |
|---|---|
| belowCost.js | Rule 6: a selling price below the buying price is a WARNING (shown before |
| priceEngine.js | Single source of truth for "what does this unit cost this customer right now". |

**`src/main/printing/`**

| File | What it is |
|---|---|
| exportReportPdf.js | Reusable pattern: render the plain, print-only version of a report in a |
| pdfInvoiceMerge.js | The fixed ARWAAT credit line on every page (src/shared/branding.js). |
| previewDocument.js | printToPDF takes a custom pageSize in inches (Electron 21+), not microns. |
| printA4Invoice.js | A4 invoices are always the admin's own uploaded PDF letterhead (an A4 page |
| purchaseReceiptData.js | Supplier's own letterhead, else the shop default, else the only letterhead |
| receiptData.js | Full detail for one sale — shared by every print/preview path (thermal |
| thermalReceipt.js | 58mm ≈ 32 chars/line, 80mm ≈ 42-48 — 42 is a safe middle ground across |

**`src/main/products/`**

| File | What it is |
|---|---|
| quickAdd.js | Rule 11: "Add missing items at the counter". |

**`src/main/security/`**

| File | What it is |
|---|---|
| approvals.js | Rule 12: one-time Admin approvals for the cashier screen. |
| ipcGuard.js | Who is calling, and may they? Installed once in index.js like the audit and |

**`src/main/setup/`**

| File | What it is |
|---|---|
| setupManager.js | First-run setup for this PC. There is nothing to buy, activate or register: |
| stationIdentity.js | This PC's identity on the shop network (sync peers, discovery). A random id |

**`src/main/sync/`**

| File | What it is |
|---|---|
| applyIncoming.js | The receiving side of a sync exchange: given a batch of records (from |
| discovery.js | Auto-discovery over the shop's WiFi router: every PC broadcasts a small |
| recordCodec.js | Turns a local DB row into a wire-safe payload (encodeRow, used when |
| syncEngine.js | Client side of sync: build outgoing records, call /sync/exchange, apply reply, watermarks, 4 s debounce + 25 s timer, version pause |
| syncSchema.js | Single source of truth for "how does table X travel between PCs" — every |
| syncServer.js | Every PC — Admin and every Cashier PC alike — runs this small server, not |
| syncTrigger.js | "Immediately (debounced) after any local write completes" (Step 5) without |
| versionGate.js | Two computers sync only when they run the same database layout (latest applied |

**`src/main/system/`**

| File | What it is |
|---|---|
| clockCheck.js | Rule 15: a wrong computer clock is a WARNING (selling is still allowed). The |
| fileDialog.js | showSaveDialog/showOpenDialog wrappers; with ARWAAT_TEST_MODE=1 (dev only) read the path from userData/.test-dialog-path or ARWAAT_TEST_FILE |

**`src/main/update/`**

| File | What it is |
|---|---|
| entryBusy.js | Which windows are in the middle of entering a sale / return / purchase. |
| pendingUpdate.js | The "update in progress" record: { from, to, backupPath, at, windows }. |
| preUpdateBackup.js | Full safety copy taken right before an update is installed: |
| recovery.js | The screen shown INSTEAD of the app when the shop's data can't be opened safely at |
| recoveryPreload.js | Preload for the update recovery window only (see recovery.js). |
| updateToken.js | The read-only GitHub token baked in at build time (scripts/write-update-token.js |
| updater.js | electron-updater wrapper: state machine, quiet checks, download, guarded installNow, updated notice |

**`src/main/validation/`**

| File | What it is |
|---|---|
| quantity.js | Rule 3: every quantity the shop types (sale, free/FOC, return, purchase, |

**`src/renderer/`**

| File | What it is |
|---|---|
| app.jsx | AppRouter per window mode: setup check → Setup / CashierInitialSync / counter-PC card / Login / Dashboard; clock banner + Dev Panel trigger at the root |
| index.html | HTML shell with the production Content-Security-Policy |
| main.jsx | Renderer entry: `?print=1` → PrintRoot (print views), else App inside Toast + Confirm providers; loads currency symbol |

**`src/renderer/components/`**

| File | What it is |
|---|---|
| BalanceChip.jsx | Balance in plain words. Customer: positive = they owe you. Supplier: |
| BrandMark.jsx | The ARWAAT badge: a navy rounded square with a white "A" and a short blue |
| ClockWarningBanner.jsx | Rule 15: shown in both windows (Admin and Cashier, also on Login) while the |
| DevPanelTrigger.jsx | Mounted once at the true root of the render tree (see app.jsx), outside |
| GlobalStyles.jsx | The one allowed <style>: keyframes, focus rings, placeholder/selection |
| PlaceholderPage.jsx | Fallback page for an unknown route |
| PrintChoice.jsx | The admin-chooses-format-each-time step used everywhere a payment receipt |
| StatTile.jsx | LEGACY / unused tile (Dashboard/parts/StatTile.jsx is the live one) |
| ui.jsx | Shared UI kit. Everything is importable from here; the pieces live in ./kit. |

**`src/renderer/components/billing/`**

| File | What it is |
|---|---|
| AdminApprovalDialog.jsx | Rule 12: "Admin approval" on the cashier screen. The Admin types their own |
| BillItemSearch.jsx | Name / item code / barcode search used by both quick bills. Typing shows |
| BillLines.jsx | Same grid for the header and every row, so the columns always line up. |
| BillOverlay.jsx | Large in-place sheet that sits over whatever page opened it, so a bill can be |
| BillPartyCard.jsx | Who the bill is with. A bill opened from a customer's or supplier's own page |
| BillSummary.jsx | The right-hand side of both quick bills: discount, live totals, payment and |
| MultiTypeQtyPanel.jsx | One compact panel to enter the quantity of every Type of a product at once. |
| QuickAddItemDialog.jsx | Rule 11: "Add missing items at the counter". Barcode (optional, must be new), |
| QuickBillForm.jsx | One billing form for both Sale and Purchase, so the two screens look and |
| QuickPaymentModal.jsx | Records an entry on the account right from the profile / ledger page. The |
| QuickPurchaseOverlay.jsx | The same form as the quick sale, with a supplier instead of a customer. |
| QuickSaleOverlay.jsx | The full New Sale form as an overlay on the current page. Opened from a |
| billingUtils.js | Shared maths and line helpers for the quick Sale and Purchase forms, so both |

**`src/renderer/components/DevPanel/`**

| File | What it is |
|---|---|
| AccessLogTab.jsx | Dev Panel tab: unlock attempts |
| AuditLogTab.jsx | Dev Panel tab: IPC audit log with filters |
| DatabaseBrowserTab.jsx | Dev Panel tab: table viewer + SELECT-only console |
| PasswordTab.jsx | Change this computer's Dev Panel password (stored only as a bcrypt hash on this PC). |
| SystemInfoTab.jsx | Dev Panel tab: app/DB/system info |
| UsersSessionsTab.jsx | Dev Panel tab: users and sessions |
| devPanelTheme.js | The Dev Panel is explicitly a diagnostic tool, not a shop-facing screen — |
| index.jsx | Full-screen diagnostic overlay — a layer over whatever screen was active, |
| shared.jsx | Small utilitarian building blocks shared by the Dev Panel's tabs — kept |

**`src/renderer/components/kit/`**

| File | What it is |
|---|---|
| Avatar.jsx | Same name -> same tint, every time. |
| Button.jsx | [rest, hover] per variant. "secondary" and "ghost" are the legacy names |
| ChipGroup.jsx | Single-select pill buttons. options: [{ value, label, icon? }]. |
| Disclosure.jsx | Collapsible Card section. Uncontrolled with `defaultOpen`, or controlled |
| Feedback.jsx | Spinner, Skeleton, EmptyState, Toast (useToast), Modal, Confirm (useConfirm) |
| Field.jsx | Field/Label/TextInput/NumberInput/TextArea/Select/SearchField/FieldError |
| Icon.jsx | Plain glyph for buttons, inputs and tables. Inherits currentColor. |
| PasswordInput.jsx | TextInput with a show/hide eye button. Works inside <Field> like TextInput |
| Popover.jsx | Dropdown anchored under its trigger. `anchor` is the trigger element (it |
| Stepper.jsx | Display-only horizontal steps. `steps` is a list of labels; `current` is |
| Surfaces.jsx | Card, PageHeader, Banner, Badge, Kbd, ListSection, ListRow, IconTile |
| Table.jsx | Plain <tr> with a flat hover tint, for pages that build tables by hand |
| Toggle.jsx | iOS switch. onChange receives the new boolean. |
| useInteraction.js | Hover/pressed state for inline-styled components (no CSS :hover allowed). |

**`src/renderer/components/receipt/`**

| File | What it is |
|---|---|
| PrintPreviewModal.jsx | Every sale receipt goes through here instead of straight to the printer. |
| ThermalContent.jsx | The thermal receipt's actual content — shared between the dev-mode preview |

**`src/renderer/config/`**

| File | What it is |
|---|---|
| appIcons.js | One icon + color per app concept, so the same idea always looks the same. |
| appInfo.js | The app's own UI is no longer per-shop-branded — every place the app's own |
| glossary.js | Plain-words display terms. Stable keys -> the text shown to shop staff. |
| navConfig.js | The Admin app's whole map. Each entry is one sidebar item (a "section"): |
| theme.js | Single source of design tokens. Components read ONLY these values (never raw |

**`src/renderer/context/`**

| File | What it is |
|---|---|
| AuthContext.jsx | Session token (localStorage pos_session_token), user, permissions, hasPermission/getPermissionValue, login/logout, pos:before-logout, session-ended handling, currency symbol load |

**`src/renderer/layout/`**

| File | What it is |
|---|---|
| LockScreen.jsx | LockProvider + lock overlay (Ctrl+L, idle auto-lock, pos_locked_user) |
| SearchPalette.jsx | Every page a user may jump to (no edit/detail pages — those need an id). |
| SectionTabs.jsx | The current section's sub-pages as a segmented control at the top of the |
| ShellParts.jsx | UserChip, SyncChip (with "Paused" state), Brand, HeaderClock |
| Sidebar.jsx | Fixed width, always open (no collapse). Exported for the shell layout. |
| TopUtilityBar.jsx | The Admin app's top bar: back button + page title on the left; search |
| useAlerts.js | The alerts shown in the top bar's bell and on the Home page's "Needs |

**`src/renderer/pages/`**

| File | What it is |
|---|---|
| Login.jsx | One Login page for both apps. `mode` = which window this is: the Admin |

**`src/renderer/pages/Customers/`**

| File | What it is |
|---|---|
| CustomerForm.jsx | Add/edit customer form (SectionCards, duplicate-phone warning, starting balance, Stay on page) |
| CustomerList.jsx | Customers list (List/Cards/Compact views, balances, search/sort/filter) |
| CustomerProfile.jsx | Thin wrapper of Parties/PartyProfile for customers |
| CustomerFormParts.jsx | Presentational sections of the customer form |
| CustomerListParts.jsx | Toolbar/rows for the customer list |

**`src/renderer/pages/Dashboard/`**

| File | What it is |
|---|---|
| AdminDashboard.jsx | Admin shell: nav state + hand-rolled route switch, sidebar/top bar/tabs, Ctrl+K, Ctrl+L, POS-in-progress guard |
| CashierRoutes.jsx | The cashier menu, in display order. Each entry is also the permission gate |
| Dashboard.jsx | POS-first layout: no sidebar or tabs. New Sale is home; a Menu in the |
| Overview.jsx | Admin Home: stat tiles, chart, recent sales, needs attention, backup notice, updated-version toast |
| BackupNotice.jsx | Rule 16 on Home: a failed automatic backup, and the weekly reminder to copy |
| GettingStartedCard.jsx | Shown only while a brand-new shop still has a first step left to do. |
| GreetingHeader.jsx | Home greeting |
| NeedsAttentionCard.jsx | Plain-words title/subtitle per alert key (counts come from the shared hook). |
| Panel.jsx | White card with a headline title, optional right-side node, and a body. |
| QuickActionsCard.jsx | Home quick action buttons |
| RecentSalesCard.jsx | Only shown when a sale isn't fully paid. |
| RevenueChartCard.jsx | Same day counts dashboard:get-revenue-trend accepts. |
| SignedInCard.jsx | Sessions come from this computer's own database, so the list can't see |
| StatTile.jsx | One big clickable card: icon + label, a large value, and a footnote line. |

**`src/renderer/pages/Dev/`**

| File | What it is |
|---|---|
| DesignGallery.jsx | Dev-only reference page for the design system. Loaded lazily and only when |

**`src/renderer/pages/Expenses/`**

| File | What it is |
|---|---|
| ExpenseForm.jsx | Route: /expenses/new (no expenseId) and /expenses/edit (expenseId from the |
| ExpenseList.jsx | Route: /expenses. The operational, day-to-day expense log — every expense |
| ExpenseFormParts.jsx | Presentational pieces of the expense form |
| ExpenseListParts.jsx | Presentational pieces of the expense list |
| expenseUi.js | Repeat values as stored (see utils/expenseRecurrence.js), in plain words. |

**`src/renderer/pages/Ledgers/`**

| File | What it is |
|---|---|
| Adjustments.jsx | Route: /ledgers/adjustments. Manual corrections to a customer/supplier |
| AdvancesAndCredits.jsx | Route: /ledgers/advances. Every customer and supplier with a negative |
| AgingReport.jsx | Route: /ledgers/aging. Customers only. The handler ages each unpaid sale on |
| CustomerLedger.jsx | Mounted at /ledgers/customers, with or without a customerId param — no id |
| LedgersHome.jsx | A clickable tile. size 'large' is the prominent Customers / Suppliers card, |
| LedgersMore.jsx | Wraps one of the four More pages with a breadcrumb back to More. |
| Overview.jsx | Route: /ledgers. The Accounts landing page — who owes the shop, who the |
| PaymentHistory.jsx | Route: /ledgers/payments. One log across customer and supplier payments, |
| SupplierLedger.jsx | Mounted at /ledgers/suppliers, with or without a supplierId param — no id |
| AccountList.jsx | The front door of Customer Accounts and Supplier Accounts: every account in |
| AccountView.jsx | One layout for Customer Accounts and Supplier Accounts. No party chosen -> |
| AgingParts.jsx | Overdue color language: 0–30 plain · 31–60 orange · 61–90 orange on tint · |
| CorrectionParts.jsx | Balance-correction form/list pieces |
| LedgerNav.jsx | Ledger back bars / breadcrumbs |
| LedgerParts.jsx | Every Accounts page: content column with room left for the Dev Panel icon. |
| OverviewParts.jsx | "Customers who owe the most" / "Suppliers you owe the most". |
| PartyPicker.jsx | Search-as-you-type customer/supplier finder over the existing |
| PaymentsParts.jsx | Payment history table, reprint menu, delete buttons |
| TransactionTimeline.jsx | "Goods Rs 500 · cash back Rs 200" — cash part left out when none was given. |
| ledgerUtils.js | Small display helpers shared by the Accounts pages. |

**`src/renderer/pages/Parties/`**

| File | What it is |
|---|---|
| PartyHeader.jsx | Customer/supplier profile header card |
| PartyParts.jsx | Shared bits: LoadError, RestrictedNotice, IdRow, StayOnPageCheck… |
| PartyProfile.jsx | Customer / Supplier Profile (/customers/profile, /suppliers/profile). The |
| PartyViews.jsx | List/Cards/Compact view toggle + remembered mode |
| RecentActivityCard.jsx | Newest 5 ledger rows on a profile |
| StartingBalanceField.jsx | Owed / Advance starting-balance control |

**`src/renderer/pages/Payments/`**

| File | What it is |
|---|---|
| RecordPayment.jsx | Receive Payment page (cashier menu; cash only) |
| PaymentDoneSheet.jsx | Payment saved sheet with receipt print options |
| PaymentFormFields.jsx | Amount / note fields (cash only) |
| ReceivePaymentParts.jsx | Receive Payment layout pieces |

**`src/renderer/pages/POS/`**

| File | What it is |
|---|---|
| Sale.jsx | The keyboard POS: stage machine, held bills, drafts, approvals, quick-add, large-qty confirm, Today's bills/Return overlays |
| CancelSaleDialog.jsx | Keys (Enter = cancel, Esc = keep working) stay in Sale.jsx's handler. |
| CartList.jsx | Cart lines (select/edit/remove) |
| CustomerPanel.jsx | Customer step (search/walk-in) |
| DiscountPanel.jsx | Discount step (amount or %) |
| FormatPanel.jsx | Receipt format step (thermal / A4) |
| HeldBillsPanel.jsx | Recall menu for held bills. ↑↓ choose, Enter recalls, Delete discards, Esc closes. |
| IdlePanel.jsx | idle: S starts a sale — unless a saved draft exists, then R / N decide. |
| ItemSearchPanel.jsx | Item search/results, "Only N left", F7 hint when nothing matches |
| KeyHints.jsx | Mirrors the branches of Sale.jsx's keydown handler — update both together. |
| PaymentPanel.jsx | Rule 9: cash only — the payment step is just "Amount received" and "Change". |
| PosButton.jsx | Large three-dimensional action button for the sale screen. The shortcut key |
| QtyPanel.jsx | Quantity + Free (FOC) entry |
| RecentBillsPanel.jsx | Today's bills for this cashier (Admin: everyone's). ↑↓ walks the list and the |
| SaleCompleteSheet.jsx | Sale complete sheet (print status, reprint, A4 embed) |
| StepStrip.jsx | Which step each stage belongs to. idle = nothing started, confirm = all done. |
| SummaryCard.jsx | Right-hand summary: balances, totals, amount received/change |
| UndoPill.jsx | Floats just above the key-hints bar; Sale.jsx owns its timing. |
| common.jsx | Cashier Mode is the all-day working screen, so its entry controls run |

**`src/renderer/pages/Print/`**

| File | What it is |
|---|---|
| PrintBranding.jsx | The fixed ARWAAT line at the bottom of every HTML print view (A4 invoice |
| PrintInvoice.jsx | Fallback A4 invoice — rendered only when a sale has no assigned letterhead |
| PrintPaymentReceipt.jsx | Rendered only inside the hidden BrowserWindow that printA4Invoice.js's |
| PrintReceipt.jsx | Headless thermal-receipt view. The main process (previewDocument.js) loads |
| PrintReport.jsx | Rendered only inside the hidden BrowserWindow that exportReportPdf.js |

**`src/renderer/pages/Products/`**

| File | What it is |
|---|---|
| BulkImport.jsx | CSV import page |
| CategoryList.jsx | Categories page |
| DeadStock.jsx | Rows come straight from Product.js (via products:get-dead-stock). |
| LowStock.jsx | Rows come straight from Product.js (via products:get-low-stock) — the same |
| MovementHistory.jsx | Stock movement history table (used by Stock → History) |
| NeedsReview.jsx | Rule 11: items a cashier added at the counter ("Add missing items at the |
| ProductForm.jsx | Trade Price method: derives the standard price fields the price engine and POS read. |
| ProductList.jsx | All Products list (filters, bulk bar, views, sort memory) |
| ProductProfile.jsx | Product Profile (/products/profile): an inventory view — stock first, then |
| CategoryParts.jsx | One row inside the grouped ListSection. `separator` is injected by |
| BasicsSection.jsx | Step 1 — what kind of product is this, and what is it called? The choice |
| MoreOptionsSection.jsx | Section 6 — rarely-changed settings, collapsed. |
| PackSizesSection.jsx | Section 3 — always open, at least one pack size required. |
| SpecialPricesSection.jsx | Section 4 — collapsed by default. One row per pack size, five boxes. |
| StickyActions.jsx | Save bar pinned to the bottom of the content area. Right padding keeps the |
| TypesSection.jsx | Product with Types — each colour/size with its own barcode and starting stock. |
| UrduSuggestions.jsx | Alternative Urdu spellings for each word of the name. `words` is |
| fields.jsx | Moves focus to the next field inside the product form (used instead of |
| ImportSteps.jsx | Import wizard steps |
| BulkBar.jsx | Floating selection bar, centered near the bottom of the list (clear of |
| ProductRows.jsx | Stops a click on a control inside the row from also opening the profile. |
| ProductToolbar.jsx | Search, category filter, status chips, view toggle and sort for the product list |
| StatusBadges.jsx | The flags (isOutOfStock / isLow / isDead) come straight from the list rows, |
| AdjustParts.jsx | Plain labels + icons for the reason codes stock:get-adjustment-reasons returns. |
| HistoryParts.jsx | History filters/rows |
| ItemPicker.jsx | Search-and-pick item box |
| MoveBadge.jsx | movement_type -> plain words + color. Starting stock is stored as a |
| StockIntro.jsx | One-line page intro under the shell's title. |
| StockTable.jsx | Card + DataTable with the loading / empty / error states that Running Low, |

**`src/renderer/pages/Purchases/`**

| File | What it is |
|---|---|
| PurchaseHistory.jsx | Purchase History page + New Purchase |
| PurchaseDetailSheet.jsx | Read-only view of one purchase: what came in, what it cost, what was paid. |
| PurchaseTable.jsx | Purchase history table |

**`src/renderer/pages/Reports/`**

| File | What it is |
|---|---|
| CashierPerformance.jsx | Cashier Performance report page |
| CustomerStatements.jsx | Customer Statements report page |
| ExpenseReport.jsx | Expense report page |
| ProfitLoss.jsx | Profit & Loss report page |
| ReportsHome.jsx | Reports home (seven report cards) |
| SalesReport.jsx | `initialDate` lets another screen's drill-down (the Dashboard's revenue |
| StockReport.jsx | Stock report page |
| SupplierStatements.jsx | Suppliers have no category concept in the schema (unlike customers), so |
| DateRangePicker.jsx | Pure — resolves a preset key into concrete { dateFrom, dateTo } ISO date |
| ExportButtons.jsx | One "Export" button with a menu: CSV or PDF. rows/columns are the report's |
| ReportSummaryCards.jsx | Headline numbers in Home's StatTile style. Accepts the report envelope's |
| ReportTable.jsx | Generic sortable table driven by a report's `columns` definition, in the |
| CashierParts.jsx | Cashier performance table/cards |
| ChartCard.jsx | White card with a headline title, an optional hint/action on the right, |
| ExpenseParts.jsx | The server sends recurrence as its display label. |
| ProfitLossParts.jsx | P&L chart/table, buying-price-missing card |
| RankedBars.jsx | Horizontal ranked bars: label · bar · amount · % of total. Shows the top 8 |
| ReportBarChart.jsx | Bar chart in the Home chart's style: rounded tops, horizontal gridlines |
| ReportShell.jsx | The common frame every report renders inside: |
| SalesReportParts.jsx | Sales report chart/table |
| StatementParts.jsx | Customer / Supplier statements share one layout. Server summary order: |
| StockReportParts.jsx | Server summary order (Product.js numbers): value, products, low, dead. |
| reportUtils.js | Chart series colors — token names only (see theme.js). |
| reportTitles.js | Report pages get their title from navConfig's ROUTE_TITLES inside |
| formatCell.js | Single dispatcher so a report's `columns` definition (format: 'currency' \| |

**`src/renderer/pages/Sales/`**

| File | What it is |
|---|---|
| Returns.jsx | Route: /sales/returns (Admin only — every returns handler re-checks). |
| SalesHistory.jsx | Route: /sales. Read-only list of sales (cashiers see only their own — |
| SaleDetailSheet.jsx | Read-only view of one sale, with reprint. No void/edit here; an Admin can |
| SalesTable.jsx | Sales History table (Voided badge) |
| SalesToolbar.jsx | Sales History filters/search/New Sale |
| FindSaleStep.jsx | Step 1: search sales and pick the one being returned. The input keeps focus; |
| ItemsStep.jsx | Returns step 2: items and quantities |
| NoBillReturnDialog.jsx | Rule 17: a return without the bill (Admin only). Pick the item and how many; |
| RefundStep.jsx | Step 3: how the customer gets their money back. `cash` is the parsed amount |
| ReturnDetailSheet.jsx | Return detail sheet ("No bill" for no-bill returns) |
| ReturnSuccess.jsx | Return saved sheet ("Exchanging? Ring up a New Sale") |
| ReturnsList.jsx | Returns list + "Return without the bill" |
| returnUtils.js | "Type · Pack size" footnote under an item name. |
| saleLabels.js | Payment status as it was AT THE TIME OF SALE — later payments go on the |

**`src/renderer/pages/Settings/`**

| File | What it is |
|---|---|
| BackupRestore.jsx | Rule 16: automatic daily backup status. |
| Letterheads.jsx | "C:\...\letterheads\1712345678_Shop Header.pdf" -> "Shop Header" |
| Preferences.jsx | Preferences tab (currency, low-stock default, discount cap default, auto-lock) |
| PrinterSettings.jsx | A4 wholesale invoices always go through the normal OS print dialog (the |
| ReceiptContent.jsx | What actually prints on a receipt is unrelated to the app's own UI |
| SyncAndPcs.jsx | Connected Computers tab (code, this PC, peers, log, version-pause banner) |
| Updates.jsx | Updates tab (Admin only): version, check, notes, Update now, progress |
| BackupParts.jsx | Backup/automatic-backup/restore/danger-zone cards |
| LetterheadParts.jsx | Local filesystem paths need the file:// scheme (and a third slash on |
| PreferencesParts.jsx | Preferences cards |
| PrinterParts.jsx | Printer cards |
| ReceiptParts.jsx | Receipt header/footer form + preview |
| SettingsParts.jsx | Shared page column for the Settings pages (the shell supplies the title |
| SyncParts.jsx | Connection code, this computer, peers (with pause line), stock warnings, sync log |

**`src/renderer/pages/Setup/`**

| File | What it is |
|---|---|
| CashierInitialSync.jsx | Shown once, right after Setup.jsx has registered this counter PC with the |
| Setup.jsx | The whole first-run setup on one screen: pick Admin or Cashier, fill the form, |
| SetupShell.jsx | Full-window layout for every setup screen and Login: plain gray page, one |

**`src/renderer/pages/Stock/`**

| File | What it is |
|---|---|
| StockEntryDialog.jsx | Add Stock / Delete Stock. From the Stock page it's the full multi-product |
| StockEntryForm.jsx | Add/Delete Stock form (full multi-product and quick per-product modes) |
| StockHistory.jsx | Stock → History (/stock/history): every row of stock_movements — purchases, |
| StockList.jsx | Stock (/stock): the Products list's table and status chips, trimmed to stock |
| StockRecount.jsx | Rule 12: items sold with not enough stock (Admin approved) and every Type |

**`src/renderer/pages/Suppliers/`**

| File | What it is |
|---|---|
| SupplierForm.jsx | Add/edit supplier form |
| SupplierList.jsx | Suppliers list |
| SupplierProfile.jsx | Thin wrapper of Parties/PartyProfile for suppliers |
| SupplierFormParts.jsx | Presentational sections of the supplier form |
| SupplierListParts.jsx | Toolbar/rows for the supplier list |

**`src/renderer/pages/Users/`**

| File | What it is |
|---|---|
| ApprovalsLog.jsx | Rule 12: every Admin approval given on a cashier screen — what, bill, cashier, admin, when. |
| CashierForm.jsx | Create mode collects username + password + permissions all in one form; |
| CashierList.jsx | Cashiers list |
| CashierSessions.jsx | The click-through detail view (SessionDetail.jsx) is where "what did this |
| SessionDetail.jsx | The drill-down behind one row of Cashiers > Session Activity — everything |
| CashierFormParts.jsx | Plain-words copy and an icon per permission key. Keys, types and order |
| CashierListParts.jsx | Cashier list rows |
| ResetPasswordModal.jsx | Sets a new password for one cashier. The server revokes all their |
| SessionParts.jsx | Raw activity_log action names -> plain words. Unknown names are shown |

**`src/renderer/utils/`**

| File | What it is |
|---|---|
| appEvents.js | Window events shared across distant parts of the app. |
| belowCost.js | Rule 6: a selling price below the buying price is a warning, allowed after a |
| csv.js | Small hand-rolled CSV reader/writer (RFC4180-ish: quoted fields, "" escaping, |
| expenseRecurrence.js | Renderer-side copy of src/shared/expenseRecurrence.js's enum — kept |
| format.js | Shop currency symbol (Settings → Preferences). Read once at startup and |
| priceLevel.js | Stored tier values stay 'C1'..'C5'; people see "Price Level 1".."Price Level 5". |
| printPayment.js | Shared by every place in the Ledgers module that offers a payment receipt |
| quantity.js | Rule 3: every quantity is a positive whole number. Quantity boxes pass what |
| scrollRestore.js | Puts a scroll container back where it was after a page remounts. The page |
| useDeletePayment.js | One way to delete a payment from anywhere in the app (Payments log, account |
| useEntryBusy.js | Tells the main process this window is in the middle of entering a sale, return or |
| useRememberedState.js | Like useState, but the value outlives the component: opening an item and |

**`src/shared/`**

| File | What it is |
|---|---|
| branding.js | The ARWAAT credit line printed at the bottom of every printed or exported |
| expenseRecurrence.js | Single source of truth for expense recurrence types, used by main-process |
| permissionDefinitions.js | Single source of truth for every cashier-gated permission in the app. Main |

**`tests/e2e/`**

| File | What it is |
|---|---|
| 00-setup.js | Fresh-DB Setup screen checks (SET-01..04) |
| 01-data.js | Enter master data through the UI; make CLEAN-MASTER with the app's own backup |
| 02-login.js | Login/permission/lockout checks (USR-01..11) |
| 03-shopday.js | The full shop day as the cashier (S1–S6) |
| 03a-restore.js | Restore CLEAN-MASTER through the UI |
| 03b-shopday-admin.js | Shop-day Admin part (returns, payments, expenses, purchases) |
| 03c-shopday-verify.js | Hand-calculated numbers vs reports |
| 04-checks.js | Discounts, security sweep (DIS/SEC) and other checks |
| 05-ops.js | Operations checks (backup/restore, stock, data integrity) |
| 06-concurrency-crash.js | Two windows at once, kill-and-recover |
| 07-stage1-ui.js | Stage 1 rule dialogs on screen (R11/R12/R05/R02/R15/R16/R17/R18) — 11/11 PASS |
| 08-bombard-dates-load.js | Bombard invariants, dates, load targets |
| 09-screenshots-ui.js | Screenshot audit (never ran successfully) |
| report.js | Builds `test-results/TEST_RESULTS.txt` from results.json + meta.json |
| run-all.js | Orchestrator: runs the numbered scripts one at a time (lock file `test-results/.run.lock`) |
| write-meta.js | Writes meta.json for the report |

**`tests/e2e/lib/`**

| File | What it is |
|---|---|
| data.js | Data-entry helpers (add cashier, restore backup, go to section…) |
| h.js | Harness core: launches Vite + Electron (dev) or the installed exe, attaches over CDP, check()/recording, SQL helpers (`execSql`, `q`) |
| meta.js | Run metadata |
| pos.js | POS helpers: login, startSale, addByName/addByScan, discountAndPay, finishSale |
| shop.js | Shop-level helpers (loginIf, balances) |
| testdata.js | Fixture constants |

**`tests/e2e/tools/`**

| File | What it is |
|---|---|
| app-shot.js | Screenshot of the app window only |
| file-dialog.ps1 | Legacy native-dialog helper (replaced by ARWAAT_TEST_MODE) |
| q.py | Read-only SQL query helper |
| run-installer.ps1 | Installs/uninstalls the built exe for installed-app test runs |
| seed_load.py | Builds the 10k-item / 2k-customer / 50k-sale load DB |
| w.py | Write SQL helper used by `execSql` |

**`tests/rules/`**

| File | What it is |
|---|---|
| r01-price.js | Rule 1: the server re-resolves every line price; mismatch refused unless Admin. |
| r02-credit-limit.js | Rule 2: credit limit is a warning only — never blocks. |
| r03-whole-numbers.js | Rule 3: positive whole numbers only, for every quantity (server side). |
| r04-barcodes.js | Rule 4: barcodes stay per product Type; a scan adds 1 of the default pack size. |
| r05-voids.js | Rule 5: voids are kept (is_voided) and count as ZERO everywhere. |
| r06-below-cost.js | Rule 6: below-cost selling price = warning (allowed after confirm); a cashier |
| r07-duplicate-phone.js | Rule 7: a duplicate customer phone/mobile is a warning; saving is allowed. |
| r08-no-exchange.js | Rule 8: no exchange screen — an exchange is a return plus a new sale. |
| r09-cash-only.js | Rule 9: cash only — every new payment is recorded as 'cash'; old rows keep their method. |
| r10-no-rounding.js | Rule 10: no rounding of totals (paisa kept exactly; never rounded to whole rupees). |
| r11-quick-add.js | Rule 11: add a missing item at the counter; Admin reviews (approve / merge). |
| r12-approvals.js | Rule 12: Admin approval box on the cashier screen (discount over cap, selling |
| r13-cashier-window.js | Rule 13: cashier edits/voids — own bills only, within 10 minutes; later only with Admin approval. |
| r14-duplicate-copy.js | Rule 14: the first print after saving is the original; reprints say DUPLICATE COPY + reprint date/time. |
| r15-clock.js | Rule 15: wrong computer clock = warning (selling still allowed). |
| r16-auto-backup.js | Rule 16: automatic daily backup (safe online backup, 30 days kept, status for Home/Settings). |
| r17-returns.js | Rule 17: returns step 1 finds bills by item name/barcode, customer and date; no-bill return (Admin only). |
| r18-anomalies.js | Stage 1 counter anomalies: server-side verification for BRIEF.md section 2. |
| r19-updates.js | In-app updates: safe start-up migrations, pre-update backup, recovery, version-gated sync. |
| harness.js | Fake `electron` module, temp DB, fake signed-in windows (admin/cashier/cashier2), fixtures (addProduct/addCustomer…), registers the real IPC modules |
| run.js | Rules-check runner (PASS/FAIL per ID) |



## 4. Data model

Covers: every table with every column, keys, indexes and triggers; what syncs and how; factory reset; the migrations; every settings key; every localStorage key. The table dump in §4.2 is generated from a freshly migrated database (`PRAGMA table_info`, `foreign_key_list`, `index_list`, `sqlite_master`) so it matches the code exactly.

### 4.1 Conventions
- All timestamps written with `datetime('now')` are **UTC text** (`YYYY-MM-DD HH:MM:SS`); the UI converts to local. User-typed calendar dates (`expenses.expense_date`, `recurring_expenses.*_date`, `customers/suppliers.joining_date`) are local `YYYY-MM-DD`. "Local day" filters use `date(created_at,'localtime')`.
- Money is REAL with 2-decimals rounding (`round2`) in the main process; **no rounding to whole rupees** anywhere (Rule 10). Quantities are positive whole numbers (Rule 3); pack-size conversion factors are whole numbers.
- Soft delete via `is_active` on products, variants, units, customers, suppliers, users (sales/purchases reference them). Sales are never deleted: a void sets `is_voided`.
- Balances are **never stored** — derived by `ledger/balanceEngine.js` (§6.3).
- Stock lives on `product_variants.stock_qty` (base units) and is always paired with a `stock_movements` row; the movements are the audit trail and the sync unit.
- Synced tables carry `uuid` (filled by an AFTER INSERT trigger) and, for masters, `origin_station`; local INTEGER ids never leave a PC (§9).
- `PRAGMA foreign_keys=ON`. Several FKs have no `ON DELETE` rule, which is why factory reset turns FKs off while wiping.
- Triggers (44 in total): per synced table `trg_<table>_ai` (fills `uuid`, writes outbox `insert`), `trg_<table>_au` (outbox `update`; `sales`' fires only once the row has a uuid), and `trg_<table>_ad` for deletable tables (outbox `delete`), plus `trg_payments_au` (036) and `trg_sale_items_au` (037, merged lines sync). They are the only way rows get into `sync_outbox`.

### 4.2 Tables
#### `_migrations`
Which migration files have been applied (filename = identity). Start-up runs the missing ones, each in its own transaction.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| filename | TEXT | NOT NULL |  |  |
| applied_at | TEXT | NOT NULL | datetime('now') |  |

- unique: (filename)

#### `activity_log`
Cashier session activity (login, logout, sale_created/edited/voided…). Shown in Cashiers → Session Activity. Not synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| session_id | INTEGER |  |  | FK → sessions; Resolved from the user's active session |
| user_id | INTEGER | NOT NULL |  | FK → users |
| action | TEXT | NOT NULL |  | login / logout / sale_created / sale_edited / sale_voided |
| description | TEXT |  |  |  |
| reference_type | TEXT |  |  |  |
| reference_id | INTEGER |  |  |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |

- indexes: idx_activity_log_user(user_id); idx_activity_log_session(session_id)

#### `approvals`
Rule 12 log of every Admin approval given on a cashier screen. Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| action | TEXT | NOT NULL |  | Comma list of reasons: discount_over_cap, sell_without_stock, change_old_bill, void_old_bill |
| details | TEXT |  |  | Human text of what was approved |
| sale_id | INTEGER |  |  | FK → sales |
| invoice_no | TEXT |  |  |  |
| cashier_id | INTEGER |  |  | FK → users |
| admin_id | INTEGER |  |  | FK → users |
| origin_pc | TEXT |  |  | Station code that made the save |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_approvals_uuid(uuid) unique; idx_approvals_created(created_at)
- triggers: trg_approvals_ai
- sync: {"kind":"insert_only","deletable":false}

#### `categories`
Product categories, one parent level. Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| name | TEXT | NOT NULL |  |  |
| parent_id | INTEGER |  |  | FK → categories; One level of parent/child |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- unique: (name)
- indexes: idx_categories_uuid(uuid) unique
- triggers: trg_categories_ai, trg_categories_au
- sync: {"kind":"upsert","deletable":false}

#### `customer_special_prices`
Special pricing rules set per customer for a specific product or specific pack size (Rule 1). Takes highest precedence in priceEngine. Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| customer_id | INTEGER | NOT NULL |  | FK → customers (ON DELETE CASCADE) |
| product_id | INTEGER | NOT NULL |  | FK → products (ON DELETE CASCADE) |
| product_unit_id | INTEGER |  | NULL | FK → product_units (ON DELETE CASCADE); NULL = applies to all pack sizes |
| price_type | TEXT | NOT NULL |  | 'fixed' (Rs.), 'discount_percent' (% off standard price), 'margin_percent' (% over cost) |
| price_value | REAL | NOT NULL |  | Amount or percentage |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| updated_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_customer_special_prices_lookup(customer_id, product_id, product_unit_id); idx_customer_special_prices_uuid(uuid) unique
- triggers: trg_customer_special_prices_ai, trg_customer_special_prices_au, trg_customer_special_prices_ad
- sync: {"kind":"upsert","deletable":true}

#### `customers`
Customers. Balance is never stored (see balanceEngine). Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| name | TEXT | NOT NULL |  |  |
| customer_type | TEXT | NOT NULL |  | retail / wholesale |
| assigned_letterhead_id | INTEGER |  |  | FK → letterheads; Letterhead for this wholesale customer (NULL = default) |
| phone | TEXT |  |  |  |
| address | TEXT |  |  |  |
| opening_balance | REAL | NOT NULL | 0 | Starting balance; + = owes the shop, − = paid in advance |
| is_active | INTEGER | NOT NULL | 1 |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| tier | TEXT |  |  | Price Level C1..C5 or NULL (UI shows "Price Level 1–5") |
| uuid | TEXT |  |  |  |
| origin_station | TEXT |  |  | Station that created the row |
| mobile | TEXT |  |  |  |
| email | TEXT |  |  |  |
| credit_limit | REAL | NOT NULL | 0 | 0/blank = none. WARNING only (Rule 2), never blocks |
| joining_date | TEXT |  |  | Local YYYY-MM-DD, defaults to today on create |
| notes | TEXT |  |  |  |

- indexes: idx_customers_uuid(uuid) unique
- triggers: trg_customers_ai, trg_customers_au, trg_customers_stamp_station
- sync: {"kind":"upsert","deletable":false}

#### `dev_audit_log`
One row per IPC call (Dev Panel Audit Log). Pruned at boot: > 90 days dropped, cap 200,000.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| occurred_at | TEXT | NOT NULL | datetime('now') |  |
| channel | TEXT | NOT NULL |  |  |
| user_id | INTEGER |  |  |  |
| user_role | TEXT |  |  |  |
| station_code | TEXT |  |  |  |
| args_summary | TEXT |  |  | Sanitised args (password/token/secret redacted), ≤ 2000 chars |
| success | INTEGER | NOT NULL |  |  |
| error_message | TEXT |  |  |  |
| duration_ms | INTEGER |  |  |  |

- indexes: idx_dev_audit_log_channel(channel); idx_dev_audit_log_time(occurred_at)

#### `dev_panel_access_log`
Every Dev Panel unlock / password-change attempt with success flag.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| occurred_at | TEXT | NOT NULL | datetime('now') |  |
| station_code | TEXT |  |  |  |
| success | INTEGER | NOT NULL |  |  |

#### `dev_panel_config`
Single row: bcrypt hash of this PC's Dev Panel password (migration 042 seeds a default if empty).

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| password_hash | TEXT | NOT NULL |  |  |

#### `expenses`
Shop expenses (one-time or occurrences of a repeating series). Not synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| description | TEXT | NOT NULL |  |  |
| amount | REAL | NOT NULL |  |  |
| paid_by | INTEGER |  |  | FK → users; Who paid (free text) |
| expense_date | TEXT | NOT NULL | datetime('now') | Local YYYY-MM-DD as typed (not UTC) |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| payee | TEXT |  |  |  |
| recurrence | TEXT | NOT NULL | 'one_time' | one_time / daily / weekly / monthly / annually |
| recurring_expense_id | INTEGER |  |  | FK → recurring_expenses; Template that generated this row (NULL for one-time) |

- indexes: idx_expenses_recurring_expense_id(recurring_expense_id)

#### `ledger_adjustments`
Manual balance corrections for a customer or supplier (and the "Owed amount" quick entry). Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| party_type | TEXT | NOT NULL |  | customer / supplier |
| party_id | INTEGER | NOT NULL |  |  |
| amount | REAL | NOT NULL |  | + raises what the party owes, − lowers it |
| reason | TEXT | NOT NULL |  | Required; "Owed amount…" marks the quick Owed entry |
| created_by | INTEGER |  |  | FK → users |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_ledger_adjustments_uuid(uuid) unique; idx_ledger_adjustments_party(party_type,party_id)
- triggers: trg_ledger_adjustments_ai
- sync: {"kind":"insert_only","deletable":false}

#### `letterheads`
A4 letterhead PDF templates for invoices/purchase receipts. Row syncs, the PDF file does not.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| name | TEXT | NOT NULL |  |  |
| image_path | TEXT |  |  | Legacy, no longer written |
| pdf_template_path | TEXT |  |  | File under userData/letterheads/ |
| content_margin_top_mm | REAL | NOT NULL | 40 | Where invoice content starts (default 40) |
| content_margin_bottom_mm | REAL | NOT NULL | 25 | Where content must end (default 25; ≥ 12 forced for the ARWAAT line) |
| is_default | INTEGER | NOT NULL | 0 |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_letterheads_uuid(uuid) unique
- triggers: trg_letterheads_ad, trg_letterheads_ai, trg_letterheads_au
- sync: {"kind":"upsert","deletable":true}

#### `payments`
All money received from customers / paid to suppliers. Voided together with their bill (is_voided). Upsert + deletable, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| party_type | TEXT | NOT NULL |  | customer / supplier |
| party_id | INTEGER | NOT NULL |  | customers.id or suppliers.id (polymorphic; synced via uuid) |
| sale_id | INTEGER |  |  | FK → sales; Bill this payment was made with (NULL = standalone) |
| amount | REAL | NOT NULL |  |  |
| payment_method | TEXT | NOT NULL | 'cash' | New rows always cash (Rule 9); old rows keep cash/bank/other |
| note | TEXT |  |  |  |
| received_by | INTEGER |  |  | FK → users |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |
| is_voided | INTEGER | NOT NULL | 0 | 1 when its bill was voided; excluded from every sum |

- indexes: idx_payments_sale(sale_id); idx_payments_uuid(uuid) unique; idx_payments_party(party_type,party_id)
- triggers: trg_payments_ad, trg_payments_ai, trg_payments_au
- sync: {"kind":"upsert","deletable":true}

#### `percentage_pricing_rules`
DORMANT (Special Margins feature removed). Kept so old data/peers work; nothing reads or writes it.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| product_id | INTEGER | NOT NULL |  | FK → products |
| customer_id | INTEGER |  |  | FK → customers |
| customer_tier | TEXT |  |  | Dormant |
| percentage | REAL | NOT NULL |  |  |
| uuid | TEXT |  |  |  |

- indexes: idx_percentage_rules_uuid(uuid) unique; idx_percentage_rules_product(product_id)
- triggers: trg_percentage_rules_ad, trg_percentage_rules_ai
- sync: {"kind":"upsert","deletable":true}

#### `product_units`
Pack sizes of a product ("Piece", "Box" = N pieces) with all prices per this unit. Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| product_id | INTEGER | NOT NULL |  | FK → products |
| unit_name | TEXT | NOT NULL |  |  |
| conversion_factor | REAL | NOT NULL |  | Base units per this pack (Piece = 1, Box of 12 = 12) |
| retail_price | REAL | NOT NULL | 0 |  |
| wholesale_price | REAL | NOT NULL | 0 |  |
| cost_price | REAL | NOT NULL | 0 | Buying price per this unit |
| is_default_sale_unit | INTEGER | NOT NULL | 0 | Pack size a barcode scan adds (qty 1) |
| is_active | INTEGER | NOT NULL | 1 |  |
| net_rate_c1 | REAL |  |  | Fixed price for Price Level 1 (NULL = no override); same for c2..c5 |
| net_rate_c2 | REAL |  |  |  |
| net_rate_c3 | REAL |  |  |  |
| net_rate_c4 | REAL |  |  |  |
| net_rate_c5 | REAL |  |  |  |
| uuid | TEXT |  |  |  |
| pricing_method | TEXT | NOT NULL | 'simple' | simple / trade (trade derives cost/retail/wholesale/net rates in the form) |
| trade_price | REAL |  |  | Trade pricing: list price |
| purchase_discount | REAL |  |  | Trade pricing: % off trade price when buying |
| extra_discount | REAL |  |  | Trade pricing: flat amount off when buying |
| sale_discount_c1 | REAL |  |  | Trade pricing: % off trade price for Price Level 1 (c2..c5 alike) |
| sale_discount_c2 | REAL |  |  |  |
| sale_discount_c3 | REAL |  |  |  |
| sale_discount_c4 | REAL |  |  |  |
| sale_discount_c5 | REAL |  |  |  |

- unique: (product_id+unit_name)
- indexes: idx_product_units_uuid(uuid) unique; idx_units_product(product_id)
- triggers: trg_product_units_ai, trg_product_units_au
- sync: {"kind":"upsert","deletable":false}

#### `product_variants`
Types of a product (colour/size). Stock lives here; barcode lives here. stock_qty is a local cache of stock_movements and is not synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| product_id | INTEGER | NOT NULL |  | FK → products |
| variant_name | TEXT | NOT NULL | 'Standard' | "Standard" for simple products |
| stock_qty | REAL | NOT NULL | 0 | Base units; local cache = Σ stock_movements; not synced |
| last_purchased_at | TEXT |  |  |  |
| last_sold_at | TEXT |  |  | Newest non-voided sale (recomputed on void) |
| date_added | TEXT | NOT NULL | datetime('now') | When the Type was added |
| is_active | INTEGER | NOT NULL | 1 |  |
| barcode | TEXT |  |  | Unique when set (case-insensitive); per Type, never per pack size |
| uuid | TEXT |  |  |  |
| search_alias | TEXT |  |  | Hidden Roman spelling of the Type name |

- unique: (product_id+variant_name)
- indexes: idx_product_variants_uuid(uuid) unique; idx_variants_barcode(barcode) unique partial; idx_variants_product(product_id)
- triggers: trg_product_variants_ai, trg_product_variants_au
- sync: {"kind":"upsert","deletable":false}

#### `products`
The item. name = Urdu display name; search_alias = hidden Roman spelling for search. Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| name | TEXT | NOT NULL |  | Urdu display name (printed) |
| sku | TEXT |  |  | Item code, unique |
| category_id | INTEGER |  |  | FK → categories |
| supplier_id | INTEGER |  |  | FK → suppliers |
| base_unit_name | TEXT | NOT NULL | 'Piece' | Name of the base unit (Piece…) |
| min_stock_alert | REAL | NOT NULL | 0 | Running Low when total stock ≤ this |
| dead_stock_days | INTEGER |  |  | Not Selling when days since last sale ≥ this (NULL = never) |
| pricing_type | TEXT | NOT NULL | 'fixed' | fixed / percentage (cost × (1 + default_percentage/100)) |
| default_percentage | REAL |  |  |  |
| is_agency_item | INTEGER | NOT NULL | 0 | Legacy, unused |
| notes | TEXT |  |  |  |
| is_active | INTEGER | NOT NULL | 1 |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| updated_at | TEXT | NOT NULL | datetime('now') |  |
| company_name | TEXT |  |  |  |
| uuid | TEXT |  |  |  |
| origin_station | TEXT |  |  | Station that created the row |
| search_alias | TEXT |  |  | Hidden Roman/English spelling, searched but never printed |
| needs_review | INTEGER | NOT NULL | 0 | 1 = added at the counter, awaiting Admin review (Rule 11) |
| created_via | TEXT |  |  | `quick_add` for counter-added items, NULL otherwise |
| merged_into_product_id | INTEGER |  |  | FK → products; Set when a counter-added item was merged into another product |

- unique: (sku)
- indexes: idx_products_needs_review(needs_review); idx_products_uuid(uuid) unique; idx_products_supplier(supplier_id); idx_products_category(category_id)
- triggers: trg_products_ai, trg_products_au, trg_products_stamp_station
- sync: {"kind":"upsert","deletable":false}

#### `purchase_items`
Lines of a purchase. Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| purchase_id | INTEGER | NOT NULL |  | FK → purchases |
| product_id | INTEGER | NOT NULL |  | FK → products |
| product_variant_id | INTEGER | NOT NULL |  | FK → product_variants |
| quantity | REAL | NOT NULL |  |  |
| unit_cost | REAL | NOT NULL |  | Cost per base-pack unit (no pack-size column on purchases) |
| line_total | REAL | NOT NULL |  |  |
| uuid | TEXT |  |  |  |
| foc_quantity | REAL | NOT NULL | 0 | Free units received (stock in, no cost) |

- indexes: idx_purchase_items_uuid(uuid) unique; idx_purchase_items_purchase(purchase_id)
- triggers: trg_purchase_items_ai
- sync: {"kind":"insert_only","deletable":false}

#### `purchases`
Supplier purchases (permanent; no edit/delete). Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| supplier_id | INTEGER | NOT NULL |  | FK → suppliers |
| reference_no | TEXT |  |  | Legacy supplier bill number (quick form no longer sends it) |
| subtotal | REAL | NOT NULL | 0 |  |
| total_amount | REAL | NOT NULL | 0 | subtotal − discount_amount |
| notes | TEXT |  |  |  |
| created_by | INTEGER |  |  | FK → users |
| purchase_date | TEXT | NOT NULL | datetime('now') | Date of purchase |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |
| discount_amount | REAL | NOT NULL | 0 |  |
| paid_amount | REAL | NOT NULL | 0 | Paid at purchase time, capped at total |

- indexes: idx_purchases_uuid(uuid) unique; idx_purchases_supplier(supplier_id)
- triggers: trg_purchases_ai
- sync: {"kind":"insert_only","deletable":false}

#### `recurring_expenses`
Templates that generate expense rows (daily/weekly/monthly/annually). Not synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| description | TEXT | NOT NULL |  |  |
| amount | REAL | NOT NULL |  |  |
| payee | TEXT |  |  |  |
| paid_by | INTEGER |  |  | FK → users |
| frequency | TEXT | NOT NULL |  | daily / weekly / monthly / annually |
| start_date | TEXT | NOT NULL |  |  |
| next_run_date | TEXT | NOT NULL |  | Next occurrence to generate |
| active | INTEGER | NOT NULL | 1 | 0 after "Stop repeating" |
| created_at | TEXT | NOT NULL | datetime('now') |  |

- indexes: idx_recurring_expenses_due(active,next_run_date)

#### `sale_items`
Lines of a sale. Kept for voided sales. Upsert + deletable, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| sale_id | INTEGER | NOT NULL |  | FK → sales |
| product_id | INTEGER | NOT NULL |  | FK → products |
| product_variant_id | INTEGER | NOT NULL |  | FK → product_variants |
| product_unit_id | INTEGER | NOT NULL |  | FK → product_units |
| quantity | REAL | NOT NULL |  | In the unit sold |
| unit_price | REAL | NOT NULL |  | Server-resolved price stored |
| discount_amount | REAL | NOT NULL | 0 |  |
| line_total | REAL | NOT NULL |  |  |
| uuid | TEXT |  |  |  |
| foc_quantity | REAL | NOT NULL | 0 | Free units, same pack size; stock leaves but not charged |

- indexes: idx_sale_items_uuid(uuid) unique; idx_sale_items_sale(sale_id)
- triggers: trg_sale_items_ad, trg_sale_items_ai, trg_sale_items_au
- sync: {"kind":"upsert","deletable":true}

#### `sale_prints`
Rule 14: each SUCCESSFUL print of a bill; any print after the first is a DUPLICATE COPY. Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| sale_id | INTEGER | NOT NULL |  | FK → sales |
| copy | TEXT | NOT NULL |  | original / duplicate |
| print_type | TEXT |  |  | retail-thermal / wholesale-a4 |
| printed_by | INTEGER |  |  | FK → users |
| printed_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_sale_prints_uuid(uuid) unique; idx_sale_prints_sale(sale_id)
- triggers: trg_sale_prints_ai
- sync: {"kind":"insert_only","deletable":false}

#### `sale_return_items`
Lines of a return; sale_item_id NULL for a no-bill return (then variant/unit are set). Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| return_id | INTEGER | NOT NULL |  | FK → sale_returns |
| sale_item_id | INTEGER |  |  | FK → sale_items |
| product_variant_id | INTEGER |  |  | FK → product_variants |
| product_unit_id | INTEGER |  |  | FK → product_units |
| quantity | REAL | NOT NULL |  | In the unit sold / returned |
| refund_amount | REAL | NOT NULL |  | Value refunded for this line |
| uuid | TEXT |  |  |  |

- indexes: idx_sale_return_items_uuid(uuid) unique; idx_sale_return_items_return_item(return_id,sale_item_id)
- triggers: trg_sale_return_items_ai
- sync: {"kind":"insert_only","deletable":false}

#### `sale_returns`
Returns; sale_id/customer_id NULL for a no-bill return (Rule 17). Insert-only, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| return_no | TEXT | NOT NULL |  | {station}-R-{YYYYMMDD}-{seq4} |
| sale_id | INTEGER |  |  | FK → sales |
| customer_id | INTEGER |  |  | FK → customers |
| total_amount | REAL | NOT NULL |  |  |
| cash_refund_amount | REAL | NOT NULL | 0 | Cash handed back; balance effect = cash − total |
| reason | TEXT | NOT NULL |  | wrong_item / faulty / changed_mind / other |
| note | TEXT |  |  |  |
| restocked | INTEGER | NOT NULL | 1 | 1 = stock went back in |
| created_by | INTEGER |  |  | FK → users |
| origin_pc | TEXT |  |  |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- unique: (return_no)
- indexes: idx_sale_returns_uuid(uuid) unique; idx_sale_returns_customer(customer_id); idx_sale_returns_sale(sale_id)
- triggers: trg_sale_returns_ai
- sync: {"kind":"insert_only","deletable":false}

#### `sales`
Bills. Voided bills stay (is_voided=1) and count as zero everywhere. Upsert + deletable, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| invoice_no | TEXT | NOT NULL |  | {station}-{YYYYMMDD(UTC)}-{seq4}, never reused |
| sale_type | TEXT | NOT NULL |  | retail / wholesale |
| customer_id | INTEGER |  |  | FK → customers; NULL = walk-in |
| cashier_id | INTEGER | NOT NULL |  | FK → users |
| letterhead_id | INTEGER |  |  | FK → letterheads |
| subtotal | REAL | NOT NULL | 0 |  |
| discount_amount | REAL | NOT NULL | 0 |  |
| tax_amount | REAL | NOT NULL | 0 | Always 0 (no tax feature) |
| total_amount | REAL | NOT NULL | 0 |  |
| paid_amount | REAL | NOT NULL | 0 |  |
| balance_due | REAL | NOT NULL | 0 |  |
| payment_status | TEXT | NOT NULL | 'paid' | paid / partial / unpaid at save time (snapshot) |
| is_synced | INTEGER | NOT NULL | 0 | Legacy flag |
| origin_pc | TEXT |  |  | Station that made the bill |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |
| is_voided | INTEGER | NOT NULL | 0 | 1 = voided (kept, counts as zero) |
| voided_at | TEXT |  |  | UTC time of the void |
| voided_by | INTEGER |  |  | FK → users; User who voided |

- unique: (invoice_no)
- indexes: idx_sales_voided_created(is_voided,created_at); idx_sales_is_voided(is_voided); idx_sales_uuid(uuid) unique; idx_sales_synced(is_synced); idx_sales_created(created_at); idx_sales_customer(customer_id)
- triggers: trg_sales_ad, trg_sales_ai, trg_sales_au
- sync: {"kind":"upsert","deletable":true}

#### `sessions`
Sign-in sessions (12 h). Not synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| user_id | INTEGER | NOT NULL |  | FK → users |
| token | TEXT | NOT NULL |  | 32-byte random hex |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| expires_at | TEXT | NOT NULL |  | ISO time, 12 h after sign-in |
| is_revoked | INTEGER | NOT NULL | 0 | 1 after logout/deactivate/reset |
| ended_at | TEXT |  |  |  |

- unique: (token)

#### `settings`
Key/value settings per PC (not synced). See the settings key list.

| column | type | null | default | meaning |
|---|---|---|---|---|
| key | TEXT |  |  | PK; See the settings key list |
| value | TEXT |  |  |  |

- unique: (key)

#### `station_config`
Single row: this PC's setup record (shop name, role, station code, sync secret). Cleared by factory reset.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| shop_name | TEXT | NOT NULL |  |  |
| role | TEXT | NOT NULL |  | admin / cashier (counter PC) |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| station_code | TEXT |  |  | `MAIN` for the Admin PC, `C` + 4 hex for counter PCs; hyphen-free |
| sync_secret | TEXT |  |  | Shared Connection Code; never logged |

#### `stock_movements`
Every stock change (sale, purchase, return, adjustment). Synced as deltas applied to stock_qty.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| product_variant_id | INTEGER | NOT NULL |  | FK → product_variants |
| movement_type | TEXT | NOT NULL |  | purchase / sale / return_in / return_out / adjustment |
| quantity | REAL | NOT NULL |  | ± base units |
| reference_type | TEXT |  |  | sale / purchase / return / adjustment / initial_stock / stock_in / stock_out / NULL |
| reference_id | INTEGER |  |  | Id of the sale/purchase/return (synced via uuid) |
| note | TEXT |  |  |  |
| created_by | INTEGER |  |  | FK → users |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- indexes: idx_stock_movements_uuid(uuid) unique; idx_stock_movements_variant(product_variant_id)
- triggers: trg_stock_movements_ai
- sync: {"kind":"stock_movement","deletable":false}

#### `stock_recount`
Rule 12 "Stock to recount": items sold without enough stock. The list also shows every Type currently below zero. Upsert, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| product_variant_id | INTEGER | NOT NULL |  | FK → product_variants |
| sale_id | INTEGER |  |  | FK → sales |
| reason | TEXT | NOT NULL |  | sold_without_stock (the only value written) |
| note | TEXT |  |  |  |
| created_by | INTEGER |  |  | FK → users |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| resolved_at | TEXT |  |  | Set by "Mark counted" |
| resolved_by | INTEGER |  |  | FK → users |
| uuid | TEXT |  |  |  |

- indexes: idx_stock_recount_uuid(uuid) unique; idx_stock_recount_open(resolved_at)
- triggers: trg_stock_recount_ai, trg_stock_recount_au
- sync: {"kind":"upsert","deletable":false}

#### `suppliers`
Suppliers. Balance derived. Synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| name | TEXT | NOT NULL |  |  |
| contact_person | TEXT |  |  |  |
| phone | TEXT |  |  |  |
| address | TEXT |  |  |  |
| notes | TEXT |  |  |  |
| is_active | INTEGER | NOT NULL | 1 |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| opening_balance | REAL | NOT NULL | 0 | Starting balance; + = shop owes supplier |
| uuid | TEXT |  |  |  |
| origin_station | TEXT |  |  |  |
| mobile | TEXT |  |  |  |
| email | TEXT |  |  |  |
| joining_date | TEXT |  |  |  |
| assigned_letterhead_id | INTEGER |  |  | FK → letterheads; Letterhead for purchase receipts (NULL = default) |

- indexes: idx_suppliers_uuid(uuid) unique
- triggers: trg_suppliers_ai, trg_suppliers_au, trg_suppliers_stamp_station
- sync: {"kind":"upsert","deletable":false}

#### `sync_log`
Result of each sync exchange per peer (also the one-time "Paused: version" line).

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| direction | TEXT | NOT NULL |  | push / pull / exchange |
| status | TEXT | NOT NULL |  | success / failed |
| peer_machine_id | TEXT |  |  |  |
| peer_station_code | TEXT |  |  |  |
| message | TEXT |  |  |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |

- indexes: idx_sync_log_created(created_at)

#### `sync_outbox`
Trigger-fed queue of changed records (table, uuid, operation) for sync. Not synced itself.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| table_name | TEXT | NOT NULL |  |  |
| record_uuid | TEXT | NOT NULL |  | uuid of the changed record |
| operation | TEXT | NOT NULL |  | insert / update / delete |
| created_at | TEXT | NOT NULL | datetime('now') |  |

- indexes: idx_sync_outbox_created(created_at)

#### `sync_peer_state`
Per-peer sync watermarks and last-seen info.

| column | type | null | default | meaning |
|---|---|---|---|---|
| peer_machine_id | TEXT |  |  | PK |
| peer_station_code | TEXT |  |  |  |
| peer_role | TEXT |  |  |  |
| last_known_ip | TEXT |  |  |  |
| last_seen_at | TEXT |  |  |  |
| last_synced_outbox_id | INTEGER | NOT NULL | 0 | How much of MY outbox this peer has confirmed |
| last_received_outbox_id | INTEGER | NOT NULL | 0 | How far into THEIR outbox I have pulled |
| last_sync_success_at | TEXT |  |  |  |

- unique: (peer_machine_id)

#### `user_permissions`
Granted permissions per cashier (row exists = granted; value only for valued keys). Upsert + deletable, synced.

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| user_id | INTEGER | NOT NULL |  | FK → users |
| permission_key | TEXT | NOT NULL |  |  |
| value | TEXT |  |  | Only for valued keys (max_discount_percentage) |
| uuid | TEXT |  |  |  |

- unique: (user_id+permission_key)
- indexes: idx_user_permissions_uuid(uuid) unique
- triggers: trg_user_permissions_ad, trg_user_permissions_ai, trg_user_permissions_au
- sync: {"kind":"upsert","deletable":true}

#### `users`
The Admin and cashiers. Synced (password hash included).

| column | type | null | default | meaning |
|---|---|---|---|---|
| id | INTEGER |  |  | PK |
| full_name | TEXT | NOT NULL |  |  |
| username | TEXT | NOT NULL |  |  |
| password_hash | TEXT | NOT NULL |  | bcrypt; never shown |
| role | TEXT | NOT NULL |  | admin / cashier |
| is_active | INTEGER | NOT NULL | 1 |  |
| created_at | TEXT | NOT NULL | datetime('now') |  |
| updated_at | TEXT | NOT NULL | datetime('now') |  |
| uuid | TEXT |  |  |  |

- unique: (username)
- indexes: idx_users_uuid(uuid) unique
- triggers: trg_users_ai, trg_users_au
- sync: {"kind":"upsert","deletable":false}

### 4.3 What syncs and how (`sync/syncSchema.js` `SYNC_TABLES`, 22 tables)
| Table | kind | deletable | FK columns sent as uuid | local-only columns |
|---|---|---|---|---|
| categories | upsert |  | parent_id→categories? |  |
| products | upsert |  | category_id→categories?, supplier_id→suppliers?, merged_into_product_id→products? |  |
| product_variants | upsert |  | product_id→products | stock_qty |
| product_units | upsert |  | product_id→products |  |
| customers | upsert |  | assigned_letterhead_id→letterheads? |  |
| suppliers | upsert |  | assigned_letterhead_id→letterheads? |  |
| users | upsert |  |  |  |
| user_permissions | upsert | yes | user_id→users |  |
| letterheads | upsert | yes |  |  |
| percentage_pricing_rules | upsert | yes | product_id→products, customer_id→customers? |  |
| sales | upsert | yes | customer_id→customers?, cashier_id→users, letterhead_id→letterheads?, voided_by→users? |  |
| sale_items | upsert | yes | sale_id→sales, product_id→products, product_variant_id→product_variants, product_unit_id→product_units |  |
| sale_returns | insert_only |  | sale_id→sales?, customer_id→customers?, created_by→users? |  |
| sale_return_items | insert_only |  | return_id→sale_returns, sale_item_id→sale_items?, product_variant_id→product_variants?, product_unit_id→product_units? |  |
| payments | upsert | yes | sale_id→sales?, received_by→users?, party_id (by party_type) |  |
| purchases | insert_only |  | supplier_id→suppliers, created_by→users? |  |
| purchase_items | insert_only |  | purchase_id→purchases, product_id→products, product_variant_id→product_variants |  |
| ledger_adjustments | insert_only |  | created_by→users?, party_id (by party_type) |  |
| approvals | insert_only |  | sale_id→sales?, cashier_id→users?, admin_id→users? |  |
| stock_recount | upsert |  | product_variant_id→product_variants, sale_id→sales?, created_by→users?, resolved_by→users? |  |
| sale_prints | insert_only |  | sale_id→sales, printed_by→users? |  |
| stock_movements | stock_movement |  | product_variant_id→product_variants, created_by→users?, reference_id (by reference_type) |  |

- `kind: upsert` = insert if the uuid is new, update in place otherwise (last write wins). `insert_only` = immutable, inserted once (dedup by uuid). `stock_movement` = dedup by uuid, then applied as a **delta** to the local `stock_qty`. `deletable` = a delete travels (matches the `_ad` triggers).
- `product_variants.stock_qty` is excluded (local cache). FK columns are swapped for the target's uuid on the wire (`fks`, incl. polymorphic `payments.party_id`, `ledger_adjustments.party_id`, `stock_movements.reference_id`).
- **Not synced:** `settings`, `expenses`, `recurring_expenses`, `sessions`, `activity_log`, `sync_*`, dev tables, `dev_panel_config`, `station_config`, `_migrations`, category deletes, letterhead PDF files (only the row/path).

### 4.4 Factory reset (`system:factory-reset`, `TABLES_TO_CLEAR`)
With FK enforcement off in one transaction it empties: `approvals, stock_recount, sale_prints, sale_return_items, sale_returns, sales, sale_items, payments, purchases, purchase_items, stock_movements, products, product_variants, product_units, categories, customers, suppliers, letterheads, percentage_pricing_rules, expenses, recurring_expenses, ledger_adjustments, activity_log, users, user_permissions, sessions, sync_outbox, sync_peer_state, sync_log` (29 tables) **and** `station_config`, then relaunches into Setup (same window mode). **Kept:** `settings` (incl. `station_id`), `dev_panel_config`, `dev_audit_log`, `dev_panel_access_log`, `_migrations`. Any new business table must be added to the list.

### 4.5 Migrations (`src/main/db/migrations/`, 42 files)
| # | File | What |
|---|---|---|
| 001 | init | settings, users, user_permissions, sessions, license_activation (later `station_config`) |
| 002 | catalog | categories, suppliers, products, product_variants, product_units, stock_movements |
| 003 | customers_pricing | customer_categories (dropped in 018), letterheads, customers, product_category_prices (dropped in 018), percentage_pricing_rules |
| 004 | sales | sales, sale_items |
| 005 | ledger_expenses | payments, expenses (+ expense categories, later dropped) |
| 006 | sync | original `sync_queue` + `sync_log` (replaced in 022/024) |
| 007 | indexes | basic query indexes |
| 008 | variant_barcode | barcode on product_variants (unique-if-set) |
| 009 | product_units_active | `product_units.is_active` (soft delete) |
| 010 | station_code | `license_activation.station_code` |
| 011 | permission_values | `user_permissions.value` for valued keys |
| 012 | supplier_opening_balance | `suppliers.opening_balance` |
| 013 | purchases | purchases, purchase_items |
| 014 | product_company | `products.company_name` (brand) |
| 015 | ledger_adjustments | balance corrections table |
| 016 | letterhead_pdf_template | letterheads become PDF templates (`pdf_template_path`, margins) |
| 017 | letterhead_image_path_optional | `image_path` nullable (table rebuild, own BEGIN/COMMIT) |
| 018 | fixed_tier_pricing | customer categories → fixed C1–C5 tiers (`customers.tier`, `product_units.net_rate_c1..5`) (table rebuild) |
| 019 | activity_log | `activity_log` + `sessions.ended_at` |
| 020 | dev_panel | `dev_panel_config`, `dev_audit_log`, `dev_panel_access_log` |
| 021 | expense_recurrence | expense categories dropped → payee + recurrence; `recurring_expenses` (table rebuild) |
| 022 | sync_foundation | uuid on every synced table, `sync_outbox`, `sync_peer_state`, `sync_log`, all sync triggers (table rebuilds) |
| 023 | sync_secret | `station_config/license_activation.sync_secret` |
| 024 | sync_log_exchange | `sync_log` rebuilt for the combined exchange protocol |
| 025 | license_keys | key pool (removed again in 035) |
| 026 | sale_returns | `sale_returns`, `sale_return_items` (+ triggers) |
| 027 | customer_extra_fields | customers: mobile, email, credit_limit, joining_date, notes |
| 028 | supplier_extra_fields | suppliers: mobile, email, joining_date |
| 029 | trade_price_pricing | `product_units.pricing_method`, trade/discount columns |
| 030 | foc_and_sale_edit | `sale_items.foc_quantity`; sales/sale_items/payments become upsert + deletable (new update/delete triggers) |
| 031 | purchase_foc_discount | purchases: discount, paid; purchase_items: foc |
| 032 | supplier_letterhead | `suppliers.assigned_letterhead_id` |
| 033 | product_search_alias | `products.search_alias` |
| 034 | variant_search_alias | `product_variants.search_alias` |
| 035 | remove_licensing | licensing removed; `license_activation` → `station_config` |
| 036 | voids_kept | Rule 5: `sales.is_voided/voided_at/voided_by`, `payments.is_voided`, indexes, `trg_payments_au` |
| 037 | quick_add_items | Rule 11: `products.needs_review/created_via/merged_into_product_id`, `trg_sale_items_au`, back-fill `add_missing_items` permission |
| 038 | approvals_and_recount | Rule 12: `approvals`, `stock_recount` |
| 039 | sale_prints | Rule 14: `sale_prints` |
| 040 | no_bill_returns | Rule 17: `sale_returns.sale_id` nullable; `sale_return_items.sale_item_id` nullable + `product_variant_id/product_unit_id` (table rebuild) |
| 041 | perf_indexes | `idx_sales_voided_created(is_voided, created_at)` (moved out of the Sales Report) |
| 042 | dev_panel_default_password | Seeds the default Dev Panel password hash if none exists (hash only) |

**Removed / superseded — don't go looking for these:** `customer_categories`, `product_category_prices`, `customers.category_id`, `percentage_pricing_rules.customer_category_id` (018); `expense_categories`, `expenses.category_id` (021); `sync_queue` (006 → 022); `letterheads.image_path` no longer written; licensing (`license_keys`, `license_activation` renamed `station_config`, `license:*` IPC, `node-machine-id`, activation screens — 035). `percentage_pricing_rules` is dormant (Special Margins removed).

### 4.6 Settings keys (`settings` table, per PC, not synced; read/written through `settings:*` or the module that owns them)
| Key | Meaning / default | Written by |
|---|---|---|
| `currency_symbol` | Shown on screens and receipts; default `Rs.` | Settings → Preferences |
| `default_cashier_discount_cap` | Shop default max discount % for cashiers (blank → 0) | Preferences |
| `default_low_stock_alert` | Default "warn below" in the product form (blank = none) | Preferences |
| `auto_lock_minutes` | Idle lock; default 15, 0 = never | Preferences |
| `receipt_header_text`, `receipt_footer_text` | Free text on thermal receipts (footer thermal only) | Settings → Receipt Header & Footer |
| `thermal_printer_name`, `thermal_paper_width` | Receipt printer and `58mm`/`80mm` (80mm → 42 chars/line, else 32) | Settings → Printers |
| `station_id` | This PC's random sync identity (UUID); minted on first use; dropped on a normal restore | `setup/stationIdentity.js` |
| `last_invoice_seq:{station}:{YYYYMMDD}` | Highest invoice number ever issued that day (so voided numbers are never reused) | `sales.ipc.js` |
| `auto_backup_folder` | Automatic-backup folder (default `Documents\ARWAAT Backups`) | Settings → Backup |
| `auto_backup_last_at`, `_last_day`, `_last_file`, `_last_error`, `_last_error_at` | Last automatic backup result | `backup/autoBackup.js` |
| `usb_reminder_done_at` | Weekly "copy a backup to USB" reminder done | Home |
| `pending_update` | JSON `{from,to,backupPath,at,windows}` while an update is installing | updater (mirror of `userData/pending-update.json`) |
| `updated_notice` | Version to show "Updated to version X" once on Home | `finishPendingUpdate` |
| `update_last_check_at` | Last update check time | updater |
(Shop name and station code are in `station_config`, not `settings`.)

### 4.7 localStorage keys (per window partition `persist:admin` / `persist:cashier`)
| Key | Holds |
|---|---|
| `pos_session_token` | This window's session token |
| `pos_locked_user` | User id while the lock screen is up (survives reload) |
| `pos_sale_draft_{station}` | Debounced crash-recovery draft of the POS cart |
| `pos_held_bills_{station}` | Array of held bills `{id, number, name, createdAt, customerId, lines[], discountMode, discountInput}` (per PC, not synced, no prices stored) |
| `pos_product_view_mode`, `pos_product_sort_prefs` | Products list view (List/Cards/Compact) and sort |
| `pos_customer_view_mode`, `pos_supplier_view_mode` | Customers/Suppliers list view |
| `pos_customer_account_view_mode`, `pos_supplier_account_view_mode` | Ledger account list views |
Other list state (search/filter/sort/range of Products, Stock, Customers, Suppliers, Sales/Purchase History, Ledger lists) is kept only in module memory by `utils/useRememberedState.js` (cleared by an app restart).


## 5. Access control

Covers: the accounts, the permission catalog, the guard's rules and a table of every IPC channel with who may call it.

### 5.1 Accounts and sessions
- **Exactly one Admin**, created in Setup; no UI creates another. Cashiers are created by the Admin (`users:create-cashier`, password ≥ 6 chars; new cashiers get **no** permissions until granted, except the defaults in the catalog: `add_missing_items`).
- **Login** (`users:login`): bcrypt check; inactive users are rejected with the same "Invalid username or password." as a wrong password; then the window-mode role check (§3.1); creates a **12-hour** session (random 32-byte token), logs `login` activity, records the identity for that window. **Lockout:** 5 wrong passwords for one username → refused for 5 minutes ("Too many wrong tries. Try again in 5 minutes."), counters kept in main's memory (reset on restart), cleared by a right password. The same counter is used by the Admin approval box (`checkAdminCredentials`) and `users:verify-password` (lock screen). `users:validate-session` on app load; `users:logout` revokes the session (`ended_at`) and clears the window's identity. Deactivating a cashier or resetting their password revokes all their sessions.
- **Idle auto-lock** / Ctrl+L lock screen: §7.6.
- **Demo cashier (development only):** `seedDummyCashier()` runs only when `!app.isPackaged`: ensures user `cashier` ("Cashier (Demo)") with `make_sale`, `record_payment`, `max_discount_percentage=10`. Installed builds never create it (a leftover from an older install stays; deactivate it from Cashiers). The password is in `users.ipc.js`.

### 5.2 Permission catalog (`src/shared/permissionDefinitions.js`; the renderer gets it through `permissions:get-definitions`)
| key | type | label | meaning |
|---|---|---|---|
| `make_sale` | boolean | Make Sales (POS) | New Sale; also edit/void own bills, today's bills |
| `view_products` | boolean | View Products & Stock | Product list/profile, Running Low, stock movements/stats |
| `record_payment` | boolean | Record Customer Payments | Receive Payment (cash). Granted to a counter PC's first cashier at Setup |
| `max_discount_percentage` | number | Maximum Discount % | Per-cashier cap; blank → `settings.default_cashier_discount_cap`; neither → 0 (fail safe) |
| `view_sales_history` | boolean | View Sales History | Sales list/detail, **own sales only** (server-enforced) |
| `view_reports` | boolean | View Reports | Sales Report only, **own sales only** |
| `add_missing_items` | boolean | Add missing items at the counter | Rule 11 quick-add (F7). `defaultForNewCashier: true` |
| `manage_expenses` | boolean | Manage Expenses | Expenses list/add/edit/delete |
Admin implicitly has every permission (`hasPermission` short-circuits on role; discount cap `null` = none). Rows live in `user_permissions` (row exists = granted; `value` only for valued keys).

### 5.3 Guard rules (`security/ipcGuard.js`, applied to every `ipcMain.handle`)
1. The call must come from the app's own page (dev server origin in dev; `renderer/dist/index.html` packaged) — else "This action is not allowed here."
2. **Public** (no sign-in): `ping`, `setup:get-status`, `users:login`, `users:validate-session`, `users:logout`, `devpanel:verify-password`, every `app:*`; **before setup is done only**: `setup:create-admin`, `setup:join-as-cashier`, `backup:validate-and-restore`; **signed-out counter PC that has never synced successfully**: `sync:get-peers`, `sync:trigger-now`.
3. Other `devpanel:*` need that window's Dev Panel unlock (any screen, signed in or not).
4. Everything else needs a signed-in user in that window, else `{success:false, reason:'Please sign in again.'}` (preload fires `pos:session-ended`).
5. **Print windows** may call only `sales:get-receipt-data`, `purchases:get-receipt-data`, `ledgers:get-payment-by-id`, `settings:get-all`, `reports:get-report`.
6. **Admin-only** (`ADMIN_PREFIXES`: `returns:`, `purchases:`, `suppliers:`, `dashboard:`, `sessions:`, `printers:`, `backup:`, `system:`, `global:`, `updates:`; plus the explicit `ADMIN_CHANNELS` set: ledger reads/corrections, printing of purchases, supplier payments, payment delete, stock add/remove/adjust/list-recount/resolve-recount, approvals list, product writes/import/checks/transliterate/dead-stock/review lists/approve/merge, category writes, customer list/writes/duplicate-phone/next-id, user/permission writes, settings writes, letterhead writes/pick, sync admin channels incl. the secret, the non-sales reports): "This action is restricted to Admin accounts."
7. **Permission-gated** (`PERMISSION_CHANNELS` + special cases): `sales:create|update|void|list-recent|get-for-edit` → `make_sale`; `payments:create-standalone` → `record_payment`; `sales:list|get-detail` → `view_sales_history`; `reports:get-sales-report` → `view_reports`; `products:list|get-by-id|get-low-stock`, `stock:get-product-stats|get-movements` → `view_products`; `products:quick-add|find-similar` → `add_missing_items`; `expenses:*` → `manage_expenses`; `reports:get-report` / `reports:export-pdf` by `reportType` (`sales` → `view_reports`, `expenses` → `manage_expenses`, every other type Admin only).
8. All other reads (customer search/ledger, letterheads list, settings read, POS search/pricing, printing of sales/payments, categories list, `sync:get-status`, `permissions:get-definitions`, `users:get-permissions`, `approvals:request`) need only a signed-in user.
9. Hard role gates in the UI (also enforced server-side where money/data is involved): Customers, Suppliers, Ledgers, Returns, Purchases, Stock, Categories, Not Selling, Import, Reports other than Sales, Cashiers, Settings, Updates, Dev Panel tools. Permission-gated pages: New Sale, Receive Payment, Sales History, Expenses, Products/Running Low, Sales Report.

### 5.4 Every IPC channel
**Count: 180 channels** in `src/main/**` (177 exposed through `preload.js` as `window.api.*`; the 3 `recovery:*` channels are registered only in recovery mode and exposed by `update/recoveryPreload.js`). The table is generated from every `ipcMain.handle(...)` in the code and classified with the guard's rules (§5.3).

| Channel | File | Who may call | Purpose |
|---|---|---|---|
| `app:get-clock-status` | app.ipc.js | Public | Rule 15: is this computer's clock plausible? (banner) |
| `app:open-window` | app.ipc.js | Public | Open/focus the Admin or Cashier window (`closeThis` closes the caller) |
| `app:set-busy` | app.ipc.js | Public | A window reports it is (not) entering a bill; blocks app updates while busy |
| `approvals:list` | approvals.ipc.js | Admin | Approvals log (what, bill, cashier, admin, when), paged/filtered |
| `approvals:request` | approvals.ipc.js | Signed in | Admin types username+password on a cashier screen → one-time approval token (3 min) |
| `backup:export` | backup.ipc.js | Admin | Manual backup to a chosen file (SQLite online backup) |
| `backup:get-auto-status` | backup.ipc.js | Admin | Automatic-backup status: folder, last time/file/error, USB reminder due |
| `backup:pick-auto-folder` | backup.ipc.js | Admin | Folder picker for the automatic backup folder, then saves it |
| `backup:relaunch-app` | backup.ipc.js | Admin | Restart the app into the same window mode (after a restore) |
| `backup:restore` | backup.ipc.js | Admin | Restore pos.db from a chosen backup file (validated, old data kept as .before-restore.bak) |
| `backup:run-auto-now` | backup.ipc.js | Admin | Run the automatic backup now (forced) |
| `backup:set-auto-folder` | backup.ipc.js | Admin | Set the automatic backup folder (absolute, must be writable) |
| `backup:usb-reminder-done` | backup.ipc.js | Admin | Mark the weekly "copy a backup to USB" reminder done |
| `backup:validate-and-restore` | backup.ipc.js | Public before setup | Setup screen: validate + restore a backup, then relaunch |
| `categories:create` | categories.ipc.js | Admin | Create a category (optional parent) |
| `categories:delete` | categories.ipc.js | Admin | Delete a category (blocked while products use it) |
| `categories:list` | categories.ipc.js | Signed in | List categories |
| `categories:update` | categories.ipc.js | Admin | Rename / re-parent a category |
| `customers:check-duplicate-phone` | customers.ipc.js | Admin | Rule 7: other customers with the same phone/mobile (digits compared) |
| `customers:create` | customers.ipc.js | Admin | Create a customer |
| `customers:credit-check` | customers.ipc.js | Signed in | Rule 2: would this credit sale put the customer over their limit? (numbers + message) |
| `customers:get-by-id` | customers.ipc.js | Signed in | One customer with derived balance |
| `customers:get-ledger` | customers.ipc.js | Signed in | Customer account timeline (sales, payments, returns, corrections) + balance |
| `customers:get-next-id` | customers.ipc.js | Admin | Preview of the next customer id (create form) |
| `customers:list` | customers.ipc.js | Admin | Customer list with derived balances, filters, sort |
| `customers:save-special-price` | customers.ipc.js | Admin | Save/update a customer special pricing rule |
| `customers:search-minimal` | customers.ipc.js | Signed in | Name/phone search for pickers (POS customer step, Receive Payment) |
| `customers:set-active` | customers.ipc.js | Admin | Activate / deactivate a customer |
| `customers:update` | customers.ipc.js | Admin | Edit a customer |
| `dashboard:get-active-sessions` | dashboard.ipc.js | Admin | Sessions signed in on this PC (Home card) |
| `dashboard:get-revenue-trend` | dashboard.ipc.js | Admin | Net revenue per local day for 7/30/90 days (Home chart) |
| `dashboard:get-summary` | dashboard.ipc.js | Admin | Home numbers in one call (today, receivables, low stock, review/recount counts, auto-backup status…) |
| `devpanel:change-password` | devpanel.ipc.js | Dev Panel unlocked (that window) | Change this PC's Dev Panel password (needs unlock + current password) |
| `devpanel:get-access-log` | devpanel.ipc.js | Dev Panel unlocked (that window) | Dev Panel unlock attempts (paged) |
| `devpanel:get-audit-log` | devpanel.ipc.js | Dev Panel unlocked (that window) | Audit log of every IPC call (filters, paged) |
| `devpanel:get-system-info` | devpanel.ipc.js | Dev Panel unlocked (that window) | App/DB/system information |
| `devpanel:get-table-rows` | devpanel.ipc.js | Dev Panel unlocked (that window) | Paged table viewer (password_hash/token masked) |
| `devpanel:get-users-sessions` | devpanel.ipc.js | Dev Panel unlocked (that window) | Users and sessions (token masked) |
| `devpanel:list-tables` | devpanel.ipc.js | Dev Panel unlocked (that window) | Tables with row counts |
| `devpanel:run-select-query` | devpanel.ipc.js | Dev Panel unlocked (that window) | SELECT-only query console (single statement, 1000-row cap) |
| `devpanel:verify-password` | devpanel.ipc.js | Public | Unlock the Dev Panel for this window (logged to dev_panel_access_log) |
| `expenses:create` | expenses.ipc.js | permission `manage_expenses` | Create an expense (repeating ones also create the recurring template) |
| `expenses:delete` | expenses.ipc.js | permission `manage_expenses` | Delete an expense |
| `expenses:get-by-id` | expenses.ipc.js | permission `manage_expenses` | One expense |
| `expenses:list` | expenses.ipc.js | permission `manage_expenses` | Expense list/filters (catches up due recurring expenses first) |
| `expenses:stop-recurrence` | expenses.ipc.js | permission `manage_expenses` | Stop a repeating expense series |
| `expenses:update` | expenses.ipc.js | permission `manage_expenses` | Edit an expense |
| `global:search` | global.ipc.js | Admin | Ctrl+K search: products, customers, suppliers (capped, with balances) |
| `ledgers:create-adjustment` | ledgers.ipc.js | Admin | Balance correction on a customer/supplier (reason required) |
| `ledgers:get-advances` | ledgers.ipc.js | Admin | Parties in credit ("Paid in advance") |
| `ledgers:get-aging-report` | ledgers.ipc.js | Admin | Customer overdue buckets 0–30/31–60/61–90/90+ (one grouped query) |
| `ledgers:get-overview` | ledgers.ipc.js | Admin | Totals receivable/payable/advances + top debtors/creditors |
| `ledgers:get-payment-by-id` | ledgers.ipc.js | Signed in (+ print windows) | One payment (receipt print / reprint) |
| `ledgers:get-payment-history` | ledgers.ipc.js | Admin | Combined customer+supplier payment log |
| `ledgers:list-adjustments` | ledgers.ipc.js | Admin | Balance corrections list |
| `letterheads:create` | letterheads.ipc.js | Admin | Add a letterhead (PDF template copied into userData/letterheads) |
| `letterheads:delete` | letterheads.ipc.js | Admin | Delete a letterhead (blocked while assigned) |
| `letterheads:get-by-id` | letterheads.ipc.js | Signed in | One letterhead |
| `letterheads:list` | letterheads.ipc.js | Signed in | List letterheads |
| `letterheads:pick-pdf` | letterheads.ipc.js | Admin | Native PDF picker for a letterhead |
| `letterheads:update` | letterheads.ipc.js | Admin | Edit / set default letterhead |
| `payments:create-standalone` | payments.ipc.js | permission `record_payment` | Receive a payment from a customer (always cash) |
| `payments:create-supplier-payment` | payments.ipc.js | Admin | Pay a supplier (always cash) |
| `payments:delete` | payments.ipc.js | Admin | Delete a payment and restore bill snapshot figures |
| `permissions:get-definitions` | users.ipc.js | Signed in | The permission catalog (src/shared/permissionDefinitions.js) |
| `permissions:get-for-user` | users.ipc.js | Admin | A cashier's permission rows |
| `permissions:save-for-user` | users.ipc.js | Admin | Replace a cashier's permissions |
| `printers:list-installed` | printing.ipc.js | Admin | Installed Windows printers |
| `printers:test-print` | printing.ipc.js | Admin | Thermal test page on the saved printer |
| `printing:preview-purchase` | printing.ipc.js | Admin | A4 purchase receipt preview (PDF base64) |
| `printing:preview-sale` | printing.ipc.js | Signed in | Sale preview (A4 or thermal) as PDF base64, with stamp lines |
| `printing:print-payment-receipt` | printing.ipc.js | Signed in | Print a payment receipt (thermal/A4) |
| `printing:print-purchase` | printing.ipc.js | Admin | Print a purchase receipt (A4) |
| `printing:print-sale` | printing.ipc.js | Signed in | Print a sale; records a sale_prints row only on success |
| `printing:save-pdf` | printing.ipc.js | Signed in | Save a previewed PDF via a Save dialog |
| `products:approve-review` | products.ipc.js | Admin | Approve a counter-added item (needs buying price) |
| `products:bulk-import` | products.ipc.js | Admin | Create many products in one transaction (CSV import) |
| `products:bulk-set-active` | products.ipc.js | Admin | Bulk activate/deactivate |
| `products:bulk-set-category` | products.ipc.js | Admin | Bulk move to a category |
| `products:check-barcode-unique` | products.ipc.js | Admin | Live barcode uniqueness check (case-insensitive) |
| `products:check-sku-unique` | products.ipc.js | Admin | Live item-code uniqueness check |
| `products:create` | products.ipc.js | Admin | Create product with Types, pack sizes, prices, starting stock |
| `products:find-similar` | products.ipc.js | permission `add_missing_items` | Rule 11: similar names/barcode while quick-adding |
| `products:get-by-id` | products.ipc.js | permission `view_products` | One product with variants + units |
| `products:get-dead-stock` | products.ipc.js | Admin | Not Selling list (Product.js) |
| `products:get-low-stock` | products.ipc.js | permission `view_products` | Running Low list (Product.js) |
| `products:list` | products.ipc.js | permission `view_products` | Product list with stock, status flags, counts, sort |
| `products:list-needs-review` | products.ipc.js | Admin | Counter-added items awaiting review |
| `products:merge-review` | products.ipc.js | Admin | Merge a counter-added item into an existing product |
| `products:quick-add` | products.ipc.js | permission `add_missing_items` | Rule 11: create a missing item at the counter (needs_review) |
| `products:set-active` | products.ipc.js | Admin | Activate/deactivate a product |
| `products:transliterate-urdu` | products.ipc.js | Admin | Roman→Urdu name (Google endpoints via net.fetch) + word suggestions |
| `products:update` | products.ipc.js | Admin | Edit a product (never changes stock) |
| `purchases:create` | purchases.ipc.js | Admin | Create a supplier purchase (stock in, optional payment) |
| `purchases:get-detail` | purchases.ipc.js | Admin | One purchase with lines |
| `purchases:get-receipt-data` | purchases.ipc.js | Admin | Data for the purchase receipt print views |
| `purchases:list` | purchases.ipc.js | Admin | Purchase history (filters, sort) |
| `recovery:close` | update/recovery.js | Signed in | Recovery screen only: quit the app |
| `recovery:get-info` | update/recovery.js | Signed in | Recovery screen only: title/detail/restore availability |
| `recovery:restore` | update/recovery.js | Signed in | Recovery screen only: restore the pre-update backup and relaunch |
| `reports:export-csv` | reports.ipc.js | Signed in | Save report rows as CSV via a Save dialog |
| `reports:export-pdf` | reports.ipc.js | Signed in; `sales` → view_reports, `expenses` → manage_expenses, other types Admin | Report → PDF via a hidden print window |
| `reports:get-cashier-performance` | reports.ipc.js | Admin | Cashier performance report |
| `reports:get-customer-statements` | reports.ipc.js | Admin | Customer statements report |
| `reports:get-expense-report` | reports.ipc.js | Admin | Expense report |
| `reports:get-profit-loss` | reports.ipc.js | Admin | Profit & Loss report (with buying-price-missing block) |
| `reports:get-report` | reports.ipc.js | Signed in; `sales` → view_reports, `expenses` → manage_expenses, other types Admin | Generic dispatch used by the hidden print window |
| `reports:get-sales-report` | reports.ipc.js | permission `view_reports` | Sales report (non-admin locked to own sales) |
| `reports:get-stock-report` | reports.ipc.js | Admin | Stock report / valuation |
| `reports:get-supplier-statements` | reports.ipc.js | Admin | Supplier statements report |
| `returns:create` | returns.ipc.js | Admin | Return items from a bill (refund math, restock) |
| `returns:create-no-bill` | returns.ipc.js | Admin | Rule 17: Admin no-bill return at lowest 30-day price, cash |
| `returns:get-detail` | returns.ipc.js | Admin | One return with lines |
| `returns:get-returnable` | returns.ipc.js | Admin | Returnable quantities of a bill |
| `returns:list` | returns.ipc.js | Admin | Returns list |
| `returns:no-bill-price` | returns.ipc.js | Admin | Preview the refund price for a no-bill return |
| `returns:search-sales` | returns.ipc.js | Admin | Rule 17: find bills by invoice/customer/item/barcode/date |
| `sales:create` | sales.ipc.js | permission `make_sale` | Create a sale (server re-prices, checks, approvals) |
| `sales:get-cashier-discount-cap` | sales.ipc.js | Signed in | Caller's discount cap (permission → shop default → 0) |
| `sales:get-detail` | salesHistory.ipc.js | permission `view_sales_history` | Sales History: one sale with lines/payments/returns |
| `sales:get-for-edit` | sales.ipc.js | permission `make_sale` | Load a bill into the POS for editing |
| `sales:get-next-invoice-no` | sales.ipc.js | Signed in | Preview of the next invoice number |
| `sales:get-product-types` | sales.ipc.js | Signed in | Active Types of a product (bulk Type entry) |
| `sales:get-receipt-data` | sales.ipc.js | Signed in (+ print windows) | Receipt data for print views |
| `sales:get-sale-detail` | sales.ipc.js | Signed in | Lines of one sale (Today's bills pane) |
| `sales:get-variant-by-barcode` | sales.ipc.js | Signed in | Barcode lookup (trimmed, case-insensitive) |
| `sales:get-variant-for-cart` | sales.ipc.js | Signed in | Cart-ready variant info: units, stock, trade fields, needsReview |
| `sales:list` | salesHistory.ipc.js | permission `view_sales_history` | Sales History list (cashiers locked to own) |
| `sales:list-recent` | sales.ipc.js | permission `make_sale` | Today's bills for F2 panel |
| `sales:resolve-price` | sales.ipc.js | Signed in | Price engine result for a unit + customer |
| `sales:search-products` | sales.ipc.js | Signed in | POS/quick-bill item search (flat) |
| `sales:search-products-grouped` | sales.ipc.js | Signed in | POS item search grouped by product |
| `sales:update` | sales.ipc.js | permission `make_sale` | Edit a saved bill |
| `sales:void` | sales.ipc.js | permission `make_sale` | Void a bill (kept, counts as zero) |
| `sessions:get-detail` | users.ipc.js | Admin | One cashier session with activity |
| `sessions:list` | users.ipc.js | Admin | Cashier sessions list |
| `settings:get-all` | settings.ipc.js | Signed in (+ print windows) | All settings as an object |
| `settings:set` | settings.ipc.js | Admin | Set one setting |
| `settings:set-many` | settings.ipc.js | Admin | Set several settings |
| `setup:create-admin` | setup.ipc.js | Public before setup | First run: create Admin + station config |
| `setup:get-status` | setup.ipc.js | Public | Is this PC set up, and as what |
| `setup:join-as-cashier` | setup.ipc.js | Public before setup | First run: join as a counter PC via the Connection Code |
| `stock:add` | stock.ipc.js | Admin | Add stock (multi-line, optional price write-back) |
| `stock:adjust` | stock.ipc.js | Admin | Single-Type increase/decrease with reason |
| `stock:get-adjustment-reasons` | stock.ipc.js | Signed in | Reason codes for stock adjustments |
| `stock:get-movements` | stock.ipc.js | permission `view_products` | Stock movement history (filters, 500 cap) |
| `stock:get-product-stats` | stock.ipc.js | permission `view_products` | Product profile numbers (sales, status, names) |
| `stock:list-recount` | approvals.ipc.js | Admin | Stock to recount (open entries + Types below zero) |
| `stock:remove` | stock.ipc.js | Admin | Remove stock with reason (blocked below zero) |
| `stock:resolve-recount` | approvals.ipc.js | Admin | Mark a recount entry counted |
| `suppliers:create` | suppliers.ipc.js | Admin | Create a supplier |
| `suppliers:get-by-id` | suppliers.ipc.js | Admin | One supplier with balance |
| `suppliers:get-ledger` | suppliers.ipc.js | Admin | Supplier account timeline + balance |
| `suppliers:get-next-id` | suppliers.ipc.js | Admin | Preview of the next supplier id |
| `suppliers:list` | suppliers.ipc.js | Admin | Supplier list with derived balances |
| `suppliers:search-minimal` | suppliers.ipc.js | Admin | Supplier picker search |
| `suppliers:set-active` | suppliers.ipc.js | Admin | Activate/deactivate a supplier |
| `suppliers:update` | suppliers.ipc.js | Admin | Edit a supplier |
| `sync:get-log` | sync.ipc.js | Admin | Last 200 sync log rows |
| `sync:get-peers` | sync.ipc.js | Admin (+ signed-out counter PC before first sync) | Known computers (live + history) with version-pause message |
| `sync:get-reconciliation-warnings` | sync.ipc.js | Admin | Types with negative stock (sync oversell) |
| `sync:get-secret` | sync.ipc.js | Admin | The Connection Code (sync secret) |
| `sync:get-status` | sync.ipc.js | Signed in | This PC, outbox count, last sync, version-pause message |
| `sync:trigger-now` | sync.ipc.js | Admin (+ signed-out counter PC before first sync) | Sync now (all peers or one) |
| `system:factory-reset` | system.ipc.js | Admin | Erase all business data + setup, relaunch to Setup |
| `updates:check` | updates.ipc.js | Admin | Check GitHub for a newer version |
| `updates:consume-updated-notice` | updates.ipc.js | Admin | One-time "Updated to version X" notice for Home |
| `updates:download` | updates.ipc.js | Admin | Download the available update |
| `updates:get-state` | updates.ipc.js | Admin | Updater state (version, status, notes, progress, error) |
| `updates:install` | updates.ipc.js | Admin | Guarded install: not busy → verified backup → record → close → installer |
| `users:check-username-unique` | users.ipc.js | Admin | Live username check |
| `users:create-cashier` | users.ipc.js | Admin | Create a cashier (no permissions until granted) |
| `users:get-permissions` | users.ipc.js | Signed in | The caller's own permissions |
| `users:list` | users.ipc.js | Admin | Cashier list |
| `users:login` | users.ipc.js | Public | Sign in (window-mode role check, lockout, 12 h session) |
| `users:logout` | users.ipc.js | Public | Sign out / revoke session |
| `users:reset-password` | users.ipc.js | Admin | Reset a cashier password (revokes sessions) |
| `users:set-active` | users.ipc.js | Admin | Activate/deactivate a user (revokes sessions) |
| `users:update` | users.ipc.js | Admin | Edit a cashier |
| `users:validate-session` | users.ipc.js | Public | Validate a stored token on app load (mode-checked) |
| `users:verify-password` | users.ipc.js | Signed in | Lock screen: check the signed-in user's password |

Channels per area: app 3, approvals 2, backup 9, categories 4, customers 10, dashboard 3, devpanel 9, expenses 6, global 1, ledgers 7, letterheads 6, payments 3, permissions 3, printers 2, printing 6, products 18, purchases 4, recovery 3, reports 10, returns 7, sales 17, sessions 2, settings 3, setup 3, stock 8, suppliers 8, sync 6, system 1, updates 5, users 11 (total 180).



## 6. Business rules

Covers: how money, stock, prices and bills behave, each with the file/function that implements it. Owner decisions behind them are in §13.

### 6.1 Pricing engine — `main/pricing/priceEngine.js` `resolveUnitPrice({db, productUnitId, customerId})`
First match wins, rounded to 2 dp; `productId` comes from the unit row, never the caller:
0. Customer Special Price (`customer_special_prices`): pack-size specific match first (`product_unit_id`), then product-wide fallback (`product_unit_id IS NULL`). Supports `fixed` (Rs.), `discount_percent` (% off standard price), and `margin_percent` (% over cost_price).
1. The unit's `net_rate_c{tier}` for the customer's tier (C1–C5) if set.
2. Product `pricing_type='percentage'` → `cost × (1 + default_percentage/100)`.
3. `wholesale_price` for wholesale customers, else `retail_price` (walk-in = retail).
(The old per-customer/per-tier "Special Margins" steps were removed with the feature; `percentage_pricing_rules` is dormant.)
**Trade Price method** (`product_units.pricing_method='trade'`): the product form (`ProductForm.jsx withTradePrices()`) derives and **stores** `cost_price = trade − trade×purchase% − extra` (min 0), `retail_price = wholesale_price = trade`, `net_rate_cN = trade − trade×saleDiscountCN%` (blank → NULL). The engine, POS, reports and purchases only ever read the standard columns. Purchase/Add-Stock lines for trade pack sizes recompute unit cost live with `billingUtils.tradeUnitCost()`; only the final `unitCost` is stored.

### 6.2 Server re-checks every sale price (Rule 1) — `sales.ipc.js priceLines()`
In `sales:create`/`sales:update` each line is re-resolved with the engine for that customer + pack size. A sent price differing by more than `PRICE_TOLERANCE` (0.01) is refused (`{success:false, priceChanged:true, changedLines, reason:'The price of "X" is now …'}`) **unless the caller is the Admin** (manual override, typed in the quick Sale form's price box — the keyboard POS has none) **or** an edit keeps the bill's own stored price for that pack size for the same customer (D1). The **server's price is stored**; line totals and subtotal are recomputed from it. A pack size that does not belong to the item, or a deactivated product/Type/unit/customer, is refused with a plain message. The POS shows the changed price and the cashier retries (a mid-bill price change is also re-resolved when a line is next touched, D13/anomalies).

### 6.3 Balances — `ledger/balanceEngine.js` (never stored)
- **Customer** = `opening_balance + Σ sales.total_amount(is_voided=0) − Σ payments(customer, is_voided=0) + Σ ledger_adjustments + Σ (sale_returns.cash_refund_amount − sale_returns.total_amount)`. Positive = owes the shop.
- **Supplier** = `opening_balance + Σ purchases.total_amount − Σ payments(supplier, is_voided=0) + Σ ledger_adjustments`. Positive = the shop owes the supplier.
- Batch versions `getBalancesForCustomers/Suppliers` for lists (one grouped query per table). Used by: Ledgers (overview, advances, aging via sales), customer/supplier lists and profiles, reports statements, Home receivables, global search, returns, receipts, credit-limit check.
- A voided bill and its linked payments count as **zero** everywhere (every sum filters `is_voided = 0`; see 6.5).
- Customer aging (`ledgers:get-aging-report`) buckets each unpaid sale's `balance_due` by its own age (0–30, 31–60, 61–90, 90+); an approximation (no FIFO), customers only, one grouped query.

### 6.4 Stock
- `product_variants.stock_qty` (base units) moves only together with a `stock_movements` row. Invariant: stock = Σ its movements.
- **Movement types / references written:** `sale` (−, ref `sale`), `adjustment` with ref `sale` (reversal for edit/void, notes "Reversed for edit of …"/"Voided …"), `purchase` with ref `purchase` (purchases) or `initial_stock` (product create / edit starting stock), `return_in` ref `return`, `adjustment` ref `adjustment` (Fix stock count, merge moves, quick-add), `adjustment` ref `stock_in` / `stock_out` (Stock module Add/Delete Stock). Type `return_out` exists in the CHECK but nothing writes it.
- **Stock module** (`stock.ipc.js`): `stock:add` (multi-line; Simple pack sizes → buying price write-back to `cost_price`; Trade → trade fields + derived cost/retail/wholesale/net rates; optional "save buying prices" default on), `stock:remove` (reasons: Damaged / Expired / Lost / Recount / Other; blocked below zero, rows sharing a Type are summed), `stock:adjust` (single Type ±, reasons `damaged|expired|lost|recount|other`). Each submit = one transaction. All quantities whole (Rule 3).
- **Status** (`db/models/Product.js`, the one definition): Running Low = `total_stock ≤ min_stock_alert`; Not Selling = days since last sale (or creation) ≥ `dead_stock_days`; Out of stock = 0. A product can be low and dead at once.
- **Stock to recount** (Rule 12): lines sold without enough stock insert `stock_recount` rows (reason `sold_without_stock`); `stock:list-recount` shows open entries plus every Type currently below zero; "Mark counted" sets `resolved_at/by`.
- Stock never goes negative by itself except: Admin-approved oversell, counter-added items (`needs_review`, sellable with no stock), and sync oversells (two PCs sold the last unit; shown in Connected Computers → "Stock went below zero").

### 6.5 Sales — create, edit, void (`sales.ipc.js saveSale`, `voidSale`)
**Create/update** (one transaction):
1. Validations: cashier present, cart not empty, customer exists and active, quantities positive **whole** numbers (qty and FOC, `validation/quantity.js`), prices/line totals consistent (`|line − qty×price| ≤ 0.02`), no negative discount/paid, discount ≤ subtotal.
2. Price re-check (6.2). **Large line confirm (D13):** any line with quantity > 100 or line total > Rs 100,000 returns `needsLargeConfirm` unless `allowLargeQty` is sent.
3. `total = max(0, subtotal − discount)` (tax is always 0; **no rounding to whole rupees**), `balance_due = max(0, total − paid)`, `payment_status` = paid/partial/unpaid. A **walk-in must pay in full** ("Select a customer to sell on credit — walk-in sales must be paid in full.").
4. **Discount cap:** cashier cap = permission value → shop default → 0; Admin none. Over the cap needs an Admin approval (6.8).
5. **Stock:** each variant's needed base quantity (sold + FOC, all lines of the variant together) vs `stock_qty`; shortage → cashier needs approval (`sell_without_stock`), Admin gets `needsStockConfirm` and resends `allowNegativeStock`; `needs_review` products skip the check. Shortages are inserted into `stock_recount`.
6. Inserts/updates `sales` + `sale_items`, decrements `stock_qty` by `(quantity + foc) × conversion_factor`, `last_sold_at`, `stock_movements('sale')`; for a **named customer** with paid > 0 inserts a linked `payments` row (**always `cash`**, Rule 9; walk-in money lives only in `sales.paid_amount`). Logs `sale_created`/`sale_edited` in `activity_log`. A used approval is consumed only after the save succeeds.
7. **FOC (free of cost):** `sale_items.foc_quantity`, same pack size, never priced and never discounted; stock leaves for quantity + FOC; P&L cost counts both; returns work on sold quantity only.
8. **Invoice number** `{station}-{YYYYMMDD}-{seq4}` (UTC date) per station per day = max existing + 1, but never below `settings.last_invoice_seq:{station}:{date}`, so a voided number is never reused (`getNextInvoiceNo`, `rememberInvoiceNo`).
**Edit** (`sales:update` → `saveSale(payload, saleId)`): refuses voided bills and bills with returns; a cashier may change **their own** bill only; Rule 13: no approval needed within 10 minutes of the bill's `created_at` (`CASHIER_EDIT_MINUTES`; editing does not restart the window; a clock set earlier than the bill counts as inside), later needs an Admin approval (`change_old_bill`). Steps: put every old line back on the shelf (movements type `adjustment`, ref the sale) → delete the bill's customer payment rows and `sale_items` → validate/stock-check → update the `sales` row (customer, type, letterhead, totals, payment fields; `created_at` and invoice no. kept) → insert new lines/movements/payment. Rolls back wholly on any failure.
**Void** (`sales:void`): same ownership/10-minute/approval rules (`void_old_bill`), refused if the bill has returns or is already voided. Puts stock back (movements ref `sale`, note "Voided …"), marks its payments `is_voided=1`, sets `sales.is_voided=1, voided_at, voided_by`, recomputes `last_sold_at` from bills that still count. The bill and lines **stay**: visible in Sales History and POS Today's bills with a red "Voided" badge, reprints say `*** VOIDED ***`, cannot be edited/returned, **count as zero** in every report, Home, cashier performance, balances, ledgers, statements and sync (a void is an UPDATE that syncs). Hidden from Home "Recent sales" and customer ledger timelines.
**Which queries exclude voided rows:** `balanceEngine` (sales, payments), `creditLimit` own-bill lookup, `customers/suppliers getLedger`, `dashboard` (today, recent, trend), `ledgers` (payment history, last activity, aging), `reports` (sales rows, P&L revenue/cost, cashier performance), `stock.getProductStats`, `salesHistory.list` (rows kept, flagged; sums exclude + `voidedCount`). **Not filtered on purpose:** invoice-number lookup, single-row lookups by id, returns sums (a voided bill can never have a return).

### 6.6 Returns (`returns.ipc.js`, Admin only, server-enforced)
- **With a bill** (`returns:create`): one sale; only its lines; quantity per line ≤ sold − already returned (whole numbers); refused for voided bills. Refund per unit = `line_total ÷ qty_sold × (sale.total_amount ÷ Σ line_totals)` (spreads the bill discount); when the return empties the bill the total is forced to `sale.total − earlier returns` (rounding lands on the last line). **Cash back:** walk-in → all cash; named customer → cash ≤ `max(0, total − balance_before)` (a customer who owes money gets the debt reduced; cash only beyond that). **Restock** (default on): `stock_qty += qty × conversion` + `stock_movements('return_in', ref 'return')`; `restocked=0` leaves stock. Balance effect `−(total − cash_refund)` on the customer. Return number `{station}-R-{YYYYMMDD}-{seq4}`. Permanent: no edit/delete/undo; the sale row is never modified.
- **Finding the bill** (Rule 17, `searchSalesForReturn`): by invoice number, customer name/phone/mobile, item name / `search_alias` / barcode, typed date (`YYYY-MM-DD` or `DD-MM-YYYY`) or a date range; excludes voided bills; includes `return_status`.
- **No-bill return** (`returns:create-no-bill`, `getNoBillPrice`, Admin only): pick product Type + pack size + quantity; refund = the item's **lowest selling price in the last 30 days** of non-voided sales **after bill-level discount** (`unit_price × total/subtotal`, D12), else the current retail price; **cash only**; stock goes back in; stored with `sale_id=NULL`, `customer_id=NULL` so it stays out of per-sale returnable logic; charged to the recording Admin in Cashier Performance.
- **No exchange screen** (Rule 8): an exchange = a return + a new sale (hint on the return-done sheet).

### 6.7 Payments and cash only (Rule 9)
`payments:create-standalone` (permission `record_payment`), `payments:create-supplier-payment` (Admin), and the payment saved with a sale/purchase always store `payment_method='cash'` whatever the screen sends; old rows keep `cash|bank|other` and still display it. POS payment step = "Amount received" + "Change". Overpayment above what is owed asks a confirm. **`payments:delete`** (Admin): removes any payment row and restores the bill snapshot (sale-linked → lowers `sales.paid_amount` and recomputes `balance_due/payment_status`; supplier "Paid with purchase…" → lowers the matching purchase's `paid_amount`); refuses a voided payment. "Owed amount" quick entries are balance corrections (`ledger_adjustments`, reason starting "Owed amount"), not payments; "Advance payment" entries are normal payments with that note prefix.

### 6.8 Admin approval on the cashier screen and the 10-minute rule (Rules 12, 13)
- The cashier's save returns `{success:false, needsApproval:true, approvalReasons, approvalLabels, reason}` for: **discount over the cap** (`discount_over_cap`), **selling more than is in stock** (`sell_without_stock`), **changing/voiding a bill older than 10 minutes** (`change_old_bill`/`void_old_bill`). The renderer opens `AdminApprovalDialog` (Admin username + password), calls `approvals:request` → `approvals.ipc.js` verifies with `users.ipc.js checkAdminCredentials()` (bcrypt, **same 5-tries/5-min lockout counter** as login, no session created) → `security/approvals.js issueApproval()` returns a **one-time token** (TTL 3 min, bound to the asking window's user). The save is retried with the token; the token is **peeked** during the save and **consumed only after it succeeds**; one approval covers everything that save needed (D9). Each approved save writes an `approvals` row (what, details, bill, cashier, admin, station).
- A cashier can **never** change another cashier's bill, even with approval. The Admin never needs the box (oversell = a plain "Sell anyway?" confirm, still put on Stock to recount, not in the approvals log).
- Discount over cap / stock shortages are warnings while building the bill, not dead ends.

### 6.9 Quick-add and Needs review (Rule 11, `main/products/quickAdd.js`)
Permission `add_missing_items` (default on for cashiers; Admin always). In the POS press **F7** (item search / cart edit) when nothing matches: barcode optional (trimmed, unique case-insensitive; pre-filled when the text looks like a code), name required (similar names shown as buttons to pick the real item — `products:find-similar`), retail price > 0. `quickAdd` creates a real product flagged `needs_review=1, created_via='quick_add'` with one Type "Standard" and one "Piece" pack size (retail = wholesale = price, cost 0), stock 0 — **sellable with no stock** (goes negative). Admin: Products → **Needs review (n)** (badge, Home/bell "Items added at the counter"): Edit (set buying/other prices, category, stock), **Approve** (refused until every pack size has a buying price), or **Merge** into an existing product (`merge`: sale lines → the chosen Type + pack size with the same pieces per pack, purchase lines moved, stock moved as two movements, barcode moved if the target Type has none, the item deactivated and `merged_into_product_id` set; old movement rows stay on the switched-off item). **"Buying price missing"** (D8) = needs review OR a pack size with buying price 0: such items are left out of stock value and their sales are reported separately in P&L ("Items with buying price missing", "Sales of those items (profit not known)") and flagged in the Stock report.

### 6.10 Warnings that never block
- **Credit limit** (Rule 2, `ledger/creditLimit.js creditLimitCheck`, `customers:credit-check`): before saving a credit sale POS/quick bill ask; if `balance_after > credit_limit` (limit > 0) a dialog "Over the credit limit" shows `"This puts <name> at Rs. X, over their credit limit of Rs. Y. Over by: Rs. Z."` with **Save anyway / Go back**. The server never blocks.
- **Below cost** (Rule 6, `pricing/belowCost.js` + renderer copy): retail/wholesale/Price Level 1–5 below the pack size's buying price → product form "Price below buying price" confirm (Save anyway / Fix prices) and the Admin price override in the quick Sale form (Sell anyway / Go back). Cashiers can only sell at the engine price, i.e. a price the Admin set. Buying-price write-backs from Add Stock/purchases are not warned (D6).
- **Duplicate customer phone/mobile** (Rule 7, `findDuplicatePhones`, digits compared, +92 → 0): "Same phone number" confirm naming the other customer(s); `customers:create/update` never block.
- **Wrong computer clock** (Rule 15, `system/clockCheck.js getClockStatus`): wrong when year < 2026, now > 5 min earlier than the newest saved sale/return/payment, or > 2 years past the newest record (or past 1 Jan 2026 when there are none). `app:get-clock-status` (public) → `ClockWarningBanner` (both windows, also on Login/Setup, checked every minute and after each sale): "The computer's date/time looks wrong - fix it before selling." Selling is never blocked.
- **Not enough stock**, **discount over cap**: see 6.8.

### 6.11 Counter anomalies (Stage 1, D13/D14, `tests/rules/checks/r18-anomalies.js`)
Scanner input: `cleanBarcode` strips `\r\n\t`, trims, matches `COLLATE NOCASE`; a barcode equal to a product name matches the barcode first (`BillItemSearch` tracks arrow navigation). A scan adds **1 of the default pack size** of that Type (Rule 4; barcodes stay per Type, never per pack size; the quick forms also add just that Type). Back-to-back scans: the box is emptied before the lookup, the Enter reads the barcode from the input. Double Enter/click on Pay = one sale (`completingRef` lock). Deactivated product/Type/unit/customer refused. Window switch mid-sale is safe (separate partitions). Printer off = sale saved + clear message, next print still counts as the original. Two cashiers selling the last unit → second needs Admin approval and lands on Stock to recount. **Sign-out or session end with a non-empty POS cart holds it** automatically (`pos:before-logout` → `pos_held_bills_<station>`, draft cleared); the debounced draft is flushed on `beforeunload`; a crash is recovered from `pos_sale_draft_<station>` ("R resume / N new").

### 6.12 Held bills and drafts (POS, per PC, not synced)
`F4`/Hold parks the cart as `Hold N · {customer or Walk-in}` in `pos_held_bills_{station}` (no prices stored; re-priced on recall) and returns to idle; `F3` opens the Recall panel (↑↓, Enter recall, Delete discard); recalling auto-holds whatever was on screen. The single draft `pos_sale_draft_{station}` is crash recovery only. Hold is disabled while editing a saved bill.

### 6.13 Purchases (`purchases.ipc.js create`, Admin)
Supplier + lines (product/Type/pack size/qty/free qty/cost; trade lines compute cost live) + bill discount (% or amount) + amount paid now (cash). One transaction: `purchases` (subtotal, `discount_amount`, `total_amount = subtotal − discount`, `paid_amount` capped at total) + `purchase_items` (`foc_quantity`), `stock_qty += (qty + free) × conversion_factor`, `last_purchased_at`, `stock_movements('purchase', ref 'purchase')`, and when paid > 0 a linked supplier `payments` row (note "Paid with purchase …", cash). Permanent (no edit/delete); does not update the product's stored cost price. The quick form sends no supplier bill number (column kept for old data; Purchase History still searches it). A freshly saved purchase opens the A4 preview automatically.

### 6.14 Expenses (`expenses.ipc.js`, `expenses/recurringExpenses.js`, permission `manage_expenses`)
One-time or repeating (daily/weekly/monthly/annually) with payee, description, amount, date. Creating a repeating expense inserts the first real occurrence **and** a `recurring_expenses` template. `generateDueRecurringExpenses()` (boot + before every expenses read, the expense report and P&L) catches up every missed occurrence; `addPeriod` clamps month/year ends (Jan 31 + monthly → Feb 28/29). Recurrence is locked after creation; "Stop repeating" sets `active=0` (existing rows untouched). Expenses can be edited and hard-deleted. Not synced.

### 6.15 Automatic backup (Rule 16, `backup/autoBackup.js`)
`startAutoBackup()` runs 5 s after boot and at every local midnight: `runAutoBackup` copies the DB with SQLite **online backup** (`db.backup`, includes WAL data) to `<folder>\arwaat-auto-YYYY-MM-DD.db` via a `.part` file, once per local day unless forced, prunes `arwaat-auto-*` older than **30 days** (other files untouched), records last time/file or the error in settings. Folder = `auto_backup_folder` (absolute + writable, default `Documents\ARWAAT Backups`). Home shows a failure (`BackupNotice`) and a weekly "Copy a backup to a USB drive" reminder with the folder (`usb_reminder_done_at`); Settings → Backup shows the last backup, Change folder, Back up now. Manual export uses the same online-backup method. **Restore** (`backup:restore`, Setup restore): the file must contain `users` and `station_config` (or the pre-035 `license_activation`) and pass `quick_check`; the current DB is kept as `pos.db.before-restore.bak`, stale `-wal/-shm` deleted, the restored file's `station_id` dropped (two PCs never share an identity), then relaunch.

### 6.16 Reprints and stamps (Rule 14)
`printing:print-sale` records a `sale_prints` row (`copy` original|duplicate) **only after a successful print** (printer off/unset is not counted; a preview never counts; payment/purchase receipts are not stamped, D11). `receiptData.buildReceiptData` adds `stampLines`: `*** VOIDED ***` + voided date for a voided bill, and `DUPLICATE COPY` + `Reprinted dd-mm-yyyy hh:mm` (local) when a print was already recorded. The same lines print on thermal ESC/POS, the thermal preview, the A4 letterhead PDF and the A4 HTML fallback, and show as a banner in `PrintPreviewModal`.

### 6.17 Reports math (`reports.ipc.js`; every handler returns `{success, summary[], columns[], rows, chartData, …}`)
- **Sales:** net sales = Σ non-voided sales − Σ returns (counted on the return's day); count, average sale (gross ÷ count), returns, retail/wholesale split; per local day. A non-admin caller is **always locked to their own sales server-side**.
- **Profit & Loss:** buckets by day (≤ 31 days), week (≤ 180) or month; net sales = sales − returns; cost of goods = Σ (qty + FOC) × **current** `cost_price` minus the cost of returned items with `restocked=1`; expenses by `expense_date`; plus the buying-price-missing block (6.9). No-bill returns counted cleanly.
- **Stock:** per product stock, valuation = stock × cost per base unit (pack size with the smallest conversion factor), status from `Product.js`, value by category; items with buying price missing flagged and left out of the valuation.
- **Customer / Supplier statements:** balances from `balanceEngine`; tier filter / "only who owe".
- **Cashier performance:** per cashier sales, net sales (returns charged to the cashier of the ORIGINAL sale on the return date; no-bill returns to the recording Admin), returned, average, discounts.
- **Expense report:** range + recurrence filter, spending by recurrence.
- Caveats shown in-app: P&L cost uses current buying prices; stock value uses the smallest pack size's price; payment status is a snapshot from sale time.
- **Home** (`dashboard:get-summary`): Sales Today = today's sales − today's returns (local day); Customers Owe You = Σ positive balances (equals Ledgers overview); Running Low; Expenses This Month; counts for Needs review / Stock to recount; auto-backup status.

### 6.18 Quantities, rounding and formats
Whole positive numbers only for sale, FOC, return, purchase, stock add/remove/fix and quick-add (`validation/quantity.js wholeQty`, `WHOLE_QTY_MSG`; boxes strip everything but digits as typed/pasted via `renderer/utils/quantity.js`). Old saved decimal quantities still display and count (D3). Money on screen shows the exact amount with thousands separators and paisa when present (`utils/format.js formatCurrency`); the compact K/M form (`formatCurrencyCompact`) is only for Home tiles, the Home chart total and report summary cards.


## 7. Screens

Covers: every route in both windows, the POS stage machine and keys, and each screen's tabs/actions/shortcuts and who can see it.

### 7.1 Admin routes (`config/navConfig.js` + `AdminDashboard.jsx` switch; 58 routes + `/dev/design-gallery`)
Sidebar: a prominent **New Sale** button (`/pos`, `make_sale`) and **Home**, then groups. A group header is hidden when none of its items is visible. `Tabs` show when ≥ 2 are visible; `pages` are forms/detail views (back button "‹ Section").

| Group · Section (route) | Tabs | Pages (hidden routes) | Visibility |
|---|---|---|---|
| Home `/dashboard` | — | — | Admin |
| INVOICES · **Sale** `/sales` | Sales `/sales` (Sales History), Returns `/sales/returns` | — | Admin (cashier gets `/sales` via Menu with `view_sales_history`) |
| INVOICES · **Purchase** `/products/purchases` | Purchases (Purchase History) | — | Admin |
| INVENTORY · **Products** `/products` | All Products `/products`, Running Low `/products/low-stock`, Not Selling `/products/dead-stock`, Categories `/products/categories`, **Needs review** `/products/needs-review` (Admin, badge) | `/products/profile`, `/products/new`, `/products/edit`, `/products/bulk-import` | Tabs gated by `view_products`/Admin |
| INVENTORY · **Stock** `/stock` | Stock `/stock`, History `/stock/history`, **To recount** `/stock/recount` (badge) | — | Admin |
| PEOPLE · **Customers** `/customers` | All customers | `/customers/profile`, `/customers/new`, `/customers/edit`, `/payments/record` (Receive Payment) | Admin (Receive Payment: `record_payment` for cashiers) |
| PEOPLE · **Suppliers** `/suppliers` | Suppliers | `/suppliers/profile`, `/suppliers/new`, `/suppliers/edit` | Admin |
| MONEY · **Ledgers** `/ledgers` | none (hierarchical) | `/ledgers/customers`, `/ledgers/suppliers`, `/ledgers/more`, `/ledgers/payments`, `/ledgers/advances`, `/ledgers/aging`, `/ledgers/adjustments` | Admin |
| MONEY · **Expenses** `/expenses` | Expenses | `/expenses/new`, `/expenses/edit` | `manage_expenses` |
| MONEY · **Reports** `/reports` | All Reports (Admin), Sales `/reports/sales` (`view_reports`), `/reports/profit-loss`, `/reports/stock`, `/reports/customers`, `/reports/suppliers`, `/reports/cashiers`, `/reports/expenses` | — | `view_reports`; others Admin |
| SYSTEM · **Cashiers** `/cashiers` | Cashiers, Session Activity `/cashiers/sessions`, **Approvals** `/cashiers/approvals` | `/cashiers/new`, `/cashiers/edit`, `/cashiers/sessions/detail` | Admin |
| SYSTEM · **Settings** `/settings/preferences` | Preferences, Receipt Header & Footer `/settings/receipt-content`, Letterheads `/settings/letterheads`, Printers `/settings/printers`, Connected Computers `/settings/sync`, Backup & Restore `/settings/backup`, **Updates** `/settings/updates` | — | Admin |
| (dev) `/dev/design-gallery` | — | Design Gallery, Ctrl+Shift+G, dev builds only | dev |
Also `/pos` (the keyboard POS, opened by the sidebar New Sale button). Every route has a real page.

**Cashier window** (`CashierLayout` + `CashierRoutes.jsx`): no sidebar or tabs; home is `/pos`; a header **Menu** lists what the permissions allow — New Sale `/pos` (`make_sale`), Receive Payment `/payments/record` (`record_payment`), Sales History `/sales` (`view_sales_history`), Expenses `/expenses` (`manage_expenses`), Products `/products` and Running Low `/products/low-stock` (`view_products`), Sales Report `/reports/sales` (`view_reports`); hidden `/expenses/new`, `/expenses/edit`, `/products/profile`. `CashierRoutes` re-checks the permission per route. The header has the live clock, Lock, sync chip and user chip. **The Menu instead of a sidebar is intentional.**

### 7.2 New Sale — keyboard POS (`pages/POS/Sale.jsx` + `POS/parts/`)
One component owns a keyboard **stage machine**; the mouse works as a fallback. Stages (`STAGE_LABELS`): `idle`, `customer`, `item-search` ("Add Items"), `qty`, `cart-edit`, `discount`, `format`, `payment`, `confirm`. The step strip shows Customer → Items → Discount → Payment. On-screen hints come from `parts/KeyHints.jsx` (keep it in sync with the key handler in `Sale.jsx`).

| Stage | Keys |
|---|---|
| idle | `S` new sale; with a saved draft: `R` resume / `N` new |
| customer | type to search, `↑↓` choose, `Enter` select, `Tab` walk-in/skip, `Esc` cancel sale |
| item-search | debounced grouped search or exact barcode scan. Results open: `↑↓` product, `Tab` Type/Pack size, `←→` change, `Enter` add, `Esc` cancel sale. Results closed: `Enter` add (with text), `↑↓` jump into the cart (empty box), `Tab` next: Discount, `Ctrl+←/→` change step, `F7` add a missing item |
| qty | `Enter` add, `Tab` Quantity ↔ Free (FOC), `Esc` back. A product with several Types shows the **bulk Type entry** panel instead (quantity per Type, blank = 0, `Enter` adds every Type with a quantity as its own line, `↑↓/Tab` move) |
| cart-edit | `↑↓` line, `Enter`/`E` edit qty/free (`Tab` field, `Enter` save, `Esc` cancel), `Delete`/`Backspace` remove, `Ctrl+Z` undo (UndoPill), `Esc` back |
| discount | amount or % (shop cap shown), `Enter`/`Tab` next |
| format | `←→` or `1`/`2`: Retail thermal vs Wholesale A4 (default from customer type; A4 letterhead = customer's, else default, else the only one) |
| payment | **cash only**: "Amount received" and "Change"; `Enter` = exact payment (or finish when an amount is typed); a partial/unpaid sale needs a named customer (`Esc` → choose one); "Show outstanding balance on receipt" toggle with a smart default |
| confirm | `SaleCompleteSheet`: `Enter` new sale, `Esc` close, `R` print if the receipt did not print. The Print Preview opens automatically right after the sale is saved |
Anywhere (except the done sheet): `F2` Today's bills (`RecentBillsPanel`), `F3` Held bills (Recall), `F4` Hold the current sale, `F6` Return (Admin only; opens the Returns screen in a `BillOverlay`, Sale.jsx's handler is inert meanwhile), `F7` Add a missing item (needs `add_missing_items`), `Esc` cancel dialogs. `Ctrl+←/→` jumps between steps from any non-editing stage (`jumpToStep`; items → discount needs ≥ 1 item). Cancel dialog: `Enter` cancel sale, `Esc` keep working. Buttons are `tabIndex -1` and keep focus in the search box; `PosButton` is the large 3-D action button.
- **Item search rows** show "Only N left" when stock ≤ the product's `min_stock_alert` (fallback 5, `LOW_STOCK` in `ItemSearchPanel`); no match → "Nothing matches "x". Press F7 to add it as a new item."
- **Summary card:** once a named customer is picked, **Previous balance** (from `customers:get-ledger`) and **New balance** = previous + bill − paid (live; excludes the bill's own effect when editing); not shown for walk-in; Amount received/Change.
- **Finalize:** the client re-fetches the discount cap right before saving; the server does the real checks (§6.5). Dialogs the POS can raise: credit-limit warning (Save anyway / Go back), large quantity/amount confirm, price-changed notice ("Use new prices"), Admin approval box, Admin "Sell anyway?" for stock.
- **Today's bills** (`F2`, `RecentBillsPanel`): the signed-in user's local-day bills (Admin: everyone's) from `sales:list-recent`; `↑↓` walk, `Enter` Edit bill, `Delete` or the **Void** button → "Void bill" confirm (Enter); bills with returns or voided are locked (voided shows a red badge and "counts as zero"). An older bill's edit/void opens the Admin approval box. Edit mode rebuilds the cart with the stored prices/FOC/discount/paid, shows "Editing bill {invoice}", disables Hold and draft autosave, auto-holds whatever was in the cart first.
- **Held bills / draft / sign-out hold:** §6.11–6.12. `window` event `pos:sale-completed` lets the top bar refresh; while a sale is being saved the idle lock is suppressed (`utils/appEvents.js whileSaving()`).
- The POS reports "busy" to the main process (`useEntryBusy`) in every stage except idle/confirm so an app update is refused mid-bill (§10).

### 7.3 Home (Admin) — `pages/Dashboard/Overview.jsx` (+ `parts/`)
Greeting, Getting Started card (until set up), four StatTiles: **Sales Today** (net of today's returns; footnote "{n} sales · {amount} returned"), **Customers Owe You** (sum of positive balances from `balanceEngine` — equals Accounts Overview), **Running Low**, **Expenses This Month**; Sales chart (`dashboard:get-revenue-trend`, 7/30/90 days, net per local day, bar click → Sales Report for that day); Recent Sales; Needs Attention (from `layout/useAlerts.js`, shared with the top-bar bell: Running Low, Not Selling, Overdue (90+ days), Items added at the counter (needs review), Stock to recount, **Update available — version X**); Quick Actions; Signed-in sessions. `dashboard:get-summary` also returns `todayGrossSales, todayReturns, todayReturnsCount, totalProducts, deadStockCount, totalCustomers, recentSales`.
Also: `BackupNotice` (failed automatic backup; weekly "Copy a backup to a USB drive" with the folder and a Done button), a one-time toast "Updated to version X" after an update (`updates:consume-updated-notice`), Getting Started card for a brand-new shop, and a Signed-in sessions card.

### 7.4 Products & Stock

- **All Products** (`ProductList` + `list/`): filters/sort/counts in SQL (`products:list`), status badges from `getProductStockStatus` (out of stock / Running Low / Not Selling — a product can be low and dead at once), bulk bar (activate/deactivate, move category). Rows show brand · item code. **There is no expanding detail panel any more:** clicking a row (List / Compact / Cards) navigates to `/products/profile` (`actions.open`); the select box and Active switch stop the click. Low Stock / Not Selling rows, Ctrl+K product results and the cashiers' Products list open the same profile.
- **Product Profile** (`/products/profile`, params `{ id }`; `pages/Products/ProductProfile.jsx`; a page of the Products section, also routed in `CashierRoutes` under `view_products`). Inventory layout, deliberately unlike the ledger-style party profiles: header (name, brand · code, category · supplier, status badges) with **Edit / Delete Stock / Add Stock** buttons (Admin only); left column = big stock number + health bar vs `min_stock_alert` + per-Type stock, and a Sales card (last 30 days, total sold, sales value, Admin-only estimated profit at today's cost, last sold / last stocked); right = **Pricing grid** (every pack size × Retail, Wholesale, Buying (Admin), Price Level 1–5 net rates; Trade Price packs get a tag and, for Admin, a trade-price/discounts line), Recent stock changes (last 8 movements; "Full history" → `/stock/history`, Admin), notes. Data: `products:get-by-id` + `stock:get-product-stats` (category/supplier names, status flags from `getProductStockStatus`, sales figures from `sale_items`) + `stock:get-movements`. Add/Delete Stock open the focused **modal** (§6.16). Product edit returns to the profile on save/cancel.
- **Product form** (`ProductForm.jsx` + `form/`). **It opens with a kind toggle** — *Simple Product* | *Product with Types* (`kind` state, `KindAndNameSection`) — and the Name field directly under it. Section order: **Simple** → Name → Barcode & stock (`SimpleStockSection`: one barcode + starting stock; shows "In stock" read-only when editing) → Details (brand, category, supplier, item code) → Stock alerts → Pack sizes → Special prices → More options. **Types** → Name → **Types card** (`TypesSection`, always open, no collapsing: each row = Type name, barcode with live uniqueness check, starting stock; "Add another Type"; at least one Type, every Type needs a name) → Details → Stock alerts → Pack sizes (pricing) → Special prices → More options. All type interfaces are hidden for Simple. Switching the toggle moves the barcode / starting stock between the single-item fields and the first Type so nothing typed is lost; saved Types can't be turned back into a simple product (a toast says so). A Simple product still stores one hidden "Standard" variant (payload `variants: []` + `standardBarcode/standardStartingStock`). **The Agency item option is gone** (UI, payload and the update SQL; legacy column untouched). The old in-form "Fix Stock Count" links are gone too — stock is changed from the Stock module. Pack sizes (units with conversion factor + Simple or Trade Price pricing), Special prices (C1–C5 net rates, or C1–C5 discount % for Trade Price units; blank = no override), More options (notes, active — edit only). Editing never changes stock; removed variants/units are soft-deleted. SKU/barcode uniqueness checked live.
- **Trade Price pricing (per pack size).** Each pack size card has a Simple | Trade Price segmented control (`pricing_method`). *Simple* = the manual fields above. *Trade Price* hides Buying/Retail/Wholesale and shows Trade price, Purchase discount % and Extra discount (amount) in the card, and five Sale discount % boxes in the Special prices table (replacing the C1–C5 net-rate boxes; the computed net rate shows under each). `ProductForm.jsx` `withTradePrices()` runs on every unit edit and **overwrites the standard fields**: `cost_price = trade − trade×purchase% − extra` (min 0), `retail_price = wholesale_price = trade`, `net_rate_cN = trade − trade×saleDiscountCN%` (blank discount → NULL, no override). Those derived values are what is saved, so `priceEngine`, POS, reports and purchases are unchanged and never read the trade columns. `products:create/update` persist the trade fields via `tradeFields()` (non-trade units store `'simple'` and NULL trade columns). Bulk import always creates Simple units. Switching to Trade seeds Trade price from the current retail price.
- **Urdu name + dual-language search.** The product form's Name row has an **Auto Urdu Name** button (`form/BasicsSection.jsx`, handler `autoUrduName` in `ProductForm.jsx`) and a second field, *Search spelling (English)*, bound to `products.search_alias`. Clicking the button sends the typed Roman/English name to `products:transliterate-urdu` (`window.api.products.transliterateUrdu({ text })`), then moves the typed text into the alias field and puts the returned Urdu script in Name. Both fields stay editable. The handler runs in the **main process** using Electron `net.fetch` (6 s timeout, no CORS/CSP issues, no API key): first **Google Translate's free endpoint** (`translate.googleapis.com/translate_a/single?client=gtx&sl=ur&tl=ur`, unofficial, no key; source language is set to Urdu so Roman-Urdu input is read as Urdu, matching how the owner uses translate.google.com), then a second Google Translate endpoint (`clients5.google.com/translate_a/t`), and only then **Google Input Tools** (`inputtools.google.com/request?itc=ur-t-i0-und`, phonetic Roman→Urdu, e.g. "qalam" → "قلم"). The result carries `source` (`google-translate` | `phonetic`); the form toasts a warning when the phonetic fallback was used, because Google rate-limits/blocks these unofficial endpoints intermittently (HTML 'Sorry…' page instead of JSON). It needs internet only for this button; offline it returns a plain-words error and the user types the Urdu by hand. Names already in Urdu script are rejected. `products:create/update` read/save `searchAlias` (trimmed, blank → NULL; `update` keeps the stored alias when a caller omits it). **Searches match `p.name` OR `p.search_alias`** in `products:list` (All Products, counts), `sales:search-products` / `sales:search-products-grouped` (POS and quick bill item search), `stock:get-movements`, and the global Ctrl+K search (`global.ipc.js`). **Word suggestions:** the handler also returns `words` (per-word alternative spellings from Google Input Tools, up to 8 each); `form/UrduSuggestions.jsx` shows them as tappable chips under the Name / Type name so a wrongly guessed word (e.g. "mutalia" → متلا vs مطالعہ) can be swapped in one click. Chips hide once the name's word count changes. **Types get the same treatment:** each Type row in `TypesSection` has its own Auto Urdu Name button and a Search spelling field (`product_variants.search_alias`, saved via `variants[].searchAlias`; `update` keeps the stored alias if a caller omits it); POS/quick-bill and Ctrl+K search also match it. Bulk import does not set an alias.
- **Import spreadsheet** (`BulkImport` + `import/`): CSV, one row per product×type×pack size, grouped client-side; categories must already exist; all-or-nothing preview; `products:bulk-import` runs every product through the same `create()` in one transaction.
- **Running Low / Not Selling** and the Stock Report all use `db/models/Product.js` (`total_stock ≤ min_stock_alert`; days since last sale (or creation) ≥ `dead_stock_days`).
- **Categories:** one-level parent/child, unique names, delete blocked while products use it; only direct self-parenting is prevented.
- **Purchases** (Admin, logic in §6.13): created from the quick purchase form (§6.15): supplier + lines (product/type/pack size/qty/**free qty**/cost, cost editable) + bill-level discount (% or amount) + amount paid now/method. The quick form no longer has a supplier bill number field (it sends no `referenceNo`; the column and `purchases:create` param remain for old data, and Purchase History still searches/sorts it). **Trade Price lines:** see §6.15. One transaction in `purchases:create`: `purchases` (subtotal, `discount_amount`, `total_amount` = subtotal − discount, `paid_amount` capped at the total) + `purchase_items` (`foc_quantity`), stock += (qty + free) × conversion factor, `last_purchased_at`, `stock_movements('purchase')`, and — when paid > 0 — a linked supplier `payments` row (note "Paid with purchase …"). Supplier balance needs no extra step (`total_amount` − payments). Permanent (no edit/delete); does **not** update the product's stored cost price. **Purchase History** (`/products/purchases`, `pages/Purchases/PurchaseHistory.jsx`, `purchases:list` / `purchases:get-detail`, Admin enforced server-side): search (supplier / phone / bill number), date range (default this year), All / Paid / Still owed chips, sort by date / total / still owed / supplier / bill number (+ direction), summary strip, detail sheet, "Show more" (200 cap) and a **New Purchase** button. **Purchase receipts (A4):** the detail sheet has a **Print A4** button, and a freshly saved purchase opens the same preview automatically (see §6.11).
- **Fix Stock Count / Stock History are no longer on the Products section** (tabs, routes and `StockAdjustment.jsx` removed). Adjusting stock = Stock module Add/Delete Stock; history = Stock → History (§6.16). The `stock:adjust` IPC remains. The Connected Computers negative-stock "Fix" button now opens `/stock`.

- **Needs review** (`Products/NeedsReview.jsx`): list of counter-added items (selling price, buying price, sold, in stock) with Edit / Merge (product search + pack size) / Approve (§6.9). **Stock → To recount** (`Stock/StockRecount.jsx`): open "sold without stock" entries + every Type below zero with **Mark counted**.

### 7.5 Customers & Suppliers

Admin-only. **Starting balance (both create forms):** `Parties/StartingBalanceField.jsx` now asks whether the amount is **Owed** (customer owes you / you owe the supplier) or an **Advance** (they paid you / you paid them) with a segmented control, and takes a plain positive amount; an advance is stored as a negative `opening_balance` (the sign convention the ledgers already use). Edit forms still show it read-only. Customers: retail/wholesale, Price Level (tier C1–C5 or none; shown as "Price Level 1–5" via `utils/priceLevel.js`), letterhead (wholesale), phone + mobile + email, address, credit limit (**warning only**, Rule 2; 0 = none) + joined date, notes (form is SectionCards: Basics, Contact, Address, Pricing, Credit and History, Starting Balance, Notes, More options; list search, global search and Receive Payment search match phone or mobile; list/header show phone · mobile), starting balance (set at creation only — edit form shows it read-only), active flag, recent activity card. **Special Margins were removed** (page, tab, IPC `percentage-rules:*`, price-engine steps, glossary entry). Suppliers: name, contact person, phone + mobile + email, address, joined date, **letterhead** (dropdown, "Shop default letterhead" when none chosen → `suppliers.assigned_letterhead_id`; used for purchase receipts), notes, starting balance (creation only), active flag (form is SectionCards: Basics, Contact, Address, History, Starting Balance, Notes, More options; list search, global search and purchase supplier search match phone or mobile; list sub-text and profile header show phone · mobile). The customer form warns about a duplicate phone/mobile (Rule 7). Lists show derived balances (BalanceChip) and, like Products, have a **List / Cards / Compact** view toggle (`Parties/PartyViews.jsx`; choice remembered in `localStorage` `pos_customer_view_mode` / `pos_supplier_view_mode`). **Profile pages (`/customers/profile`, `/suppliers/profile`):** clicking a list row (table or cards), the Receive Payment return, a Purchase History supplier link etc. opens the profile — the edit form is no longer the click target. Both are one shared component, `Parties/PartyProfile.jsx` (`CustomerProfile` / `SupplierProfile` are thin wrappers): `PartyHeader` card (avatar, name, badges, contact line, balance chip) with a small pencil **Edit** icon button (→ `/customers/edit` / `/suppliers/edit`), **Payment** and a primary **New Sale** / **New Purchase**; a stat row computed client-side from `*:get-ledger` (customer: total sales, payments received, average bill, last sale; supplier: total purchased, payments made, average purchase, last purchase); `RecentActivityCard` (newest 5 ledger rows, "See full account" → `/ledgers/customers|suppliers`) beside a Details card (phone, mobile, email, address, tier / credit limit / joined, starting balance, notes). The edit forms no longer carry the header or the billing overlays and return to the profile on save/cancel. Header detail: the header has **Payment** (secondary) and a primary blue **New Sale** (customer) / **New Purchase** (supplier); there is no Open Account button. Both open overlays right on the profile (§6.15) and refresh the header balance when they save. No active/inactive "Show" filter on either list (see §8).

**Next-ID fetching & Stay on page (create forms).** `customers:get-next-id` / `suppliers:get-next-id` (`window.api.customers|suppliers.getNextId()`) return `{ success, id }` using `main/db/nextId.js` `getNextId(db, table)` = `max(sqlite_sequence.seq, MAX(id)) + 1` (whitelisted to those two tables; the id is a preview — another PC syncing in could take it). Both forms show it as a read-only **ID** row (`PartyParts.IdRow`) above Name; in edit mode it shows the existing id. Create forms add a **Stay on page** checkbox (`StayOnPageCheck`, passed to `StickyActions` via its `extra` slot): when ticked, a successful save clears every field, re-fetches the next id, refocuses Name and does not call `onDone`.

### 7.6 Sales History and Returns

`sales:list` / `sales:get-detail` (`ipc/salesHistory.ipc.js`): Admin sees all; a cashier needs `view_sales_history` and is locked to their own sales server-side. Filters: local-day date range (`date(created_at,'localtime')`), payment status, sale type, cashier (admin), search; **sort** by date / total / unpaid amount / customer / invoice number with a direction toggle (`sortBy`, `sortDir`, whitelisted server-side); max 200 rows. The toolbar's **New Sale** button (`make_sale`) opens the quick sale overlay (§6.15) and the list reloads when a sale is saved. Each sale carries returned amount and return status (none/partial/full). A voided bill shows a red **Voided** badge, "Voided {date} by {user} — counts as zero", no Return button; list sums exclude voided bills (+ a voided count). Detail sheet shows lines, payment, current customer balance, reprint (receipt/A4), and (Admin) "Return items".

**Returns** (`Sales/Returns.jsx`, Admin): a returns list + detail sheet, and a 3-step flow — **1 Find sale** (search by bill number, item name/barcode, customer, date or range; a **Return without the bill** button also on the list), **2 Items** (quantities, reason, restock), **3 Refund** (cash vs account credit with the cash cap), then a success sheet ("Exchanging? Ring up what the customer takes as a New Sale"). The no-bill dialog (`NoBillReturnDialog`) shows the computed refund price before saving. Math: §6.6.

### 7.7 Ledgers (Admin)

- **Ledgers section** (Admin; renamed from Accounts — `glossary.accounts` now reads "Ledgers"). **Hierarchical navigation, no section tabs** (the `ledgers` section in `navConfig.js` has `tabs: []`; every sub-route is a `pages` entry, so the top bar shows "‹ Ledgers"):
  - **`/ledgers` — landing** (`Ledgers/LedgersHome.jsx`): two large visual cards, **Customers** → `/ledgers/customers` and **Suppliers** → `/ledgers/suppliers`, and a smaller **More** card → `/ledgers/more`. `LedgerTile` (exported from `LedgersHome.jsx`, `size` large|small, `tone` = a theme colour family) is the shared tile with hover lift/shadow/border/icon-fill states via `useInteraction`. The old Overview page (`Ledgers/Overview.jsx` + `parts/OverviewParts.jsx`) is no longer routed.
  - **`/ledgers/customers`, `/ledgers/suppliers`** — Customer Accounts & Supplier Accounts (**a full account list first** — `Ledgers/parts/AccountList.jsx`: every customer/supplier with balance, search by name/phone, filter chips All / Owe you (You owe) / Paid in advance / Settled, sort by name / balance / phone with a direction toggle, a count + total-owed line). The list has the same **List / Cards / Compact view toggle** as the main Customers/Suppliers lists (`Parties/PartyViews.jsx`: `PartyViewToggle`, `PartyCards`, `usePartyViewMode`; remembered in `localStorage` `pos_customer_account_view_mode` / `pos_supplier_account_view_mode`, separate from the entity lists; Cards omit the Active switch because `PartyCards` only renders it when `onToggleActive` is passed). Click a row for the account view with the transaction timeline incl. sales, payments, purchases, corrections, returns; inline receive/pay. `AccountView` shows a breadcrumb/back bar (`Ledgers/parts/LedgerNav.jsx` `LedgerBackBar`): list → "Back to Ledgers"; account → Ledgers › Customer/Supplier Accounts › name.
  - **`/ledgers/more`** (`Ledgers/LedgersMore.jsx`): four tiles for the secondary pages — **Payments** `/ledgers/payments` (combined history with reprint), **Paid in Advance** `/ledgers/advances` (parties in credit), **Overdue Payments** `/ledgers/aging` (customer aging 0–30/31–60/61–90/90+ — an approximation: ages each sale's `balance_due` independently, no FIFO reallocation; customers only), **Balance Corrections** `/ledgers/adjustments` (`ledgers:create-adjustment`, Admin-only server-side, reason required). The More page has a back bar to Ledgers; each of the four pages is wrapped (`MoreSubPage` in `AdminDashboard.jsx`) with a Ledgers › More breadcrumb.
- **Receive Payment** (`/payments/record`, `record_payment` permission). **Admin flow is now in place:** the customer/supplier profile's **Payment** button opens `QuickPaymentModal` on the profile itself (§6.15) — no navigation. `RecordPayment` is kept for cashiers (no Customers access): they reach it from their header Menu and keep the picker + success sheet. (It still returns to the customer profile when given `onNavigate`, but nothing passes it any more.) Backend handlers unchanged. Form details: customer search (`customers:search-minimal`), amount/method/note, overpayment allowed after a confirm dialog ("This is more than they owe"), print receipt thermal or A4. **Pay Supplier** (`payments:create-supplier-payment`) is Admin-only server-side, from the supplier account.
- **Deleting a payment** (`payments:delete { paymentId, requestingUserId }`, Admin-only server-side; renderer helper `utils/useDeletePayment.js` asks to confirm first). Works on any `payments` row — customer or supplier, standalone, sale-linked or recorded with a purchase. Because balances are derived, removing the row reverses the ledger; the handler also puts back the bill snapshot figures in one transaction: a sale-linked payment lowers `sales.paid_amount` (and recomputes `balance_due` / `payment_status`), a supplier payment noted "Paid with purchase…" lowers the matching purchase's `paid_amount` (matched by supplier + amount + closest time, since the link isn't stored). The delete syncs (payments are deletable). Trash buttons appear in the **Payments log** (`/ledgers/payments`), the **account timelines** (customer/supplier Accounts) and the **Recent activity** card on customer/supplier profiles; ledger rows carry `paymentId` for this. "Owed amount" corrections are balance adjustments, not payments, and are not deletable here.

### 7.8 Reports (Admin; Sales report also for `view_reports`)

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

### 7.9 Expenses
List (`ExpenseList`, the day-to-day log, filters, Repeats badge) and form (`ExpenseForm`; recurrence locked after creation; "Stop repeating"). Logic: §6.14.

### 7.10 Cashiers and Settings (Admin)

- **Cashiers** (`CashierList`): search, sort (+ direction), DataTable rows (Avatar + name, username, "{n} permissions" badge with a tooltip — counts fetched per cashier via `permissions:get-for-user`, status badge), per-row Reset Password (`parts/ResetPasswordModal.jsx`, shared with the profile) and an active switch (deactivating asks first). Row opens `/cashiers/edit`.
- **Add/Edit Cashier** (`CashierForm`): Account card (full name; username + password/confirm on create, username read-only on edit, live uniqueness check on blur), "What this cashier can do" card rendering every `permissions:get-definitions` entry in catalog order (booleans → switch, `max_discount_percentage` → % box, blank = shop default). Plain-words titles/subtitles per key live in `parts/CashierFormParts.jsx` (`PERMISSION_COPY`, falls back to the catalog text). Edit header: Reset Password + Activate/Deactivate (acts immediately via `users:set-active`; save still sends `setActive` as before). Sticky save bar; field errors focus the first problem field.
- **Session Activity** (`CashierSessions` → `SessionDetail`): search, cashier filter (`sessions:list` `cashierId`), sort; columns signed in / signed out ("Still signed in" badge) / duration / activity count. Detail = header + vertical timeline; action names mapped to plain words (`login` Signed in, `logout` Signed out, `sale_created` Made a sale; unknown names title-cased). No date-range filter and no computer column (the data has neither).
- **Approvals** (`Users/ApprovalsLog.jsx`, Cashiers → Approvals): every Admin approval given on a cashier screen — what, bill, cashier, admin, when.
- **Settings tabs (7):** **Preferences** (Shop: currency symbol · Products: default low-stock warning · Sales: shop default discount cap · Security: lock the screen after inactivity, minutes, default 15, 0 = never; one sticky Save), **Receipt Header & Footer** (form + live receipt-slip preview at the saved paper width), **Letterheads** (card grid; "Upload a letterhead (PDF)" then an add sheet with name/PDF preview/margins/default; Edit, Set as Default, Delete with confirm), **Printers** (receipt printer + paper width + Save + "Print a test page" (uses the *saved* printer); A4 uses the Windows print dialog), **Connected Computers** (Connection Code with copy, this computer + Sync now, negative-stock warnings, version-pause banner, peer list with per-peer Sync now and the pause line, sync history; refreshes every 5 s), **Backup & Restore** (create backup; Automatic backup card: folder, last backup, failure, Change folder, Back up now; restore asks first then opens the picker; red Danger Zone "Erase Everything & Start Over" with type-RESET), **Updates** (§10.2).

### 7.11 Global search and top bar

`global:search` (products by name/SKU/barcode, customers and suppliers by name/phone, with balances) feeds `SearchPalette` (Ctrl+K), which also lists every visible page/tab. Top bar: back button + title, **live clock** (`HeaderClock`, time with seconds + date, ticks every second), search trigger, **Lock** button, sync chip, alerts bell, quick add. The cashier header has the clock, Lock, sync chip and user chip. **Alerts badge freshness:** `useAlerts` refreshes every 60 s, after each sale, and on the window event `pos:stock-changed` (`utils/appEvents.js`); `preload.js`'s `invoke()` wrapper fires that event after any stock/product-changing IPC (`products:create|update|set-active|bulk-set-active|bulk-import`, `stock:adjust|add|remove`, `purchases:create`, `sales:create|update|void`, `returns:create`), so the Running Low count updates the moment stock is added. Add new stock-affecting channels to `STOCK_CHANNELS` there.

### 7.12 In-place billing overlays — `components/billing/`

Sales, purchases and payments for one customer/supplier no longer take the user to another route. Three reusable pieces, all inline-styled from theme tokens:
- **`QuickSaleOverlay`** (`{ open, customerId?, onSaved, onClose }`) and **`QuickPurchaseOverlay`** (`{ open, supplierId?, onSaved, onClose }`) are thin wrappers (they mount fresh each time `open` flips) around one shared **`QuickBillForm`** (`kind: 'sale' | 'purchase'`), shown in `BillOverlay` (a portal, z-index 900; Esc / X asks to discard when items were added). With an id the bill is **locked** to that party (profile pages); without one it is chosen inside (history pages: sale defaults to Walk-in with a "Choose a customer" button, purchase requires a supplier first).
- Both kinds have **the same layout**: left = party card → item search (`BillItemSearch`: name / item code / barcode, ↑↓ + Enter, an exact scanned barcode adds straight away; adding the same item + pack size again bumps its quantity; a product with several Types opens the **bulk Type entry** modal instead — `MultiTypeQtyPanel` in a `Modal`, quantity per Type, blank = 0, Enter/"Add" adds every Type with a quantity as separate lines, sale shows per-Type stock, purchase does not) → items table (`BillLines`: pack size, qty, **Free (FOC)**, price, line total, remove; stock warning per line for sales); right = `BillSummary` (party, previous → new balance, discount % or amount, items / subtotal / discount / free units / **live total**, amount received (cash only, Rule 9), then the kind-specific rows). **Ctrl+Enter** saves. Totals come from `billingUtils.computeTotals` for both.
- **Sale specifics:** prices via `sales:resolve-price` (re-resolved when the customer or pack size changes), buying price + margin visible to Admin, sold + free stock check across all lines of an item, discount cap (permission value → settings cap; re-fetched right before saving), walk-in can't leave a balance, receipt format (Small receipt / A4 invoice, default from customer type), "Show outstanding balance on the receipt" (smart default), letterhead resolved like POS. Saves through `sales:create`, fires `pos:sale-completed`, then opens the **Print Preview** (§6.11) exactly as the POS does and shows the same `SaleCompleteSheet` ("Not printed" + Print `R`, Enter/Esc; button reads "Done") before the overlay closes. Not carried over from the full POS: held bills, draft autosave, today's-bills edit/void (those stay on `/pos`).
- **Purchase specifics:** supplier (no bill-number field), per-line buying price, free units, discount, amount paid now; confirm dialog (purchases are permanent) then `purchases:create` (§6.4); toast and close, no print.
- **`QuickPaymentModal`** (also used by the Ledgers account pages `CustomerLedger` / `SupplierLedger`, so the Owed/Advance toggle is identical everywhere) (`{ open, party: 'customer' | 'supplier', partyId, partyName, balance, onClose, onSaved }`) replaces navigating to the ledger/payment pages. The first control picks **Owed amount** (the party has to give us / we have to give the supplier this much more: **adds** to what is owed, saved as a balance correction via `ledgers:create-adjustment` with reason "Owed amount", no money moves, no method, no receipt) or **Advance payment** (money handed over now — the customer gave us / we gave the supplier: **reduces** what is owed or leaves credit, saved through `payments:create-standalone` / `payments:create-supplier-payment`, note prefixed "Advance payment"). Account timelines / Recent activity show these by direction, not "Payment"/"Correction": ledger rows carry a `label` — customer payment (and advance) **Received**, supplier payment **Paid**; an "Owed amount" entry is **Paid** on a customer (they owe us more) and **Received** on a supplier (we owe them more); set in `customers/suppliers.ipc.js` and `ledger/adjustmentRows.js` (detected by the reason starting with "Owed amount"); other corrections still read "Correction". Both options always show (cash only); amount / note with a live "after" balance preview. On save it calls `onSaved` (the page reloads its balance), closes, and an advance shows the usual `PaymentDoneSheet`. Keep it mounted and drive it with `open` so that sheet can outlive the form.
- **Dynamic purchase lines (Trade Price).** `sales:get-variant-for-cart` and `sales:search-items` units now carry `pricingMethod, tradePrice, purchaseDiscount, extraDiscount` (from `product_units`, §3). When a purchase line's pack size is `trade`, `BillLines` replaces the flat Buying price box with a read-only unit cost plus a row of three inputs — **Trade price**, **Purchase discount %**, **Extra discount** (flat) — prefilled from the pack size. `billingUtils.tradeUnitCost()` computes `trade − trade×pct/100 − extra` (min 0, 2 dp) and `QuickBillForm.updateField` recomputes the line's `unitPrice` on every edit; changing pack size re-initialises the fields via `purchasePriceFields()` (simple units fall back to the flat editable cost). Only the final `unitCost` is sent to `purchases:create` — the trade inputs are not stored on the purchase.
- Wired in: `PartyProfile` (customer: New Sale + Payment; supplier: New Purchase + Payment — they used to live in `CustomerForm` / `SupplierForm`), `SalesHistory` (New Sale), `PurchaseHistory` (New Purchase). `onSaved` on each reloads the page's own data.

- Quick bills also raise the same dialogs as the POS: credit-limit warning, large quantity/amount confirm, price-changed notice (Admin may type a price override in the price box, with the below-cost confirm), Admin approval box, Admin "Sell anyway?" for stock. `QuickBillForm`, `QuickAddItemDialog` and the return/no-bill dialogs report "busy" to block app updates while open (§10).

### 7.13 Stock module — `pages/Stock/`

Admin-only sidebar item placed right after **Products** (`navConfig` key `stock`, icon `appIcons.stock`). Tabs: **Stock** (`/stock`) and **History** (`/stock/history`).
- **Stock** (`StockList.jsx`): the Products list's table (`ProductTable` with `isAdmin={false}`, so no select box / Active switch), `StatusChips` (All / Running Low / Not Selling / Out of stock), search + category filter, active products only, via `products:list`. A row opens the Product Profile. The header's **Add Stock** and **Delete Stock** buttons open `StockEntryDialog` as the full sheet (`BillOverlay`).
- **History** (`StockHistory.jsx`): wraps `Products/MovementHistory` — **every** row of `stock_movements` (`stock:get-movements`, 500-row cap; filters: product, kind of change, dates, search). A `productId` param pre-filters it (Product Profile's "Full history"). New entries show as green **Stock added** / red **Stock removed** badges (`MoveBadge`).
- **Forms** — one component, `StockEntryForm.jsx`, two modes, wrapped by `StockEntryDialog.jsx`:
  - *Full form* (Stock page, no `productId`): `BillItemSearch` (name / code / barcode) adds any number of products; each row = product + Type, pack size, quantity, a "stock after" preview.
  - *Quick form* (Product Profile, `productId` given): a small `Modal` with one row per Type of that product only — no search, no other products.
  - **Add Stock** pricing follows each pack size's `pricing_method`: *Simple* → one Buying price box; *Trade Price* → Trade price, Purchase discount %, Extra discount with the computed unit cost (same `purchasePriceFields` / `tradeUnitCost` helpers as the purchase form). The "Save these buying prices on the products" checkbox (default on) writes them back to the pack size.
  - **Delete Stock**: quantity per row + a reason (Damaged, Expired, Lost, Recount, Other) + note; blocked client- and server-side when it would take a Type below zero (rows sharing a Type are summed).
- **IPC** (`stock.ipc.js`, preload `window.api.stock.*`): `stock:add` `{ lines:[{variantId, unitId, quantity, pricing}], note, createdBy, updatePrices }`, `stock:remove` `{ lines, reasonCode, note, createdBy }`, `stock:get-product-stats` `{ productId }`. Each submit is **one transaction**: for every line `product_variants.stock_qty` moves by `quantity × conversion_factor` (base units; Add also sets `last_purchased_at`) **and** a `stock_movements` row is inserted — `movement_type 'adjustment'`, `reference_type 'stock_in'` (+qty) / `'stock_out'` (−qty), note "Stock added: 5 × Box" / "Stock removed (Damaged): 2 × Pack" plus the typed note, `created_by` = signed-in user. Rows sync like any other movement. Price write-back (`applyPricing`): Simple → `cost_price`; Trade → `trade_price, purchase_discount, extra_discount, cost_price`, and if the trade price changed also `retail_price = wholesale_price = trade_price` and every set `net_rate_cN` recomputed from `sale_discount_cN` (as the product form does).
- Separate from **Purchases** (supplier bills, §6.4) and **Fix Stock Count** (single-item recount) — both still exist and write their own movement rows.

### 7.14 Lock screen and list-state memory

- **Lock screen** (`layout/LockScreen.jsx`; `LockProvider` wraps both dashboards in `Dashboard.jsx`). The **Lock** button in the header (or **Ctrl+L**) freezes the app behind a full-screen overlay (portal, z-index 5000) showing the signed-in user and a password box. **The app stays mounted underneath**, so a correct password resumes the exact page, cart, open dialogs and form values. The overlay swallows every keydown/keyup (the POS listens on `document`, so nothing leaks through) and pulls focus back to the password box. Checking is `users:verify-password { password }` for the window's own signed-in user (bcrypt compare; no session created, no `login` activity; same 5-tries / 5-minutes lockout as login). Wrong password shows an inline error and clears the box. The lock survives a reload: `localStorage['pos_locked_user']` (per window partition) holds the locked user's id (cleared on unlock, "Sign out instead", or a session-ended sign-out); the session token is untouched. **Idle auto-lock:** each window locks itself after `settings.auto_lock_minutes` (default 15, 0 = never) without mouse/keyboard input (`LockProvider`, checked every 15 s); never while a POS sale or quick bill/purchase is being saved (`utils/appEvents.js whileSaving()` / `isSaving()`). Preferences fires `pos:auto-lock-changed` after saving so open windows re-read the value.
- **Returning to a list restores place.** Two mechanisms: (1) **scroll** — `AdminDashboard`/`CashierLayout` `navigate()` remembers the scroll position of the page being left; if the user goes from a detail/form page back into the *same section* (admin) / any non-POS page (cashier) the content region is scrolled back to it (`utils/scrollRestore.js` retries until async data makes the page tall enough, and stops if the user scrolls). (2) **state** — `utils/useRememberedState(key, initial)` is a module-memory `useState` used for the search/filter/sort/range/chip fields of Products, Stock, Customers, Suppliers, Sales History, Purchase History and the Ledger account lists, so opening an item and coming back finds them as left (cleared only by an app restart). Product List's own older selection/scroll memory still applies.

### 7.15 Dev Panel (`components/DevPanel/*`, `DevPanelTrigger.jsx`, `ipc/devpanel.ipc.js`)
A near-invisible fixed icon at the **bottom-right of every screen** in both windows (keep ~64 px there free; pages use ~48 px bottom padding). **5 clicks within 3 s** opens a password prompt; a correct password unlocks the other `devpanel:*` reads for that window until it closes. The password is a bcrypt hash in `dev_panel_config` (per PC); migration 042 seeds a default on installs that have none; **Password tab** changes it (needs the current password, new ≥ 8 chars, same-as-current refused, failed attempts logged). Every unlock attempt goes to `dev_panel_access_log`. Tabs: **Audit Log**, **Database Browser** (paged table view + SELECT-only console: single statement, must start with SELECT, write keywords rejected anywhere, `stmt.reader` required, 1000-row cap), **Users & Sessions**, **System Info**, **Access Log**, **Password**. `password_hash` and session `token` are always masked. The panel has its own dev theme (`devPanelTheme.js`).


## 8. Printing

Covers: thermal and A4 printing, previews, payment/purchase receipts, report PDFs, stamps, the branding line and printer settings.

- All print paths build from `printing/receiptData.js` (sale + lines + customer + balance when `showDues`).
- **Grouped item rows (thermal, A4 PDF and A4 HTML fallback).** `receiptData.js` `groupReceiptItems(items)` (returned as `data.groups` by `buildReceiptData`; all print paths read `groups`, not `items`) collapses sale lines into one row per product + pack size + unit price. Row = product name; beneath it a sub-line of `TypeName-qty / TypeName-qty` (e.g. `Blc-4 / Blue-3`, Standard-only products get none); the Qty column shows the **summed** quantity and the Total is the summed `line_total`, so unit price × qty still equals the row total. Types print their stored names (no auto-abbreviation). Lines of one product with a different pack size or price stay separate rows. FOC is never printed (unchanged). On the A4 PDF a row with a sub-line is 11pt taller (pagination uses the per-row height).
- **Thermal font.** The thermal receipt view (`PrintReceipt.jsx`, which the preview PDF is rendered from) and its on-screen copies (`SaleCompleteSheet`, Settings → Receipt preview) use a plain sans-serif (`Arial, 'Segoe UI', Helvetica`) at 12px / 1.45 instead of Courier New. Print views stay raw black-on-white by design.
- **Thermal (retail):** `node-thermal-printer` ESC/POS, silent; printer name + 58/80 mm width in Settings → Printers (test print available). Header/footer are free text (`receipt_header_text/footer_text`, first header line bold). The dev-only receipt window (`receiptPreview.js`, "Export as Image") was removed — the Print Preview below replaces it in every build.
- **A4 (wholesale):** if the sale has a letterhead with a PDF on disk, `pdfInvoiceMerge.js` stamps the invoice onto the template as vector text (paginates, keeps totals together), writes it under `userData/receipts/`, prints via a visible OS dialog. **A4 invoices have no footer text** — the `receipt_footer_text` block (e.g. "Thanks for shopping from us") was removed from `pdfInvoiceMerge.js` and from the HTML fallback `PrintInvoice.jsx` because it overlapped the bill; the footer setting still applies to thermal receipts only; the confirm sheet embeds that PDF. No letterhead → HTML fallback (`printMode=invoice-fallback`). Missing PDF file → error asking to re-upload.
- **Print Preview — nothing prints automatically (sales).** `components/receipt/PrintPreviewModal.jsx` (kit `Modal`, inline styles + theme tokens). Props `saleId, printType ('wholesale-a4'|'retail-thermal'), showDues, onClose, onPrinted(res)`. Opened by: `Sale.jsx` and `QuickBillForm.jsx` right after `sales:create`/`sales:update` succeeds (they no longer call `printing:print-sale` themselves; the confirm sheet starts as `printSuccess: null` = "Not printed"), the confirm sheet's Print / `R`, and `SaleDetailSheet` reprint buttons. Both `Sale.jsx`'s key handler and `QuickBillForm`'s return early while the preview is open (the modal owns Esc).
  - **Flow:** modal calls `printing:preview-sale` → `printing/previewDocument.js` `previewSale()` returns `{ success, format, pdfBase64, … }` and the modal embeds it (`<embed type="application/pdf">` on a Blob URL). **A4** = the letterhead-merged invoice from `printA4Invoice.js` `buildInvoicePdf()` (shared with `printInvoice`), or, with no letterhead, the `invoice-fallback` HTML view printed to an A4 PDF. **Thermal** = the headless `PrintReceipt.jsx` view (shared `ThermalContent`, full page width) loaded in a hidden window sized to the 58/80 mm roll, height measured from the DOM, `printToPDF` with a custom page size — a single continuous page. Modal is 860 px wide for A4, 440 px for thermal. The preview is an approximation of the thermal ESC/POS output (same data via `receiptData.js`, different renderer).
  - **Buttons:** **Print** → `printing:print-sale` (thermal ESC/POS to the configured printer, or A4 via the OS print dialog). Success → toast, `onPrinted` (callers mark the sheet "Printed" and keep the A4 `pdfPath`), modal closes. Failure → inline error banner, modal stays open so they can retry or Save. **Save** → `printing:save-pdf` (`{pdfBase64, defaultName}`) → native Save dialog → writes the PDF (no dialog result = silently nothing). **Cancel** (also Esc / the ✕ / backdrop) → only closes the modal. The sale is committed before the preview opens and nothing in this flow voids, edits or deletes it; the sheet behind just keeps saying "Not printed" until Print is used.
  - **Purchase receipts (A4) use the same modal.** `PrintPreviewModal` also takes `purchaseId` (instead of `saleId`/`printType`): it calls `printing:preview-purchase` / `printing:print-purchase`, is always A4, and Save names the file `purchase-{no}`. Data comes from `printing/purchaseReceiptData.js` `buildPurchaseReceiptData()` (same shape as `buildReceiptData`, plus `labels` — PURCHASE RECEIPT / SUPPLIER / Purchase No / Entered by / Total Owed to Supplier — which `pdfInvoiceMerge.js` and `PrintInvoice.jsx` honour); supplier letterhead → shop default → the only letterhead → else the HTML fallback (`printMode=purchase-fallback`, `PrintInvoice` with a `purchaseId`). Purchase number = `reference_no` or `PUR-00042`. Qty shows `5 + 2 free`; the table has no pack-size column because purchases don't store the unit. Opened from the Purchase History detail sheet (**Print A4**) and automatically after `QuickBillForm` saves a purchase (the overlay closes when the preview closes).
  - **Not covered:** payment receipts (`printing:print-payment-receipt`, PrintChoice / QuickPaymentModal / Payment History) still print directly.
- **Payment receipts:** thermal or A4 (`printing:print-payment-receipt`).
- Receipts/invoices use `settings.currency_symbol` (default `Rs.`).
- **Report PDFs:** separate path, §6.8.
- **ARWAAT branding line (every print).** One fixed, hardcoded line — `Software by ARWAAT · 0319 2224504 · arwaat.com` — defined in `src/shared/branding.js` (renderer copy `PRINT_BRANDING_LINE` in `config/appInfo.js`); not a setting, not editable. Small, grey, centered, always at the bottom: thermal ESC/POS (`thermalReceipt.js printBrandingLine`: a rule, then the line in Font B — sale receipts, payment receipts and the Settings → Printers test page); `ThermalContent` (thermal preview / on-screen copies) after the footer; A4 letterhead PDFs (`pdfInvoiceMerge.js`, sales and purchase receipts): 7 pt grey, centered 6 mm above the bottom edge of **every** page, with the content bottom margin forced to at least 12 mm so nothing reaches it; HTML print views (`PrintInvoice` incl. purchase fallback, `PrintPaymentReceipt`, `PrintReport`) end with `pages/Print/PrintBranding.jsx`.
- **Hidden print windows** are all made by `windows.js` (`createHiddenRendererWindow` for ?print=1 views, `createPdfWindow` for printing a PDF file) and loaded with `loadRenderer(win, search)`.

- **Stamps (Rules 5 and 14):** `receiptData.buildReceiptData` returns `stampLines` (`*** VOIDED ***` + date for voided bills; `DUPLICATE COPY` + `Reprinted dd-mm-yyyy hh:mm` when a successful print is already recorded in `sale_prints`). Printed by `thermalReceipt.js` (centered, bold), `ThermalContent.jsx` (thermal preview/on-screen), `pdfInvoiceMerge.js` (A4 PDF, centered above the info box) and `PrintInvoice.jsx` (A4 fallback), and shown as a banner in `PrintPreviewModal`. A voided bill prints no outstanding balance.
- **Printer settings** (Settings → Printers, `settings` keys `thermal_printer_name`, `thermal_paper_width`): `printers:list-installed`, `printers:test-print`. 58 mm ≈ 32 chars/line, 80 mm = 42. A4 always goes through the OS print dialog. Printer off/unset: the sale stays saved, a clear message is shown, and the next print still counts as the original.
- **Files:** `printing/receiptData.js` (shared sale data, `groupReceiptItems`), `thermalReceipt.js` (ESC/POS via `node-thermal-printer`), `printA4Invoice.js` (`printInvoice`, `printPaymentReceipt`, `buildInvoicePdf`), `pdfInvoiceMerge.js` (pdf-lib letterhead stamping), `previewDocument.js` (`previewSale`, `previewPurchase`; thermal view loaded in a hidden window sized to the roll, measured height, `printToPDF`), `purchaseReceiptData.js`, `exportReportPdf.js`; renderer `pages/Print/*`, `components/receipt/PrintPreviewModal.jsx`, `ThermalContent.jsx`.


## 9. Sync

Covers: how PCs in the shop find each other, what travels, how conflicts and version differences are handled, and the known limits.

- **Roles:** one Admin PC (`station_code` `MAIN`) + any number of counter (Cashier) PCs (`C` + 4 hex). Every PC runs the same sync server, joins discovery and syncs in the background; Admin and Cashier alike.
- **Discovery** (`sync/discovery.js`): UDP broadcast on port **41234** every 5 s `{machineId (= settings.station_id), stationCode, role, tcpPort, appVersion, migration}`; peers unseen for 30 s show offline but are kept (`sync_peer_state`, seeded at boot). The packet carries no secret.
- **Transport** (`sync/syncServer.js`): Express on port **4000**. `POST /sync/exchange` requires header `x-sync-secret` = `station_config.sync_secret` (compared with `crypto.timingSafeEqual`; 401 otherwise); also `POST /setup/register-cashier` (same check) used by a counter PC's Setup. The secret is checked **before** the JSON body is parsed; body caps 25 MB (exchange) / 16 KB (register). **Wrong-secret throttle:** 10 wrong secrets from one IP within 10 minutes → that IP gets 429 for 15 minutes (both endpoints; not counted before this PC has a secret). Authenticated but **not encrypted** (an attacker on the WiFi could read traffic; letterhead PDFs are not copied).
- **Exchange** (`sync/syncEngine.js syncWithPeer`): one combined push-and-pull per peer: `buildOutgoingRecords` reads `sync_outbox` rows newer than the peer's watermark, deduped to the latest operation per (table, uuid), re-reads the live row and encodes it (`recordCodec.encodeRow`: local FK ids → uuids, `exclude` columns dropped). The reply's records are applied with `applyIncoming.applyRecords` in one transaction (unknown tables ignored; deletes only for `deletable` tables; `stock_movement` = dedup then delta to `stock_qty`; records whose references haven't arrived are deferred and retried until no progress). Per-peer watermarks (`last_synced_outbox_id`, `last_received_outbox_id`) advance **only after a confirmed round trip**; they never move backwards. Results are logged in `sync_log`.
- **Rounds:** debounced 4 s after any IPC call that grew `sync_outbox` (`syncTrigger.js`), plus every 25 s against all known peers except self; manual "Sync now" (all peers or one) in Settings → Connected Computers; request timeout 10 s.
- **What travels:** see §4.3 (22 tables). Not synced: `settings`, `expenses`, `recurring_expenses`, `sessions`, `activity_log`, dev tables, `station_config`, held bills/drafts (localStorage), letterhead PDF files, category deletes.
- **Triggers:** every synced table's `uuid` and outbox rows come from SQL triggers (022 + 026 + 030 + 036 + 037), so app code never queues anything. Voids are UPDATEs (`is_voided`), so they sync as updates.
- **Joining a counter PC** (Setup → Cashier): needs the Admin's Connection Code (`sync:get-secret`), an Admin PC reachable by discovery within ~12 s; the counter PC POSTs `{fullName, username, passwordHash}` (hash computed locally; the password never crosses the network) to `/setup/register-cashier`; then `CashierInitialSync` blocks until the first successful sync brings the account down.
- **Conflicts:** single writer per record is assumed; last write wins for upserts. Concurrent oversells can drive `stock_qty` negative and are left visible (`sync:get-reconciliation-warnings`, Connected Computers → "Stock went below zero"). A return and a void of the same bill on two PCs at the same moment both sync and are left visible (D5). A voided sale's old `sale` movements keep pointing at a sale; if a peer had not yet received that sale, the stale movement may not apply cleanly on the peer (untested).
- **Version safety (`sync/versionGate.js`):** every discovery packet and every `/sync/exchange` request/response carries `appVersion` + the newest applied **migration number**. If the numbers differ (or a build announces none) the exchange is refused **both ways before any record is sent or applied**: the client skips a peer whose broadcast shows another migration (`pausedForVersion`), the server answers `409 {error:'version-mismatch', appVersion, migration}` without applying anything, and a reply that does not report a matching number is not applied. The outbox is untouched, so everything goes across once both computers match; the pause clears automatically (matching broadcast or successful exchange). Shown on Connected Computers (banner + per-computer line) and on the sync chip ("Paused", tooltip = message): **"Paused: <computer> is on version X, this computer is on version Y. Update both computers to the same version."** (an unknown/old peer reads "an older version"). Logged once per pause in `sync_log`; the chip only counts computers that are online. Counter PCs must therefore be updated by hand (§10).
- **Known sync limits:** unencrypted transport; no letterhead PDF copy; expenses/settings not synced; old PCs without the gate (pre-1.1.0) cannot be protected from the new server side's refusals but will themselves apply records from a new PC (only the new PC refuses); `sync:get-status` does not return `pendingCount` (the chip's "N change(s) waiting" text shows `undefined`).

---

## 10. Updates

Covers: the in-app updater, the pre-update backup, the recovery screen, the downgrade guard, token handling and the release steps.

### 10.1 Updater (`main/update/updater.js`, `ipc/updates.ipc.js`, `pages/Settings/Updates.jsx`)
- `electron-updater` with the GitHub provider for the **private** repo `arwaheed/arwaat-pos-system` (`OWNER`/`REPO` constants; `electron-builder.yml publish` has the same values with `releaseType: draft`), `autoDownload=false`, `autoInstallOnAppQuit=false`, `allowPrerelease=false`, `allowDowngrade=false`. **Installed (packaged) builds only**; dev shows "Updates only work in the installed app."
- State machine (`getState()`): `status` = `idle | checking | uptodate | available | downloading | downloaded | installing | error | dev`, plus `lastCheckAt`, `available {version, notes, sizeBytes}`, `progress`, `error {kind: offline|unreachable|download|failed, message}`. Quiet check 30 s after start and every 24 h (never downloads by itself). The UI polls `updates:get-state` every 0.7 s while downloading.
- `latest` is read from GitHub's `releases/latest` (published, non-draft, non-prerelease). Notes = the release body fetched with the token (plain text: HTML/Markdown stripped, ≤ 4000 chars); size from `latest.yml`.
- **Messages:** offline → "No internet connection. Connect this computer to the internet and try again."; 401/403/404 or no token → "Updates can't be reached. Contact ARWAAT: 0319 2224504."; **except** a 404 with a token that can read the repo (nothing published yet) → "You're up to date."; download failure → "The update didn't download. Check the internet connection and try again." (Try again); otherwise "Couldn't check for updates. Please try again in a moment."
- **UI** (Settings → Updates, Admin only; the Cashier window has no controls): current version, last checked, **Check for updates**, when available the version, release notes, size, **Update now** (download with progress → install; if install is refused the message and **Install now** stay). Home "Needs attention" shows "Update available — version X" (Admin window only: `updates:get-state` is refused for a cashier).
- **Install** (`installNow`): (1) refuse with **"Finish or hold the bill in the Cashier window first."** while any window reports it is entering a bill (`app:set-busy` ← `renderer/utils/useEntryBusy.js`; used by the POS (every stage but idle/saved, or saving), quick sale/purchase forms, quick-add dialog, return flow after the find step, no-bill return dialog; flags are cleared when a window closes); (2) full online backup to `userData/backups/pre-update/pre-update_<version-the-data-is-on>_<YYYY-MM-DD_HHmm>.db` (`preUpdateBackup.createPreUpdateBackup`: `db.backup` → read-only open → `integrity_check` = ok → core tables present; failure **stops** the update with "The update was stopped because a safety copy of your data could not be made…"; newest 5 kept; a copy also goes to the automatic-backup folder if set); (3) re-check busy, record the pending update (`pendingUpdate.writePending`: `{from,to,backupPath,at,windows}` in settings `pending_update` **and** `userData/pending-update.json`); (4) close all windows, stop sync/discovery/auto-backup, `wal_checkpoint(TRUNCATE)`, close the DB, `quitAndInstall(true, true)` (silent installer, relaunches). While installing, the last-window-closed handler does not quit. If the installer cannot take over within 30 s the app relaunches normally. The relaunch opens the Admin window; the Cashier window that was open is reopened after the update.
- **Counter PCs** are updated by running the installer by hand (no update UI there).

### 10.2 Start-up after an update (before any window — §3.2)
`PRAGMA integrity_check` (full while a pending record exists) → downgrade guard → migrations. Success → pending record cleared, one-time Home toast **"Updated to version X"** (`settings.updated_notice`, consumed by `updates:consume-updated-notice`), previously open windows reopened. If the new version did not actually install (record's `to` ≠ current version) the record is just cleared.

### 10.3 Recovery screen (`update/recovery.js`, `recoveryPreload.js`)
Shown **instead of** the app (only this window exists; no app IPC/sync/windows; channels `recovery:get-info|restore|close`, answered only for that window). Inline-styled `data:` page: integrity failure → "ARWAAT can't open the shop data safely." + "Nothing was changed. Do not enter new sales until this is fixed."; migration failure → **"The update couldn't finish. Your data is safe."**; newer data → **"This data was made by a newer version of ARWAAT. Install the latest version."**; plus the plain error line, **"Restore the backup from before the update"** (only when `pending-update.json` names an existing backup; validates it with a full integrity check, replaces `pos.db` keeping this PC's sync id, keeps the failed file as `pos.db.before-restore.bak`, relaunches so the steps are retried), **Close**, and "Contact ARWAAT: 0319 2224504". The migration engine (`db/connection.js`): each migration in its own transaction, recorded only on success; table-rebuild files that switch `PRAGMA foreign_keys` off or carry their own BEGIN/COMMIT run with those lines stripped and FKs off around the transaction (schema identical to the old runner); safety copy `VACUUM INTO …/backups/pre-migration/` before running migrations on existing data. **Downgrade guard:** any applied migration file newer than the newest this app knows → `newer`.

### 10.4 Token handling
`GH_UPDATE_TOKEN` (read-only, repo contents) is written at build time to `src/main/update/updateToken.generated.js` (git-ignored, included in the asar by the `src/main/**/*` glob) and passed to electron-updater (`setFeedURL({provider:'github', owner, repo, token})` — PrivateGitHubProvider) and to the release-notes request. `updateToken.js scrub()` removes the token (and anything shaped like a GitHub token) from every error/log text; it is never put in the database, the audit log, the Dev Panel, settings or the UI. `GH_TOKEN` (write) is used only by `electron-builder` on the dev PC. Residual risk: the read-only token is inside the installed app's asar (anyone with the install can extract it).

### 10.5 Release steps
See §2.5 (`npm run release` / `release:minor`, publish the draft by hand, install the first updater build manually, `scripts/consolidate-draft.js`, empty-repo note: a repo with no commit cannot tag/publish a release — it needs a `main` branch; a README commit was created on `arwaheed/arwaat-pos-system` for that reason).

---

## 11. Security

Covers: the guard, sessions and lockout, idle lock, CSP, Electron hardening and fuses, the Dev Panel, and what is logged or redacted.

- **IPC guard** (`security/ipcGuard.js`): origin check, public/signed-in/Admin/permission tiers, print-window allow-list, per-window identity — rules in §5.3. Handlers never trust a client user id (`withCallerId`).
- **Sessions/lockout:** 12 h sessions, 5 wrong passwords → 5 min lock per username (memory), Admin approval box and lock screen share the counter; deactivate/reset revokes sessions; passwords are bcrypt; the DB file itself is **not encrypted**.
- **Idle auto-lock** (`layout/LockScreen.jsx`, `settings.auto_lock_minutes`, default 15, 0 = never): the window freezes behind a full-screen overlay; the app stays mounted underneath; a right password resumes; never while a POS sale or quick bill is being saved; survives reload via `pos_locked_user`. Ctrl+L locks at once.
- **Electron hardening** (`windows.js`): every window `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `devTools` off when packaged (DevTools shortcuts blocked, `devtools-opened` closed). `app.on('web-contents-created')`: `setWindowOpenHandler → deny`, `will-navigate` blocked unless it is the app page, `<webview>` blocked. The preload only uses `contextBridge`/`ipcRenderer`.
- **Electron fuses** (`electron-builder.yml`): `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true` (so installed builds ignore `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect`; `--remote-debugging-port` still works, which the installed-exe test mode uses).
- **Content Security Policy** (`renderer/index.html`): `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self' data:`; `object-src`/`frame-src 'self' blob: file:` (PDF previews); `connect-src 'self'`; `base-uri 'self'`. `vite.config.js devCsp` (serve only) adds inline scripts and the dev server + websocket. The Urdu button fetches from the main process, so the renderer needs no external connect.
- **Dev Panel:** §7.15; per-PC bcrypt password; read-only except its own password; SELECT-only console; secrets masked.
- **Logged / redacted:** `dev_audit_log` stores every IPC call with args sanitised (keys matching `password|token|secret` → `[REDACTED]`, ≤ 2000 chars). Sync secret, update token, Dev Panel password and passwords are never written to logs or the audit trail; `sync:get-secret` is Admin-only; the update token is scrubbed from errors (§10.4); `dev_panel_access_log` records attempts without the typed password.
- **Network surface:** sync server (port 4000, secret-gated, throttled, unencrypted LAN), UDP discovery (no secret in the packet), Urdu-name Google endpoints, GitHub (updates). Nothing else.
- **Not covered (by design/limits):** no DB encryption; the read-only update token is extractable from the install; sync is plaintext on the LAN.


## 12. Design system

Covers: theme tokens, the component kit, icons, glossary, layout rules and the Design Gallery. (History: the app was restyled in a 13-phase iOS-style redesign layered on the working app — logic, IPC and the database were not rewritten; all 13 phases are DONE.)

**Design system rules (keep consistent):**
- **Styling:** inline `style={{}}` objects driven by `config/theme.js` only. No CSS files, Tailwind or CSS-in-JS (sole exception: `components/GlobalStyles.jsx` for keyframes, focus rings, placeholder/selection). **No raw hex/rgb in components.**
- **`theme.js`:** `colors` = iOS palette (`accent`, `green/red/orange/yellow/teal/indigo/purple/pink/gray/blue` each with `Tint` and `Text` variants, `bg`, `surface`, `surfaceAlt`, `fill`, `fillStrong`, `label`, `labelSecondary`, `labelTertiary`, `labelOnAccent`, `separator`, `separatorStrong`, `focusRing`…) plus legacy aliases (`primary`, `textPrimary`, `accentBlue`, `success`, …) so old pages still resolve; `spacing`, `radius`, `shadow`, `font` (Inter, `numeric` = tabular-nums), `type` (largeTitle…caption), `motion` (fast 120ms, base 180ms), `control` heights.
- **Kit** (`components/kit/*`, import from `components/ui.jsx`): Icon, IconTile, Button, IconButton, Field/Label/TextInput/NumberInput/TextArea/Select/SearchField (`FieldError` has `role="alert"`), PasswordInput, Toggle, Checkbox, SegmentedControl, Card, PageHeader (legacy), Banner, Badge, Kbd, ListSection/ListRow, Spinner, Skeleton, EmptyState, Toast (`useToast`), Modal, Confirm (`useConfirm`), Popover/Menu/MenuItem/MenuDivider/MenuHeader, Tr/tableStyles/DataTable, Disclosure, Stepper, ChipGroup, Avatar. Plus `BalanceChip` for balances.
- **`config/appIcons.js`:** one Lucide icon + color per concept (`<IconTile {...appIcons.products} />`). Lucide + Inter only — no SF Symbols / San Francisco.
- **`config/glossary.js`:** plain-words labels used everywhere (Home, New Sale, Receive Payment, Accounts, Running Low, Not Selling, Price Level, Payment, Fix Stock Count, Balance corrections…); `glossaryChanges` lists old→new terms.
- **Design Gallery:** Ctrl+Shift+G, dev builds only (`pages/Dev/DesignGallery.jsx`).
- Color meaning: blue action/selection, green money in/success/profit, red error/loss/overdue, orange warning, gray neutral — never color alone. Desktop density (body 14px, controls 34–36px, rows 44–56px). Animate only opacity/transform at 120–200ms. Pages don't render their own title or tab bar (the shell does).

- **Where:** `src/renderer/config/theme.js` (tokens), `config/appIcons.js`, `config/glossary.js` (+ `glossaryChanges`), `config/appInfo.js` (app identity and `PRINT_BRANDING_LINE`), `config/navConfig.js`; `components/ui.jsx` re-exports `components/kit/*` (Avatar, Button, ChipGroup, Disclosure, Feedback, Field, Icon, PasswordInput, Popover, Stepper, Surfaces, Table, Toggle, `useInteraction`). `components/GlobalStyles.jsx` is the only `<style>` (keyframes, focus rings, placeholder/selection).
- **Layout rules:** pages don't render their own title or tab bar (the shell does); keep ~64 px bottom-right free for the Dev Panel icon (pages use ~48 px bottom padding); money is right-aligned/tabular (`theme.font.numeric`); Lucide icons + Inter font only; no raw hex in components (exceptions: `pages/Print/*`, `components/receipt/ThermalContent.jsx`, Dev Panel).
- **Design Gallery:** `pages/Dev/DesignGallery.jsx`, Ctrl+Shift+G, dev builds only, lazy-loaded.


## 13. Decisions log

Covers: every owner decision and agent decision that explains why something is the way it is, including what was deliberately NOT built. Date = when recorded (git history starts 2026-08-30; the owner's Stage 1 list and the agent decisions below are 2026-10-30).

### 13.1 Owner's business decisions (the Stage 1 list, 2026-10-30; implemented as Rules R01–R17)
| # | Decision | Where |
|---|---|---|
| 1 | The server re-resolves every line price (price engine, per customer + pack size); a mismatch > 0.01 is refused unless the caller is the Admin (manual override Admin only); the server's price is stored | §6.2 |
| 2 | Credit limit = **warning only** (show the numbers, user can accept, never block) | §6.10 |
| 3 | Whole positive numbers only for every quantity (sale, FOC, return, purchase, stock add/remove/fix, quick-add); server enforces, inputs refuse decimals | §6.18 |
| 4 | Barcodes stay per product/Type (no per-pack-size barcodes); a scan adds 1 of the default pack size | §6.11 |
| 5 | Voids are kept (`is_voided`, `voided_at`, `voided_by`): stock restored, visible in Sales History with a red Voided badge, reprint says VOIDED, no edit/return, counts as **zero** everywhere; linked payments stop counting; invoice numbers never reused | §6.5 |
| 6 | Below-cost price = warning (product form + Admin price override), allowed after confirm; cashiers never sell below cost unless the Admin set that price | §6.10 |
| 7 | Duplicate customer phone/mobile = warning, allowed after confirm | §6.10 |
| 8 | **No exchange screen**: return + new sale | §6.6 |
| 9 | **Cash only** everywhere (POS, Receive Payment, Pay Supplier); the server records `cash`; old records keep their method; POS payment step "Amount received"/"Change"; credit for named customers stays | §6.7 |
| 10 | **No rounding** of totals | §6.18 |
| 11 | Quick-add a missing item at the POS (permission "Add missing items at the counter", default on for cashiers) with Admin "Needs review" (approve / merge); P&L and stock report flag "buying price missing" | §6.9 |
| 12 | **Admin approval box** on the cashier screen (Admin username+password, server-verified, lockout applies) for: discount above cap, selling more than stock (goes negative → "Stock to recount"), voiding/editing a bill older than 10 minutes; approvals log; cashier stays signed in | §6.8 |
| 13 | Cashier edits/voids: own bills only, within 10 minutes of saving; later only with Admin approval; Admin unrestricted (except bills with returns) | §6.5 |
| 14 | Reprints print "DUPLICATE COPY" + reprint date/time (thermal and A4); the first print after saving is the original | §6.16 |
| 15 | Wrong computer clock warning banner in both windows (earlier than newest saved sale, year < 2026 or > 2 years ahead); selling still allowed | §6.10 |
| 16 | Automatic daily backup (first start of the day + midnight), same safe method as manual, folder setting default Documents\ARWAAT Backups, keep 30 days, weekly "copy to USB" reminder, failure shown on Home | §6.15 |
| 17 | Returns step 1 also searches bills by item/barcode, customer, date; no-bill return (Admin only): lowest selling price in the last 30 days (else current retail), cash, stock back in, no sale link | §6.6 |
Counter anomalies to handle: draft recovery after crash, held bill on close, same item on two windows, price change while a bill is open, product/customer deactivated mid-sale, scanner spaces/newline/lowercase, barcode equals product name, exact amount via Enter, walk-in underpay blocked, qty > 100 or line > Rs 100,000 confirm, double Enter/click on Pay = one sale, printer off = sale saved + message, window switch mid-sale, sign-out with open cart holds it, two cashiers selling the last unit (§6.11).

### 13.2 Agent decisions made while implementing (2026-10-30)
| ID | Decision | Why |
|---|---|---|
| D1 (R1) | Editing a saved bill: a cashier may keep the bill's OWN stored price for a pack size (same customer only); any other price must match the engine; changing the customer re-prices | Old bills must stay editable after a price change |
| D2 (R1) | Admin manual price override lives in the quick Sale form's price box; the keyboard POS has none | Keeps the fast POS simple |
| D3 (R3) | Pack-size conversion factors are not counter quantities and stay as they are; old saved decimal quantities are left untouched | No data rewriting |
| D4 (R5) | Linked payments of a voided bill are MARKED voided (`payments.is_voided`) rather than excluded by a join; every sum/list filters `is_voided = 0`; voided bills hidden from Home recent sales and ledger timelines, visible (flagged) in Sales History and Today's bills | One simple consistent filter |
| D5 (R5) | A return against a voided bill cannot be created locally; if two PCs void and return the same bill at the same moment, sync keeps both (left visible) | Matches other sync conflicts |
| D6 (R6) | Buying-price write-back from Add Stock/purchases is not warned; percentage-over-cost pricing can never be below cost | Not in the rule's list |
| D7 (R11) | Key for "Add new item" is F7 (F6 = Return); quick-add is in the keyboard POS only; merge needs a target pack size with the same pieces per pack; purchase lines are moved on this PC only (insert-only in sync) | Free key; money unaffected |
| D8 (R11) | "Buying price missing" = needs review OR pack size buying price 0; such items are left out of stock value and their sales reported separately in P&L | No silent zero cost |
| D9 (R12) | An approval covers one save, is spent only when the save succeeds, is bound to the asking window and expires after 3 min; the Admin never needs the box; a cashier can never change another cashier's bill | Safety |
| D10 (R13) | The 10 minutes count from the bill's `created_at`; editing does not restart them; a clock set earlier than the bill counts as inside | Simple and predictable |
| D11 (R14) | "Original" = first SUCCESSFUL print; a preview never counts; payment and purchase receipts are not stamped | Rule is about bills |
| D12 (R17) | No-bill refund uses the lowest **discounted** unit price in the last 30 days; charged to the recording Admin in Cashier Performance | Never refund more than charged |
| D13 | Quantity > 100 or line > Rs 100,000 asks a confirm in the POS and on the server (`needsLargeConfirm`/`allowLargeQty`) | Typo guard |
| D14 | Sign-out/session end with a non-empty cart auto-holds it (`pos:before-logout`); `beforeunload` flushes the draft | Never lose a bill |
| D15 | Credit-limit dialog also shows "Over by: Rs X" | Clearer numbers |
| D16 (Stage 2) | `ARWAAT_TEST_MODE=1` (dev only) bypasses native file dialogs; DevTools not auto-opened in test mode | Reliable harness |
| D17 (updater) | A safety copy (`VACUUM INTO …/pre-migration`, newest 5) is taken whenever pending migrations meet existing data; if it fails the app still starts (each migration is transactional) | Protects a hand-installed upgrade |
| D18 (updater) | Pre-update backup file name uses the version the data is on ("from") | The file is a copy of that version's data |
| D19 (updater) | Recovery reads `userData/pending-update.json` (not only the settings row) | The DB may be unreadable and a restore removes the row |
| D20 (updater) | Restore from the recovery screen keeps this PC's sync station id (the backup is its own); the normal Settings restore still drops it | Avoids a "new machine" identity |
| D21 (updater) | 404 on "latest" with a token that can read the repo = "You're up to date" | Nothing published yet is not an error |
| D22 (updater) | Updates are Admin-only; counter PCs are updated by hand; version-paused sync tells the user so | Keeps the cashier window free of update controls |
| D23 (updater) | Silent install `quitAndInstall(true,true)`; windows open before are reopened after the update | Smooth shop update |
| D24 (release) | `npm run release` = patch, `release:minor` = minor (first updater release was 1.1.0); release is a DRAFT the owner publishes; release script consolidates duplicate drafts | Owner controls publishing |
| D25 (2026-10-30) | Dev Panel: default password hash seeded by migration 042 so installed PCs can open the panel; change-password tab added | A fresh install had no password at all |
| D26 (2026-10-30) | Repo `arwaheed/arwaat-pos-system` got a README commit so the draft release can be tagged/published (an empty repo cannot) | GitHub requires a commit to tag |

### 13.3 Deliberately NOT built (or removed)
- **Tax** (always 0; `sales.tax_amount` kept), **item-level discount** (bill discount only), **opening-cash / cash-in-hand screen**, **deleting customers/suppliers** (deactivate only), **more than one Admin**, **exchange screen** (Rule 8), **per-pack-size barcodes** (Rule 4; a Box cannot have its own barcode — MAS-13 closed), **payment methods other than cash for new payments** (Rule 9), **credit-limit blocking** (Rule 2), **encryption of the DB or of LAN sync**, **cloud/central server**, **licensing/activation** (removed in 035), **Special Margins** (removed), **Agency item option** (UI removed, legacy column), **Accounts → Ledgers overview page** (file kept, not routed), **per-PC settings sync**, **editing/deleting purchases**, **editing/deleting returns**, **hard-deleting sales**.
- Admin-only update UI (no update controls in the Cashier window) is intentional.

---

## 14. Known gaps and open problems

Covers: everything unresolved, untested areas and the manual-only checks.

### 14.1 Unfinished test stages (owner skipped them to save time/quota)
- **Stage 3 (full e2e chain) not run to completion:** `00-setup 01-data 02-login 03a-restore 03-shopday 03b-shopday-admin 03c-shopday-verify 04-checks 05-ops 06-concurrency-crash 07-stage1-ui 08-bombard-dates-load 09-screenshots-ui` — the full shop day with hand-checked numbers (A), bad-input sweep (O), concurrency (L), crash (M), bombard invariants, load targets in the UI (P), dates (N), security sweep for the newest channels (Q) were **never run in one clean pass**. Only `07-stage1-ui` (11/11) and `tests/rules` (139/139) are proven. Run them one at a time (`rm test-results/.run.lock`, never two UI scripts at once). An earlier Antigravity run recorded 109 PASS / 9 FAIL / 4 N/A / 1 NEEDS DECISION; its results file was overwritten — the open items then were LOAD-P01 (1-month report 20 s, since fixed: 18 ms in-process, not re-run through the UI), the Admin visual audit timing out on "Customer Name" (test or app: **unknown**), and the five Stage 1 UI checks (now passing).
- **Stage 4 (screenshots of every page/form/print at 1366×768, 1920×1080, 683×768 for both windows) not started;** `tests/e2e/09-screenshots-ui.js` exists but never ran successfully. `test-results/TEST_RESULTS.txt` was not generated.
- **Load DB:** Admin Home loads and every measured handler is fast (start 16 ms, summary 54 ms, aging 45 ms, 1-month Sales report 18 ms, 1-year 129 ms, P&L 328 ms, stock report 39 ms, POS search 10 ms), measured in-process on `test-backups/antigravity-load-db/pos.db` (10,011 products, 2,003 customers, 50,051 sales). Not measured: barcode add and sale save on that DB, UI rendering of the 10k-row product list (`products:list` returns all rows, no paging), report pages in the UI. The freeze root cause (aging N+1) is fixed (§15).

### 14.2 MANUAL checks (hardware/shop; cannot be automated)
1. **Real barcode scanner:** scan 10 items quickly in the POS → all 10 lines added, quantity 1 each, focus stays in the search box; scan an unknown code → F7 offers quick-add with the barcode pre-filled.
2. **Real thermal printer:** sell and print a receipt (58 mm and 80 mm): header/footer, grouped lines, totals, ARWAAT line at the bottom, cut; reprint from Sales History → "DUPLICATE COPY"; void a bill and reprint → "*** VOIDED ***"; unplug the printer → sale still saved with a clear message, later print is still the original.
3. **A4 printer + letterhead:** wholesale sale → preview → print on a letterhead PDF; check nothing overlaps the ARWAAT line.
4. **Power cut mid-sale:** pull the power during a POS sale → restart → "R resume" restores the draft; during save → the sale is complete or absent; `PRAGMA integrity_check` ok.
5. **Laptop sleep/resume** with a bill open and with the lock screen up.
6. **USB copy of the daily backup:** copy `Documents\ARWAAT Backups\arwaat-auto-<date>.db` to a USB drive, press Done on Home's reminder; restore it on another PC.
7. **Two real PCs on the shop WiFi:** join a counter PC with the Connection Code, sell on both, confirm sync both ways and the "Paused" message when versions differ.
8. **In-app update cycle (never run):** install version N by hand, publish N+1 (draft → Publish), Settings → Updates → Update now; confirm the pre-update file in `%APPDATA%\stationary-pos-app\backups\pre-update\`, the app returns on N+1 with both windows, Home says "Updated to version N+1"; also try Update now with a bill open in the Cashier window → refusal message; damage test: rename a migration to force a failure → recovery screen → Restore.
9. **Readability on the shop laptop**, ease of use for a non-technical person, and the go-live checklist in the shop.

### 14.3 Known small gaps and limits
- `sync:get-status` has no `pendingCount`, so the sync chip's "N change(s) waiting to send" tooltip shows `undefined` and "Waiting to connect" only reflects a failed last sync.
- Customer and Supplier lists have no active/inactive "Show" filter (a deactivated party disappears from the UI) — open on purpose (owner decision pending). Same for the Cashier list; sessions have no computer/date-range filter.
- Recurring expenses: list/detail responses do not carry the series' `active` flag (the UI works around it).
- P&L uses current cost prices; Overdue aging is a per-sale approximation, customers only; category cycles deeper than self-parenting are not checked.
- Sync is unencrypted and does not copy letterhead PDFs; expenses/settings/held bills do not sync.
- Held bills and POS drafts are per window partition (`localStorage`); upgrading from a pre-two-app build lost them.
- Lockout counters and per-window identities live in main's memory (reset on restart).
- A voided sale's old movements and a peer that never received the sale: untested sync case.
- Counter (cashier-only) PCs have no update UI.
- The read-only update token is extractable from the install (accepted risk); the DB is not encrypted.
- `components/StatTile.jsx` and `pages/Ledgers/Overview.jsx` are legacy/unrouted files.
- Pre-1.1.0 installs cannot be paused by the version gate from their side (only the new PC refuses).
- The 1.1.0 installer predates migration 042 (Dev Panel default password); it ships with the next release.
- The Admin visual audit "waiting for Customer Name" timeout is unexplained (test vs app: unknown; look at `tests/e2e/09-screenshots-ui.js` and the customer form labels).

---

## 15. Bugs fixed history

Covers: one line each — date, commit, what was wrong, file(s). (Earlier phases fixed UI/logic issues without individual hashes; see the end of this section.)

| Date | Commit | What was wrong → fix | File |
|---|---|---|---|
| 2026-10-29 | f75c079 | Backup export left out recent data (WAL not copied; a backup had 2 of 11 products) → SQLite online backup | `ipc/backup.ipc.js` |
| 2026-10-29 | bd5e0ed | No `busy_timeout`; a briefly locked DB errored → 5000 ms | `db/connection.js` |
| 2026-10-30 | 4a7f181 | A barcode scan sent focus to the Quantity box; quick scans made a Rs 300.9M line → a scan adds 1 unit and keeps focus | `pages/POS/Sale.jsx` |
| 2026-10-30 | 3155ee1 | Server accepted negative discount, discount > bill, negative payment, zero/NaN quantity, wrong line totals, and did not enforce the cashier discount cap → validated in main | `ipc/sales.ipc.js` |
| 2026-10-30 | 622ee8f | Back-to-back scans glued together → box emptied before lookup | `Sale.jsx` |
| 2026-10-30 | 0b436b4 | A voided bill's invoice number could be reissued → last issued number per day remembered | `sales.ipc.js` |
| 2026-10-30 | fb62c0f | Settings restore validated nothing (an empty/wrong file wiped the DB) → validated (tables + integrity) and old data kept as `.before-restore.bak` | `backup.ipc.js` |
| 2026-10-30 | 4bd57bd | Scanner Enter dropped when keystrokes outran the key listener → reads the barcode from the input | `Sale.jsx` |
| 2026-10-30 | 678c04a | POS rapid barcode input race, double-Enter duplicate sale, mid-bill price prompt | `Sale.jsx` |
| 2026-10-30 | 9f17c58 | Server accepted negative prices and fractional pack factors; Products search missed barcodes | `products.ipc.js` |
| 2026-10-30 | fc288c6 | Rule 11/12 alerts missing on Home Needs attention, P&L, Needs review list | Dashboard, reports, NeedsReview |
| 2026-10-30 | 72b211c | VOIDED / DUPLICATE COPY stamp lines not shown in the print preview | `PrintPreviewModal.jsx` |
| 2026-10-30 | 85c50ca | Sales Report date filtering did not use the `created_at` index | `reports.ipc.js` |
| 2026-10-30 | ba8a3b5 | **Admin freeze on the 50k-sale DB:** `ledgers:get-aging-report` ran one query per customer and SQLite scanned all sales through `idx_sales_voided_created` each time (~48 s of blocked main process, called by the Home alerts hook every 60 s) → one grouped query (45 ms); the index moved to migration 041 | `ledgers.ipc.js`, `041_perf_indexes.sql` |
| 2026-10-30 | 2411a45 | **Void bill button** in Today's bills passed the click event as the approval token → a mouse click failed (Enter worked) → `onVoid={() => doVoid()}`; credit-limit dialog shows "Over by" | `RecentBillsPanel.jsx`, `creditLimit.js` |
| 2026-10-30 | 2411a45 | e2e test problems (not app bugs): wrong key F8 vs F2, wrong button names, backdated bill not selected, stale held-bill count | `tests/e2e/07-stage1-ui.js` |
| 2026-10-30 | 8cbd623 | Update check showed "can't be reached" when nothing was published but the token worked → "up to date" | `update/updater.js` |
| 2026-10-30 | d6abb80 | `npm run release` split the commit message on Windows (unquoted args) | `scripts/release.js` |
| 2026-10-30 | 0977270 | electron-builder created two half-filled draft releases → consolidated automatically | `scripts/consolidate-draft.js` |
| 2026-10-30 | ec601b3 | Fresh installs had no Dev Panel password (panel unusable) → default seeded by migration 042 + change-password tab | `042_*.sql`, `devpanel.ipc.js` |
| 2026-10-31 | — | Cancel sale dialog button misalignment: fixed flex and container layout so "Keep working" and "Cancel sale" match in height and vertical baseline | `CancelSaleDialog.jsx` |
| 2026-10-31 | — | Cancel sale button right-edge clipping on compact screens: reduced horizontal padding and height on top header action buttons and tightened step divider spacing | `PosButton.jsx`, `StepStrip.jsx` |
Earlier phases (no hashes recorded): Phase 11 — UTC vs local day in Reports/Home/Sales History (all use `date(x,'localtime')`), returns netted out everywhere (Sales Report, P&L, Cashier Performance, Home, chart), Home "Customers Owe You" now equals the Ledgers total receivable. Phase 13 — currency symbol read from settings (`Rs.` fallback), POS "Only N left" uses each product's warn-below, brand on Product List rows, server-side Special Margin checks (feature since removed), focus-ring fix. Don't "fix" these again.

---

## 16. Change log

Covers: one entry per work session, newest first (seeded from `git log`, 92 commits). Format: date · agent/model · what · commits.

- **2026-10-31 · Antigravity · Customer Special Pricing, Master Recovery, Thermal Fonts, Direct Printing & UI Fixes:**
  - Customer Special Pricing (migration 043): `customer_special_prices` table with sync triggers, `priceEngine.js` priority rule 0 (pack-specific or product-wide fixed/discount%/margin%), IPC channels, and full management UI in Customer Profile (`SpecialPricingCard.jsx`).
  - Master Key Password Recovery: Added "Forgot password?" dialog on Login screen for Admin and Cashier accounts, verified against SHA-256 hash of developer master key.
  - POS Direct Printing & "No Receipt": Checkout format selection includes "No Receipt" (key 3) for both sales and purchases; completing a sale directly prints to physical printer without blocking modal preview; clear warnings and status displayed if no physical printer is connected.
  - Thermal Print Font & Layout Overhaul: Added printer font configuration (`monospace` vs `modern`) in Settings → Printers, and redesigned receipt layout for clean, professional presentation.
  - Letterhead Template Download: Added "Download Template" button in Settings → Letterheads generating an A4 design specification PDF (40mm header safe zone, 25mm footer safe zone).
  - Admin Void Anywhere: Admin can void any sale across sales history directly from `SaleDetailSheet.jsx` regardless of cashier ownership or sale age (as long as no returns exist).
  - Dev Panel Password: Updated baked default password hash in migration 043 and test suite.
  - UI Bug Fixes: Aligned "Keep working" and "Cancel sale" buttons in `CancelSaleDialog.jsx`; eliminated right-edge clipping of top POS action buttons on compact screens (`PosButton.jsx`, `StepStrip.jsx`).
- **2026-10-30 · Claude (Sonnet 5.5) · Docs consolidation:** this file rebuilt as the single project memory (§0–§16) from the code; `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` replaced by a one-line pointer; `BRIEF.md`, `FINAL-TEST.md`, `TEST_PROGRESS.txt` moved to `docs/archive/` (`git mv`). Also: README commit on `arwaheed/arwaat-pos-system` (so the draft can be published). Commit "docs: single project memory in SYSTEM_STATUS.md".
- **2026-10-30 · Claude (Sonnet 5.5) · Dev Panel password:** migration 042 (default hash), `devpanel:change-password`, Password tab, check R19-11. `ec601b3`.
- **2026-10-30 · Claude (Sonnet 5.5) · Finish-up run (freeze, dialogs, updater, release):** aging-report freeze fixed + migration 041 (`ba8a3b5`); Void-bill click bug, credit-limit "Over by", e2e test fixes, `07-stage1-ui` 11/11 (`2411a45`); safe start-up migrations + recovery + pre-update backup + version-gated sync + release scripts (`95afe25`); Updates tab, Home alert/toast, busy flags, R19 checks (`e101159`); updater 404 → up to date, docs (`8cbd623`); release script fixes and draft consolidation (`d6abb80`, `f36c09d`, `6033fff` Release v1.1.0, `0977270`). Draft v1.1.0 uploaded.
- **2026-10-30 · Antigravity / Claude · Stage 1–3 battle test:** Rules 1–17 one commit each (`9295f6a` R1, `9240782` R2, `9ddd33a` R3, `2a1777a` R4, `9261169` R5, `e151378` R6, `fe33dd2` R7, `565067d` R8, `547bb61` R9, `795ac5b` R10, `9c189b5` R11, `a98e6bf` R12, `f404401` R13, `83bf1e8` R14, `3d86a18` R15, `7f83830` R16, `84844cf` WIP R17 → `1a1180d` R17), anomalies (`04e8162`), Stage 2 harness (`73c403e`), fixes (`678c04a`, `9f17c58`, `fc288c6`, `72b211c`, `85c50ca`), Stage 3 WIP scripts and FINAL-TEST (`14decc7`, `08fab8e`); handoff files (`5cdda2c`, `66429ea`, `6536aa9`…).
- **2026-10-29/30 · Claude · Visible dev-mode test run + 8 bug fixes:** two apps on one PC, security hardening, print branding, sidebar sections (`4696049`); pre-test snapshot (`ae6e719`); fixes `f75c079`, `bd5e0ed`, `4a7f181`, `3155ee1`, `622ee8f`, `0b436b4`, `fb62c0f`, `4bd57bd`; harness + TEST_PROGRESS (`e85f973`).
- **2026-10-07 · "POS Overhaul"** (`6bb9a53`, `db38336`, `30f75fa`, `bdc5baf`): the keyboard POS work (commit messages carry no detail; see §7.2 for the result).
- **2026-10-04 · "4 Oct 1st/2nd"** (`00428eb`, `89700e8`, `bfc025f`, `21de02d`): daily snapshots, content not itemised in git.
- **2026-10-03 · "Updated Full Ios Style" and "Forms Updation"** (`d1b6045`, `5ef60ae`, `1215ac5`, `41c675a`, `6535216`, `ce2b38f`, `bbca8f9`, `751f859`): iOS-style redesign and form restyling.
- **2026-09-28 · "IOS" 1–4** (`87a562b`, `20caa48`, `4e41571`, `a203d15`): iOS-style redesign start.
- **2026-09-01 … 09-08 · date-only snapshots** (`b32eaaf`, `5b865ad`, `1d28b4c`, `62b481d`): content not itemised in git (use `git show <hash> --stat`).
- **2026-08-31 · Modules** (`c2c029f`): Products, Customers, Suppliers, Reports, Users + nav restructure + theme.
- **2026-08-30 · Initial project structure** (`d05c785`).

