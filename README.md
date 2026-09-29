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
- **Settings** — sound on/off, "remind me X minutes before", notification toggle

## Getting Started

Requires Node.js 20 or later (`.nvmrc` pins v24.21.0).

```bash
git clone https://github.com/iyke-dotcom/self-reminder.git
cd self-reminder
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

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
| `npm run test:e2e` | End-to-end tests (Playwright, runs against a preview build) |
| `npm run format` | Prettier format |

## Tech Stack

- HTML, CSS, vanilla JavaScript (ES modules)
- [Vite](https://vite.dev/) for the dev server and build
- [Playwright](https://playwright.dev/) for end-to-end tests
- [Vitest](https://vitest.dev/) for unit tests
- IndexedDB (via a small dependency-free adapter) + localStorage fallback
- Service Worker / PWA manifest for offline + installability

## Architecture

```
index.html          app shell (form, toolbar, settings, modal, toast)
src/
  main.js           bootstrapping: storage choose/migrate, store, view, wiring
  styles/main.css   design tokens + component styles
  modules/
    reminders/      model, store, storage (localStorage), indexeddb,
                    recurrence, selectors (filter/sort)
    notifications/  dueChecker (polling), toast, systemNotifications
    ui/             form, list, modal, view (query/sort/status state)
    settings.js     persisted app settings
    backup.js       JSON export/import
  utils/            date helpers, id generation
public/             manifest, service worker, icons
tests/unit/         Vitest unit tests
```

## License

This project is open source under the MIT License.