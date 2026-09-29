import { classifyDue, formatDateTime } from "../../utils/date.js";

export function renderList({ reminders, listEl, emptyEl, onDelete }) {
  listEl.replaceChildren();
  emptyEl.style.display = reminders.length === 0 ? "block" : "none";

  [...reminders]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((reminder) => {
      const li = document.createElement("li");
      li.className = classifyDue(reminder.date);

      const content = document.createElement("div");
      content.className = "content";

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = reminder.title;

      const time = document.createElement("span");
      time.className = "time";
      time.textContent = formatDateTime(reminder.date);

      content.append(title, time);

      const del = document.createElement("button");
      del.className = "delete";
      del.type = "button";
      del.setAttribute("aria-label", `Delete ${reminder.title}`);
      del.textContent = "✕";
      del.addEventListener("click", () => onDelete(reminder.id));

      li.append(content, del);
      listEl.appendChild(li);
    });
}
