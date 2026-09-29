import "./styles/main.css";
import { createReminder } from "./modules/reminders/model.js";
import { createStore } from "./modules/reminders/store.js";
import { createLocalStorageAdapter } from "./modules/reminders/storage.js";
import { createIndexedDbAdapter } from "./modules/reminders/indexeddb.js";
import { downloadBackup, parseBackup } from "./modules/backup.js";
import { downloadIcs } from "./modules/ics.js";
import { parseNaturalDate } from "./utils/naturalDate.js";
import { createI18n } from "./i18n.js";
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

const lsAdapter = createLocalStorageAdapter();
const idbAdapter = createIndexedDbAdapter();

const listEl = document.getElementById("reminder-list");
const emptyEl = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");
const modal = document.getElementById("modal");
const tagbar = document.getElementById("tagbar");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const view = createView();
const { t } = createI18n("en");

function resolveTheme(theme) {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(getSettings().theme);
}

applyTheme();
window
  .matchMedia("(prefers-color-scheme: light)")
  .addEventListener("change", () => {
    if (getSettings().theme === "system") applyTheme();
  });

async function boot() {
  let reminders = [];
  let migrated = false;
  try {
    reminders = await idbAdapter.load();
    if (reminders.length === 0) {
      const legacy = lsAdapter.load();
      if (legacy.length > 0) {
        reminders = legacy;
        await idbAdapter.saveAll(legacy);
        migrated = true;
      }
    }
  } catch {
    reminders = lsAdapter.load();
  }

  const adapter = {
    save: (items) => lsAdapter.save(items),
    saveAsync: (items) => idbAdapter.saveAll(items),
  };

  return { store: createStore({ adapter, initial: reminders }), migrated };
}

function init({ store, migrated }) {
  if (migrated) {
    showToast(toastEl, t("migrated"));
  }

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
        showToast(toastEl, t("reminderDeleted"));
      },
      onToggle: (id) => store.toggleDone(id),
      onEdit: (reminder) =>
        openEditModal({
          modal,
          reminder,
          onEdit: (patch) => {
            store.updateReminder(reminder.id, patch);
            showToast(toastEl, t("reminderUpdated"));
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
        showToast(toastEl, t("reminderAdded"));
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
      if (
        getSettings().notifications &&
        notificationPermission() === "granted"
      ) {
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
              showToast(toastEl, t("snoozed"));
            },
          };
      showToast(toastEl, t("reminderDue", { title: reminder.title }), {
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
  const exportBtn = document.getElementById("export-backup");
  const importBtn = document.getElementById("import-backup");
  const importFile = document.getElementById("import-file");
  const exportIcsBtn = document.getElementById("export-ics");
  const themeSelect = document.getElementById("theme-select");
  const nlDateInput = document.getElementById("nl-date");
  const nlApplyBtn = document.getElementById("nl-apply");

  function applySettingsUi() {
    const settings = getSettings();
    notifToggle.checked = Boolean(settings.notifications);
    soundToggle.checked = settings.sound;
    preReminderInput.value = settings.preReminderMinutes;
    themeSelect.value = settings.theme || "system";
  }

  themeSelect.addEventListener("change", () => {
    setSettings({ theme: themeSelect.value });
    applyTheme();
  });

  nlApplyBtn.addEventListener("click", () => {
    const value = parseNaturalDate(nlDateInput.value);
    if (value) {
      document.getElementById("datetime").value = value;
      showToast(toastEl, t("reminderAdded") + " ✓");
    } else {
      showToast(toastEl, t("nlDateMissing"), { isDue: true });
    }
  });
  nlDateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      nlApplyBtn.click();
    }
  });

  notifToggle.addEventListener("change", async () => {
    const wantEnabled = notifToggle.checked;
    const current = notificationPermission();
    if (wantEnabled && current !== "granted") {
      const result = await requestNotificationPermission();
      if (result !== "granted") {
        notifToggle.checked = false;
        showToast(toastEl, t("notifBlocked"), {
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

  exportBtn.addEventListener("click", () => {
    downloadBackup(
      store.getState().reminders,
      `self-reminder-backup-${Date.now()}.json`,
    );
    showToast(toastEl, t("backupDownloaded"));
  });

  exportIcsBtn.addEventListener("click", () => {
    downloadIcs(store.getState().reminders, "self-reminder.ics");
    showToast(toastEl, `${t("backupDownloaded")} (.ics)`);
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const { reminders } = parseBackup(await file.text());
      store.replaceAll(reminders);
      importFile.value = "";
      showToast(toastEl, t("backupImported", { count: reminders.length }));
    } catch (error) {
      importFile.value = "";
      showToast(toastEl, error.message, { isDue: true });
    }
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
}

boot().then(init);
