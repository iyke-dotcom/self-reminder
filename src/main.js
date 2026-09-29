import "./styles/main.css";
import { createReminder } from "./modules/reminders/model.js";
import { createStore } from "./modules/reminders/store.js";
import { createLocalStorageAdapter } from "./modules/reminders/storage.js";
import { showToast } from "./modules/notifications/toast.js";
import { startDueChecker } from "./modules/notifications/dueChecker.js";
import { bindForm } from "./modules/ui/form.js";
import { renderList } from "./modules/ui/list.js";

const adapter = createLocalStorageAdapter();
const store = createStore({ adapter, initial: adapter.load() });

const listEl = document.getElementById("reminder-list");
const emptyEl = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");

function render() {
  renderList({
    reminders: store.getState().reminders,
    listEl,
    emptyEl,
    onDelete: (id) => store.deleteReminder(id),
  });
}

store.subscribe(render);

bindForm({
  form: document.getElementById("reminder-form"),
  onAdd: ({ title, datetime }) => {
    store.addReminder(createReminder({ title, date: datetime }));
    showToast(toastEl, "Reminder added");
  },
});

startDueChecker({
  store,
  onDue: (reminder) => showToast(toastEl, `Reminder: ${reminder.title}`, true),
});

render();
