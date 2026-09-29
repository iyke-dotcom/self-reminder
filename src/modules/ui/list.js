import { classifyDue, formatDateTime } from "../../utils/date.js";
import { describeRecurring } from "../reminders/recurrence.js";

export function renderList({
  reminders,
  listEl,
  emptyEl,
  onDelete,
  onToggle,
  onEdit,
}) {
  listEl.replaceChildren();
  emptyEl.hidden = reminders.length !== 0;

  reminders.forEach((reminder) => {
    const li = document.createElement("li");
    li.className = [
      classifyDue(reminder.date),
      reminder.done ? "done" : "",
      `priority-${reminder.priority || "medium"}`,
    ]
      .filter(Boolean)
      .join(" ");

    const content = document.createElement("div");
    content.className = "content";

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";

    const title = document.createElement("button");
    title.type = "button";
    title.className = "title";
    title.textContent = reminder.title;
    title.setAttribute("aria-label", `Edit ${reminder.title}`);
    title.addEventListener("click", () => onEdit(reminder));

    const badges = document.createElement("span");
    badges.className = "badges";
    if (reminder.recurring) {
      const recurring = document.createElement("span");
      recurring.className = "badge badge--recurring";
      recurring.textContent = describeRecurring(reminder.recurring);
      badges.appendChild(recurring);
    }
    const priority = document.createElement("span");
    priority.className = `badge badge--priority badge--${reminder.priority || "medium"}`;
    priority.textContent = reminder.priority || "medium";
    badges.appendChild(priority);
    (reminder.tags || []).forEach((tag) => {
      const t = document.createElement("span");
      t.className = "badge badge--tag";
      t.textContent = tag;
      badges.appendChild(t);
    });

    titleRow.append(title, badges);

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatDateTime(reminder.date);

    content.append(titleRow, time);

    const actions = document.createElement("div");
    actions.className = "actions";

    const done = document.createElement("button");
    done.type = "button";
    done.className = "done";
    done.textContent = reminder.done ? "↺" : "✓";
    done.setAttribute(
      "aria-label",
      reminder.done ? "Mark as active" : "Mark as done",
    );
    done.title = reminder.done ? "Mark as active" : "Mark as done";
    done.addEventListener("click", () => onToggle(reminder.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete ${reminder.title}`);
    del.addEventListener("click", () => onDelete(reminder.id));

    actions.append(done, del);
    li.append(content, actions);
    listEl.appendChild(li);
  });
}
