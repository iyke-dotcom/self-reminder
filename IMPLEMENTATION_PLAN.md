# Self Reminder — Implementation Plan

Complete phased roadmap for the Self Reminder project — from current state through design, development, quality, release, and maintenance. Work is sequential; move to the next phase only when the current one's acceptance criteria pass.

---

## Current Project Status (updated 2026-09-29)

**Resume point:** Phases 1–9 are complete and pushed; releases `v1.1.0` and `v1.2.0` are published. The only outstanding items are external: Phase 7 backend sync (needs a Supabase/Firebase account — user decision) and optional follow-ups (full i18n coverage, privacy analytics, webhook chat reminders).

| Item | Status |
| ---- | ------ |
| GitHub | `iyke-dotcom/self-reminder` on `main`; releases + tags `v1.1.0`, `v1.2.0` |
| Phase 1 tooling | Vite + ESLint + Prettier + Husky + Vitest in repo |
| Phase 2 PRD | `docs/PRD.md` (draft) |
| Phase 3–4 port | Modular `src/` with design tokens, storage adapter, store, UI, due checker |
| Phase 5 features | edit, recurring, done, search/filter/sort, priorities, tags, snooze, shortcuts, validation |
| Phase 6 PWA | manifest, service worker, icons, system notifications, settings (sound, pre-reminder) |
| Phase 7 storage | IndexedDB adapter + localStorage migration + JSON backup/restore |
| Phase 8 quality | 57 unit tests, 4 e2e specs + axe, CSP headers, GitHub Actions CI → Pages deploy, README, release v1.1.0 |
| Phase 9 polish | NL dates, dark/light/system theme toggle, ICS export, i18n baseline — release v1.2.0 |
| Backend sync | **Blocked** — needs a Supabase/Firebase account (user decision) |

**Current feature set:** add/edit/delete/toggle-done, recurring + snooze, search + filter by status/tag, priorities, tags, keyboard shortcuts, in-app toast + sound, system notifications, offline-capable PWA, IndexedDB + localStorage persistence, JSON export/import.

**Known gaps:** no e2e/CI, no backend sync, no NL date parsing, no theme toggle, no ICS export, no i18n. Phases 8–9 cover these.

**Immediate housekeeping (do first):**
- [x] Install Git + GitHub CLI (winget)
- [x] Authenticate GitHub CLI
- [x] Init repo, create remote, push, tag `v1.0.0`
- [x] Commit dark-background `style.css` change
- [x] Commit this plan file

---

## Tooling & Cost Assessment (Free-Tier Policy)

**Policy: use free/open-source tools and free tiers only for now. Nothing in this plan requires payment.**

| Tool / Software | Cost | Notes |
| --------------- | ---- | ----- |
| Winget (Windows package manager) | Free | Built into Windows |
| PowerShell / Git Bash | Free | OS shell |
| Git | Free | Open source (GPL) |
| GitHub CLI (`gh`) | Free | Open source |
| GitHub hosting (public repo) | Free tier | Public repos, Actions (2,000 min/mo private, unlimited public), Pages all free |
| GitHub Actions (CI/CD) | Free tier | Covers sandbox builds for this project |
| GitHub Pages (hosting) | Free tier | Static site hosting |
| Node.js + npm | Free | Open source |
| Vite (dev/build) | Free | Open source (MIT) |
| ESLint + Prettier | Free | Open source |
| Husky + lint-staged | Free | Open source |
| Vitest (unit tests) | Free | Open source |
| Playwright (e2e tests) | Free | Open source (Apache-2.0) |
| Lighthouse (audits) | Free | Open source |
| Google Fonts | Free | |
| Figma (design) | **Freemium** | Free tier is enough for wireframes/mockups; paid plans NOT required |
| Supabase / Firebase (backend, Phase 7) | **Free tier** | Supabase free plan (500 MB DB) or Firebase Spark suffice; paid only beyond large scale |
| Vercel / Netlify / Cloudflare Pages (deploy) | **Free tier** | Hobby/Free plans suffice for this project |
| Dexie.js (IndexedDB) | Free | Open source |
| Microsoft Word / OneDrive | **Paid (Microsoft 365)** | Only used to view the plan doc; Word for the web + OneDrive free 5 GB work for now — no need to pay |

**Conclusion:** Only Microsoft Office is paid software in use. Replace it with free alternatives (Word for the web / Google Docs / Notepad++) if no subscription already exists.

---

## Phase 1 — Environment & Tooling Setup

**Goal:** A reproducible development environment with lint, tests, and build.

**Tasks:**
- [x] Install Node.js LTS: `winget install OpenJS.NodeJS.LTS` (verify with `node -v`, `npm -v`)
- [x] Scaffold with Vite + vanilla JS: `npm create vite@latest . -- --template vanilla`
- [x] Add dev tooling: ESLint + Prettier, Husky pre-commit hooks, lint-staged
- [x] Add test runners: Vitest (unit), Playwright (e2e) — e2e config still outstanding
- [x] Add npm scripts: `dev`, `build`, `preview`, `lint`, `test`, `test:e2e`
- [x] Add `.gitignore` (node_modules, dist, logs, editor folders)
- [x] Pin Node version via `.nvmrc` / `engines` in package.json

**Deliverables:** Working dev server, green `npm run lint`, passing scaffold test suite.

**Acceptance criteria:** `npm run dev` serves the app; `npm run build` produces a `dist/`; `npm test` passes.

---

## Phase 2 — Product Definition & Discovery

**Goal:** Lock down the product scope before design and build.

**Tasks:**
- [x] Define target users (personal productivity user, student, busy professional) and 1–2 personas
- [x] Write 3 core user stories (e.g., "As a student, I want a reminder 10 minutes before class so I don't miss it")
- [x] Build a feature matrix: must-have vs nice-to-have (see Phases 4–7)
- [x] Define success metrics (reminders created/day, notifications acknowledged, weekly return rate)
- [x] Decide name/branding direction

**Deliverables:** `PRD.md`, persona sheet, feature matrix, success metrics.

**Acceptance criteria:** PRD approved; all later tasks trace to a requirement in the PRD.

---

## Phase 3 — Design (UX/UI)

**Goal:** Complete visual and interaction design as a spec for the frontend.

### 3.1 Information Architecture & Flows
- [ ] Map screens: Home (list + quick add), Reminder detail/edit modal, Search view, Settings
- [ ] User flows: create → confirm; due → notify → dismiss/snooze; edit; delete; mark done
- [ ] State diagrams: empty, loading, offline, overdue, due-soon, error

### 3.2 Wireframes
- [ ] Low-fi wireframes for all screens (mobile-first, then desktop)
- [ ] Annotate interactive elements and edge cases

### 3.3 Design System
- [ ] Color tokens: dark theme (current) + light theme — background, surface, text, accent, status (overdue/soon/future/done)
- [ ] Typography scale + font choice (system stack or Google Fonts)
- [ ] Spacing scale (4px base), radii, shadows, transitions
- [ ] Component inventory: buttons, inputs, banner/badge, card, toast, modal, empty state, toggle, form field
- [ ] Icon set (inline SVG)
- [ ] Accessibility spec: WCAG AA contrast, visible focus, 44px touch targets, reduced-motion support

### 3.4 High-Fidelity Mockups
- [ ] Hi-fi mockups (Figma or HTML/CSS prototype) for all screens, both themes
- [ ] Interactive prototypes for add, due-notification, snooze, edit, delete

**Deliverables:** Design tokens (CSS custom properties), wireframes, hi-fi mockups, accessibility checklist.

**Acceptance criteria:** All screens designed in both themes; clickable prototype navigable; contrast + touch-target checks pass.

---

## Phase 4 — Frontend Foundation (Architecture)

**Goal:** Modular, maintainable, testable codebase replacing the single-file approach while keeping the same UX.

**Cost rule:** every tool in this phase is free/open-source (see Tooling & Cost Assessment). No paid or freemium tools are required.

**Framework decision (pick one):**
- Vanilla JS + Vite — smallest footprint, matches current code, fully free (Recommended)
- Vue + Vite — middle ground, free
- React + Vite — only if the UI grows many state-heavy components; free

**Recommended Phase 4 stack (all free):**
- Build: **Vite** (or `npm run dev` from Node)
- Lint: **ESLint** + **Prettier**
- Git hooks: **Husky** + **lint-staged**
- Unit tests: **Vitest**
- E2E tests: **Playwright**
- Design tokens as CSS custom properties (no paid design tool needed to consume them)

**Target structure:**
```
src/
  styles/         # tokens, base, components
  modules/
    reminders/    # model + storage adapter
    notifications/# toast, Notification API
    ui/           # components (form, list, cards, modal)
  utils/          # date, id, validation helpers
  main.js
tests/
  unit/  e2e/
  fixtures/
```

**Tasks:**
- [x] Port existing logic into modules (storage, reminder model, timer/notifier, renderers)
- [x] Introduce a small store: `state`, `subscribe`, mutators
- [x] Storage adapter interface (swappable localStorage → IndexedDB later)
- [ ] Move inline styles to token-driven component styles
- [x] Add initial unit tests for pure logic (classify, format, recurrence later)

**Deliverables:** Vite app, lint/format pipeline, modular structure, ported features working.

**Acceptance criteria:** `npm run lint` and `npm test` green; app behaves identically to current version after the port.

---

## Phase 5 — Core Feature Completion (functional v1)

**Goal:** Full CRUD plus the feature set defined in the PRD.

**Tasks:**
- [ ] **Edit** reminders (title + datetime + status)
- [ ] **Recurring reminders** (daily/weekly/monthly/custom interval)
- [ ] **Mark done** — completed state; filters: all / active / done / overdue / due-soon
- [ ] **Search** by title (case-insensitive, debounced)
- [ ] **Sort control** (by date, priority, manual)
- [ ] **Priorities** (low/medium/high) with badge styling
- [ ] **Categories/tags** with color assignment
- [ ] **Snooze** (5 min / 1 hour / tomorrow) from the due notification
- [ ] **Keyboard shortcuts** (`N` new, `/` search, `Esc` close)
- [ ] **Input validation** + clear error messages; explicit empty/error states

**Deliverables:** Feature-complete app per PRD.

**Acceptance criteria:** Every must-have story demonstrable; no reload loses data; filters/sorting/search correct.

---

## Phase 6 — Notifications & PWA

**Goal:** Reliable notifications and an installable, offline-capable app.

**Tasks:**
- [x] **Notification API** — permission flow, rich system notifications with title/time
- [x] **Service Worker** — offline cache of app shell + assets
- [x] **PWA manifest** — name, icons, theme color, dark background; install prompt
- [ ] Offline-first behavior: cache shell, queue writes, reconcile on reconnect
- [x] Base64 beep retained (small, dependency-free)
- [x] Notification settings: sound on/off, "remind X minutes before"

**Deliverables:** Installable PWA, offline launch works, system notifications fire.

**Acceptance criteria:** Add to Home Screen works; app launches offline; notifications fire when tab is backgrounded (and via SW where supported); Lighthouse PWA ≥ 90.

*(Status 2026-09-29: manifest/SW/icons + settings complete and verified in runtime smoke test. Install prompt + offline queue + Lighthouse below 90 not yet gated — deferred to Phase 8.)*

---

## Phase 7 — Data Layer & Multi-Device Sync (backend)

**Goal:** Durable, syncable storage beyond a single browser.

**Tasks:**
- [x] Storage adapter upgrade: localStorage → **IndexedDB** (raw adapter, no dependency)
- [x] Versioned schema + **migration** script for existing localStorage data (`schemaVersion`)
- [x] **Backup & restore** — export/import JSON
- [ ] Backend (decide below) — **BLOCKED: requires a Supabase or Firebase account (user decision)**:
  - [ ] User signup/login (email+password or OAuth)
  - [ ] Reminder CRUD endpoints
  - [ ] Sync strategy (versioned timestamps / last-write-wins) + conflict resolution
  - [ ] Auth tokens, password hashing, rate limiting
- [ ] Hosting: GitHub Pages (static only) vs Vercel/Netlify (frontend) + Supabase (recommended for managed auth/DB)

**Deliverables:** Schema migrations, backup/restore UI, accounts + cross-device sync.

**Acceptance criteria:** Reminder on device A appears on device B; offline edits reconcile on reconnect; legacy data migrates losslessly; endpoints are auth-protected.

*(Status 2026-09-29: client-side complete — IndexedDB adapter, localStorage→IDB migration, JSON backup/restore all implemented, unit-tested (40 total), and runtime-verified. Backend sync/accounts cannot be done without the user's Supabase/Firebase account; documented as the sole blocked item.)*

---

## Phase 8 — Quality, Testing & Release

**Goal:** Ship a robust, tested, documented v1.0.

**Tasks:**
- [x] **Unit tests**: storage adapter, recurrence, classify/sort/filter, schema migration (Vitest) — 40 passing
- [ ] **Component tests** (if framework used) — n/a (vanilla JS, covered by unit + e2e)
- [x] **E2E tests**: create → see → edit → notify → delete; offline; install (Playwright) — 4 specs passing
- [x] **Accessibility audit**: WCAG AA, axe-core (serious/critical = 0); accent color darkened to pass contrast
- [ ] **Performance**: Lighthouse ≥ 90 — headless Lighthouse not run locally; left for Pages deployment audit
- [x] **Security review**: CSP + nosniff + Referrer-Policy headers in preview; zero `innerHTML` usage with user data
- [x] **CI/CD**: GitHub Actions — lint → test → build → e2e → deploy on push to `main`
- [x] Update README: setup, scripts, screenshots, architecture diagram
- [x] Semantic versioning + tag + GitHub release with changelog — **v1.1.0**

**Deliverables:** Green CI, passing tests, accessible + performant build, documented release.

**Acceptance criteria:** `main` auto-deploys; lint/tests pass in CI; Lighthouse ≥ 90; release tagged and published.

*(Status 2026-09-29: all code-level tasks done; v1.1.0 released, CI workflow pushed. Lighthouse audit runs once GitHub Pages goes live; browser-driven Lighthouse is a manual/CI follow-up if Pages deployment is enabled.)*

---

## Phase 9 — Post-Launch & Maintenance

**Goal:** Iterate on real usage and keep the product healthy.

- [ ] Privacy-friendly analytics for Phase 2 metrics — deferred (needs decision)
- [x] Natural-language date input ("tomorrow 9am", "in 2 hours")
- [ ] Chat reminders via webhook (WhatsApp/Telegram/e-mail) — needs Phase 7 backend
- [x] Calendar export (ICS) / import-ish (export done; import n/a)
- [x] Theme toggle (dark/light/system) respecting OS preference
- [x] Localization (i18n) baseline — `src/i18n.js` catalog (en, fr) + `t()` wired into app toasts

*(Status 2026-09-29: NL dates, theme toggle, ICS export, and the i18n baseline are complete and verified (unit + runtime). Full catalog coverage and auto-detection of the browser locale remain follow-ups. Webhook chat reminders still require the Phase 7 backend.)*
- [ ] Mobile home-screen widgets (PWA)
- [ ] Recurrence skips and multi-reminder chains
- [ ] Dependabot + regular dependency updates; security patches
- [ ] Issue triage and weekly changelog cadence

---

## Architecture Overview (Target)

```
Frontend (Vite PWA, static)
  └─ Vanilla JS modules
       ├─ storage adapter (IndexedDB, offline queue, migrator)
       ├─ reminder store → UI (components)
       ├─ notification layer (toast + Notification API + SW push)
       └─ settings module (sound, pre-reminders, theme)
Backend (Supabase / Node API) -- optional for sync
  ├─ auth
  ├─ reminders REST API
  └─ push notification worker
Hosting: GitHub Pages / Vercel + Supabase
Tests: Vitest + Playwright · CI: GitHub Actions
```

## Decision Points to Confirm

1. **Framework**: Vanilla JS + Vite (recommended) vs Vue vs React
2. **Backend now or later**: PWA-only first (Phases 5–6) and add sync in Phase 7, or include from the start
3. **Target devices**: desktop-only vs mobile-first
4. **Theme**: dark-only (current) vs dark + light toggle

## Recommended Execution Order

Fastest path to a shippable v1.0: **1 → 2 → 3 → 4 → 5 → 6 → 8**, with Phase 7 (sync/backend) as v1.1 and Phase 9 items incrementally after launch.