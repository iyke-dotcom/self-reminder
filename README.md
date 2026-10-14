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
- **Groups & shared events** — solo, pair, study, medical, corporate and custom groups (max 50 members) with invite codes, RSVP (going / maybe / declined + live summary), opt-out notes, role-aware labels, and per-member notifications with quiet hours
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

Then open the app: the login screen asks for **email address + password** (and the **Server URL**, default `http://localhost:3000`). **Create account** registers the email; **Sign in** logs in with email (usernames also work). There is no offline bypass — without a saved login you stay on the login screen.

After sign-in the app pulls your server reminders first, so signing in on another device (pointed at the **same** Server URL) shows the reminders you set elsewhere. New reminders sync automatically (debounced) and merge across devices with last-write-wins conflict resolution. Data is stored in `server/.pgdata`.

> Cross-device note: every device must reach the same backend over the network. `http://localhost:3000` only works on the machine running the server — to sync a phone or another computer, host the backend somewhere reachable (any Node host works: `npm run server` with `PORT`/`DATA_DIR`/`JWT_SECRET` set) and enter its `https://…` address in the login screen's Server URL field.

Endpoints: `POST /api/register`, `POST /api/login`, `GET /api/me`, `GET /api/reminders`, `POST /api/sync` — every endpoint except register/login requires `Authorization: Bearer <token>`.

## Segments & Roles (customer vs admin)

The app has three segments behind a hash router:

| Route | Segment | Who |
| ----- | ------- | --- |
| `#/` `#/login` | Public landing + customer sign in / sign up | Everyone |
| `#/app`, `#/app/new`, `#/app/manage`, `#/app/groups*`, `#/app/settings` | Customer (classic stacked app + focused views + groups) | Logged-in `customer` only |
| `#/admin` | Admin (users table + all reminders) | Logged-in `admin` only |

Guards: unauthenticated visits go to `#/login`; customers visiting `#/admin` get sent to `#/app` (API: 403); admins visiting `#/app*` get sent to `#/admin`. The customer home shows only a welcome message, Add/Manage links, and logout — the sync debug panel lives under Settings and admin UI is never linked from customer pages. Registration always creates a `customer` (the client cannot set a role); passwords are scrypt-hashed, auth is HMAC-signed JWT.

### Run with roles

```bash
cp server/.env.example server/.env   # review PORT, DATA_DIR, JWT_SECRET
npm run server
```

### Seed an admin

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='a-long-password-here' npm run seed:admin
# optional: ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" DATA_DIR=server/.pgdata
```

This creates (or promotes) that username to `role = 'admin'`. Then:

- **Customer:** open the app (`#/`), Create account → lands on `#/app` home.
- **Admin:** open the app, Sign in with the seeded admin credentials → lands on `#/admin`.

Admin API (all require an admin token): `GET /api/admin/users`, `GET /api/admin/reminders`. Customer-scoped alias: `GET /api/customer/reminders` (403 for admins).

## Groups & shared events

Solo reminders work exactly as before. Logged-in customers (online backend session) also get a **Groups** section on `#/app` with:

- **My groups** — create (`#/app/groups/new`: name, description, type), member counts, unread badges (pending RSVPs + new notes)
- **Upcoming group events** — soonest first, each with a live RSVP summary (`8 going · 2 maybe · 1 declined`)
- **Join** — via shareable invite link/code (`#/app/groups/join/:code`), username/email search, direct add, or the contact picker (where supported)
- **Group page** — events with Going ✅ / Maybe ❓ / Can't make it ❌, opt-out notes (author + timestamp, edit/delete own, admin hide/unhide, private-to-organizers option), members (promote/remove with confirm, leave anytime), invite-code revoke/refresh, rename, admin-only-event toggle, delete-with-warning
- **Templates** — solo / pair / study / medical / corporate / custom swap icons, member labels, placeholders and examples over one shared engine (`src/modules/groupTemplates.js`)
- **Notifications** — group events reuse the toast + system-notification service with each member's own sound toggle, optional quiet hours (Settings), vibration where supported, and per-event reminder schedules (week/day/hour/15 min presets); members who RSVP "declined" stay listed but are never pinged

Rules enforced on the backend: membership required for everything (strangers get 404), group-admin-only management, last-admin guard (promote first or delete), `MAX_GROUP_MEMBERS = 50` (`server/db.js`), invite codes expire after `INVITE_TTL_MS` = 7 days and are revocable.

Group API (customer token): `GET/POST /api/groups`, `GET /api/groups/feed`, `POST /api/groups/join`, `GET /api/invites/:code` (public preview), `GET /api/users/search?q=`, plus per-group `GET/PATCH/DELETE /api/groups/:id`, `/seen`, `/leave`, `/invite/refresh`, `/members`, `/events`, `/events/:eventId/rsvp`, `/events/:eventId/notes`.

### E2E with an admin

```bash
# seed the DB the e2e server uses, then point the guard spec at it:
ADMIN_USERNAME=e2e-admin ADMIN_PASSWORD='correct-horse' DATA_DIR=server/.pgdata npm run seed:admin
E2E_ADMIN_USERNAME=e2e-admin E2E_ADMIN_PASSWORD='correct-horse' npx playwright test guards
```

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
    sync.js         account auth (now with role) + cross-device sync
    admin.js        admin API client (users, all reminders)
    groups.js       groups API client + invite links + session user id
    groupTemplates.js role-aware labels per group type (one engine)
    notifications/groupChecker.js group-event pings (quiet hours, opt-out)
    ui/groups.js    groups lists, detail, forms (createElement, no innerHTML)
    ics.js          calendar (.ics) export
  utils/            date helpers, natural-language dates, id generation
  i18n.js           message catalog (en, fr) + t()
public/             manifest, service worker, icons
server/             Express + PGLite backend (db with roles, auth, app with
                    requireAuth/requireCustomer/requireAdmin, index, .env)
scripts/            seed-admin.mjs (create/promote the admin account)
tests/unit/         Vitest unit tests
tests/server/       API integration tests (PGlite in-memory)
tests/e2e/          Playwright end-to-end specs
```

## License

This project is open source under the MIT License.