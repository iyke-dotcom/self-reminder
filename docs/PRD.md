# Self Reminder — Product Requirements Document (PRD)

Version: 1.1.0 · Status: Draft · Date: 2026-09-27

---

## 1. Overview

Self Reminder is a lightweight, browser-based reminder app. Users create reminders with a
title and a due date/time; the app alerts them when a reminder is due. It is designed to be
fast, offline-capable, and free to use.

**Positioning:** A personal productivity utility that focuses on the core loop —
*capture a reminder, forget it safely, get alerted on time* — with no signup or friction.

## 2. Goals & Non-Goals

**Goals**
- Make creating a reminder take less than 10 seconds.
- Deliver alerts even when the tab is closed or the device is offline (progressive web app).
- Work on mobile and desktop from the same codebase.
- Keep the tool free; use only free tiers.

**Non-Goals (v1.1)**
- Multi-user collaboration / shared lists.
- Backend accounts and cross-device sync (deferred to v1.2).
- Social features, gamification, or complex automation.

## 3. Target Users & Personas

**Persona 1 — "Busy Ben", 29, working professional**
- Habits: juggles meetings and errands; forgets non-calendar tasks.
- Pain: wants nagging reminders for small things (take medicine, call the dentist).
- Needs: quick add, reliable alert on time, status visibility.

**Persona 2 — "Student Sam", 20, university student**
- Habits: studies with frequent breaks; deadlines pile up.
- Pain: misses assignment and class reminders.
- Needs: recurring reminders, priorities, clear visual urgency.

**Persona 3 — "Cautious Carol", 55, caregiver**
- Habits: manages a daily routine for a family member.
- Pain: needs simple, forgiving UI and audible alerts.
- Needs: snooze, loud clear notification, minimal buttons.

## 4. User Stories

1. As a working professional, I want to type a reminder and a time, so I can capture a thought in seconds.
2. As a student, I want recurring reminders (daily/weekly), so I don't have to recreate them.
3. As a caregiver, I want a loud alert plus the ability to snooze, so I can attend to something and still be reminded.
4. As any user, I want my reminders to survive a page reload, so I don't lose them.
5. As any user, I want reminders to be easily editable, so I can fix a mistake or change plans.
6. As any user, I want to mark a reminder done, so my list reflects reality.
7. As any user, I want to search my reminders, so I can find old ones quickly.
8. As any user, I want alerts even when the app tab is closed, so I don't miss important times.

## 5. Feature Matrix

| Feature | Tier | Notes |
| ------- | ---- | ----- |
| Add reminder (title + datetime) | Must-have | Done (v1.0) |
| Delete reminder | Must-have | Done (v1.0) |
| Status coloring (overdue/soon/future) | Must-have | Done (v1.0) |
| Persistence (localStorage/IndexedDB) | Must-have | Upgrade to IndexedDB in Phase 7 |
| In-app toast + sound | Must-have | Done (v1.0) |
| Edit reminder | Must-have | Phase 5 |
| Mark done / filter list | Must-have | Phase 5 |
| Search | Should-have | Phase 5 |
| Recurring reminders | Should-have | Phase 5 |
| Priorities & tags | Should-have | Phase 5 |
| Snooze | Should-have | Phase 5 |
| Keyboard shortcuts | Nice-to-have | Phase 5 |
| System notifications (Notification API) | Must-have | Phase 6 |
| PWA install / offline (service worker) | Must-have | Phase 6 |
| Backup / restore | Should-have | Phase 7 |
| Backend accounts + sync | Deferred | v1.2 |
| Natural-language date input | Nice-to-have | Phase 9 |
| Calendar (ICS) export | Nice-to-have | Phase 9 |
| i18n | Nice-to-have | Phase 9 |
| Theme toggle (dark/light) | Nice-to-have | Phase 9 |

## 6. Success Metrics

- **Capture rate:** average reminders created per active day ≥ 2.
- **Reliability:** ≥ 95% of due reminders produce an alert the user acknowledges.
- **Retention:** ≥ 40% weekly return rate among users who created ≥ 3 reminders.
- **Performance:** Lighthouse performance & PWA score ≥ 90; initial load < 2s on 4G.
- **Cost:** $0 recurring spend (free tiers only).

## 7. Constraints & Assumptions

- Vanilla JavaScript + Vite (no framework) unless the UI grows beyond ~6 interactive components.
- No signup required for local usage.
- Data is stored locally per device; sync is out of scope for v1.1.
- The product must run from static hosting (GitHub Pages) and work offline as a PWA.

## 8. Acceptance Criteria (v1.1)

- All "Must-have" + "Should-have" features (except deferred sync) are implemented and tested.
- `npm run lint`, `npm test`, `npm run build` pass in CI.
- Installable PWA loads offline and fires notifications at due time.
- Lighthouse ≥ 90 for Performance, Accessibility, Best Practices, PWA.