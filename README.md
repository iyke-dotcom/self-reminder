# Self Reminder

A lightweight, browser-based reminder app that helps you remember important tasks and events.

## Features

- Add reminders with a title and date/time
- Automatic status colors: overdue, upcoming, and due soon
- In-app toast with sound when a reminder is due
- Reminders persist in localStorage (survive page reloads)
- Delete reminders when no longer needed

## Getting Started

Requires Node.js 20 or later.

```bash
git clone https://github.com/iyke-dotcom/self-reminder.git
cd self-reminder
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Usage

1. Type what you want to remember in the **title** field.
2. Pick a date and time.
3. Click **Add Reminder**.
4. When the time arrives, a toast notification appears with a sound.

Reminder list statuses:

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

## Tech Stack

- HTML, CSS, vanilla JavaScript
- [Vite](https://vite.dev/) for the dev server and build
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) for data persistence

## License

This project is open source under the MIT License.
