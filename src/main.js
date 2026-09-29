import "./styles/main.css";
import { createReminder } from "./modules/reminders/model.js";
import { createStore } from "./modules/reminders/store.js";
import { createLocalStorageAdapter } from "./modules/reminders/storage.js";
import {
  filterReminders,
  sortReminders,
  collectTags,
} from "./modules/reminders/selectors.js";
import { showToast } from "./modules/notifications/toast.js";
import { startDueChecker } from "./modules/notifications/dueChecker.js";
import {
  effectiveDueDate,
  getSettings,
  setSettings,
} from "./modules/settings.js";
import {
  notificationPermission,
  notify,
  requestNotificationPermission,
} from "./modules/notifications/systemNotifications.js";
import { bindForm } from "./modules/ui/form.js";
import { renderList } from "./modules/ui/list.js";
import { openEditModal } from "./modules/ui/modal.js";
import { createView } from "./modules/ui/view.js";

const adapter = createLocalStorageAdapter();
const store = createStore({ adapter, initial: adapter.load() });

const listEl = document.getElementById("reminder-list");
const emptyEl = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");
const modal = document.getElementById("modal");
const tagbar = document.getElementById("tagbar");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");

const view = createView();

function visibleReminders() {
  const all = store.getState().reminders;
  const v = view.getState();
  renderTagFilters();
  tagbar.hidden = collectTags(all).length === 0;

  const filtered = filterReminders(all, {
    query: v.query,
    status: v.status,
    tag: v.tag,
  });
  return sortReminders(filtered, v.sort);
}

function render() {
  renderList({
    reminders: visibleReminders(),
    listEl,
    emptyEl,
    onDelete: (id) => {
      store.deleteReminder(id);
      showToast(toastEl, "Reminder deleted");
    },
    onToggle: (id) => store.toggleDone(id),
    onEdit: (reminder) =>
      openEditModal({
        modal,
        reminder,
        onEdit: (patch) => {
          store.updateReminder(reminder.id, patch);
          showToast(toastEl, "Reminder updated");
        },
      }),
  });
}

function renderTagFilters() {
  const v = view.getState();
  const tags = collectTags(store.getState().reminders);
  tagbar.replaceChildren();
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tag-chip${v.tag === tag ? " is-active" : ""}`;
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      view.set({ tag: v.tag === tag ? null : tag });
    });
    tagbar.appendChild(btn);
  });
}

store.subscribe(render);
view.subscribe(render);

bindForm({
  form: document.getElementById("reminder-form"),
  onAdd: (data) => {
    try {
      store.addReminder(createReminder(data));
      showToast(toastEl, "Reminder added");
    } catch (error) {
      showToast(toastEl, error.message, { isDue: true });
    }
  },
});

searchInput.addEventListener("input", () => {
  view.set({ query: searchInput.value });
});

sortSelect.addEventListener("change", () => {
  view.set({ sort: sortSelect.value });
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchInput.focus();
  }
  if ((event.key === "n" || event.key === "N") && !typing) {
    event.preventDefault();
    document.getElementById("title").focus();
  }
});

startDueChecker({
  store,
  effectiveAt: (reminder) => effectiveDueDate(reminder.date),
  soundEnabled: () => getSettings().sound,
  onDue: (reminder) => {
    if (getSettings().notifications && notificationPermission() === "granted") {
      notify(reminder.title, {
        body: `Due ${new Date(reminder.date).toLocaleString()}`,
      });
    }
    const action = reminder.recurring
      ? null
      : {
          label: "Snooze 5 min",
          onClick: () => {
            store.snooze(reminder.id, 5 * 60 * 1000);
            showToast(toastEl, "Reminder snoozed for 5 minutes");
          },
        };
    showToast(toastEl, `Reminder: ${reminder.title}`, {
      isDue: true,
      action,
    });
  },
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    view.set({ status: btn.dataset.status });
    document.querySelectorAll(".filter-btn").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
  });
});

const notifToggle = document.getElementById("notif-enabled");
const soundToggle = document.getElementById("sound-enabled");
const preReminderInput = document.getElementById("pre-reminder");

function applySettingsUi() {
  const settings = getSettings();
  notifToggle.checked = Boolean(settings.notifications);
  soundToggle.checked = settings.sound;
  preReminderInput.value = settings.preReminderMinutes;
}

notifToggle.addEventListener("change", async () => {
  const wantEnabled = notifToggle.checked;
  const current = notificationPermission();
  if (wantEnabled && current !== "granted") {
    const result = await requestNotificationPermission();
    if (result !== "granted") {
      notifToggle.checked = false;
      showToast(toastEl, "Notifications blocked in browser settings", {
        isDue: true,
      });
      return;
    }
  }
  setSettings({ notifications: wantEnabled });
});

soundToggle.addEventListener("change", () => {
  setSettings({ sound: soundToggle.checked });
});

preReminderInput.addEventListener("change", () => {
  const minutes = Math.max(0, Number(preReminderInput.value) || 0);
  preReminderInput.value = minutes;
  setSettings({ preReminderMinutes: minutes });
});

applySettingsUi();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

render();
