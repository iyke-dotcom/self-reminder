# Self Reminder

A lightweight, browser-based reminder app that helps you remember important tasks and events. No installation required — just open `index.html` in your browser.

## Features

- Add reminders with a title and date/time
- Automatic status colors: overdue, upcoming, and due soon
- Browser notification with sound when a reminder is due
- Reminders persist in localStorage (survive page reloads)
- Delete reminders when no longer needed

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/iyke-dotcom/self-reminder.git
   ```
2. Open `index.html` in any modern web browser.

Or just open the files directly — no build step or server required.

## Usage

1. Type what you want to remember in the **title** field.
2. Pick a date and time.
3. Click **Add Reminder**.
4. When the time arrives, a toast notification appears with a sound.

Reminder list statuses:

- **Green** — upcoming
- **Orange** — due within 5 minutes
- **Red** — overdue

## Project Structure

| File          | Purpose                                         |
| ------------- | ----------------------------------------------- |
| `index.html`  | Page structure and UI                           |
| `style.css`   | Styling and layout                              |
| `app.js`      | Reminder logic, persistence, and notifications  |

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) for data persistence

## License

This project is open source under the MIT License.