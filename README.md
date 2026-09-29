# Self Reminder

A lightweight, installable browser-based reminder app that helps you remember important tasks and events. Built with vanilla JavaScript and [Vite](https://vite.dev/), free-of-cost and offline-capable.

## Features

- **Add, edit, delete** reminders with a title, date/time, priority, tags, and optional recurrence
- **Recurring reminders** — daily, weekly, monthly, yearly, and custom intervals
- **Mark done** and filter by status (all / open / done), search by text, and filter by tag
- **Priorities** (low / medium / high) with color badges; sort by date, priority, title, or newest
- **Snooze** a due reminder directly from the toast action button
- **Keyboard shortcuts** — `n` focuses the title field, `/` focuses search
- **System notifications** via the Notification API (opt-in) plus in-app toast with sound
- **PWA** — installable, with a service worker offering offline launch
- **Durable storage** — data is stored in IndexedDB with automatic migration from the legacy localStorage format
- **Backup & restore** — export JSON and import it back
- **Cross-device sync (optional)** — accounts + login backed by a self-hosted **PostgreSQL** server, with last-write-wins merging and tombstone deletes
- **Settings** — sound on/off, "remind me X minutes before", notification toggle, theme (system/dark/light)

## Getting Started

Requires Node.js 20 or later (`.nvmrc` pins v24.21.0).

```bash
git clone https://github.com/iyke-dotcom/self-reminder.git
cd self-reminder
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Sync Backend (PostgreSQL, optional)

The app is fully functional offline on one device. To enable cross-device sync, run a small self-hosted server that embeds the real PostgreSQL engine (via `@electric-sql/pglite`, so there's no separate database install or cloud account):

```bash
cp server/.env.example server/.env   # review PORT, DATA_DIR, JWT_SECRET
npm run server
```

Then open the app, scroll to **Account sync** in Settings, set **Server URL** to `http://localhost:3000` (default), and **Create account** or **Log in**. Reminders sync automatically (debounced) and merge across devices with last-write-wins conflict resolution. Data is stored in `server/.pgdata`.

Endpoints: `POST /api/register`, `POST /api/login`, `GET /api/me`, `GET /api/reminders`, `POST /api/sync` — every endpoint except register/login requires `Authorization: Bearer <token>`.

## Usage

1. Type what you want to remember in the **title** field.
2. Pick a date/time, optionally set priority, tags, and a repeat schedule.
3. Click **Add Reminder**.
4. When the time arrives, a toast notification (and system notification if enabled) fires.

Reminder list statuses (colors follow the app's dark theme):

- **Green** — upcoming
- **Orange** — due within 5 minutes
- **Red** — overdue

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Local development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, runs against a preview build + the sync server) |
| `npm run server` | Start the PostgreSQL (PGLite) sync backend |
| `npm run format` | Prettier format |

## Tech Stack

- HTML, CSS, vanilla JavaScript (ES modules)
- [Vite](https://vite.dev/) for the dev server and build
- [Playwright](https://playwright.dev/) for end-to-end tests
- [Vitest](https://vitest.dev/) for unit tests
- IndexedDB (via a small dependency-free adapter) + localStorage fallback
- Service Worker / PWA manifest for offline + installability
- [Express](https://expressjs.com/) + [PGLite](https://pglite.dev/) (`@electric-sql/pglite`) sync server — real PostgreSQL working in WASM
- `node:crypto` for scrypt password hashing and HMAC-signed login tokens

## Architecture

```
index.html          app shell (form, toolbar, settings, modal, toast)
src/
  main.js           bootstrapping: storage choose/migrate, store, view, sync, wiring
  styles/main.css   design tokens + component styles
  modules/
    reminders/      model, store, storage (localStorage), indexeddb,
                    recurrence, selectors (filter/sort)
    notifications/  dueChecker (polling), toast, systemNotifications
    ui/             form, list, modal, view (query/sort/status state)
    settings.js     persisted app settings
    backup.js       JSON export/import
    sync.js         account auth + cross-device sync (merge, tombstones)
    ics.js          calendar (.ics) export
  utils/            date helpers, natural-language dates, id generation
  i18n.js           message catalog (en, fr) + t()
public/             manifest, service worker, icons
server/             Express + PGLite sync backend (db, auth, app, index, .env)
tests/unit/         Vitest unit tests
tests/server/       API integration tests (PGlite in-memory)
tests/e2e/          Playwright end-to-end specs
```

## License

This project is open source under the MIT License.