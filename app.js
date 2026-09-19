const STORAGE_KEY = "self-reminder.reminders";

const form = document.getElementById("reminder-form");
const titleInput = document.getElementById("title");
const datetimeInput = document.getElementById("datetime");
const listEl = document.getElementById("reminder-list");
const emptyEl = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");

let reminders = loadReminders();

function loadReminders() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveReminders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function classify(date) {
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff <= 5 * 60 * 1000) return "soon";
  return "future";
}

function render() {
  listEl.innerHTML = "";
  emptyEl.style.display = reminders.length === 0 ? "block" : "none";

  reminders
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((r) => {
      const li = document.createElement("li");
      const date = new Date(r.date);
      li.className = classify(date);

      const content = document.createElement("div");
      content.className = "content";
      content.innerHTML =
        '<span class="title"></span><span class="time"></span>';
      content.querySelector(".title").textContent = r.title;
      content.querySelector(".time").textContent = formatDateTime(r.date);

      const del = document.createElement("button");
      del.className = "delete";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        reminders = reminders.filter((x) => x.id !== r.id);
        saveReminders();
        render();
      });

      li.appendChild(content);
      li.appendChild(del);
      listEl.appendChild(li);
    });
}

function showToast(message, isDue = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle("due", isDue);
  toastEl.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const when = new Date(datetimeInput.value);
  if (isNaN(when.getTime())) return;

  reminders.push({
    id: Date.now().toString(),
    title: titleInput.value.trim(),
    date: when.toISOString(),
    notified: false,
  });
  saveReminders();
  form.reset();
  render();
  showToast("Reminder added");
});

setInterval(() => {
  reminders.forEach((r) => {
    const d = new Date(r.date);
    if (!r.notified && d.getTime() - Date.now() <= 0) {
      r.notified = true;
      saveReminders();
      showToast("Reminder: " + r.title, true);
      const audio = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAA="
      );
      audio.play().catch(() => {});
    }
  });
  render();
}, 2000);

render();