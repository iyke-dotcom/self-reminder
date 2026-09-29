function ensureDismissBound(modal, onClose) {
  modal.__onClose = onClose;
  if (modal.__dismissBound) return;
  modal.__dismissBound = true;
  modal.addEventListener("click", (event) => {
    if (!event.target.closest("[data-close]")) return;
    closeModal(modal);
    if (modal.__onClose) modal.__onClose();
  });
}

export function openModal(modal, focusSelector) {
  modal.hidden = false;
  const focusTarget = modal.querySelector(focusSelector);
  if (focusTarget) focusTarget.focus();
  document.addEventListener("keydown", handleKeydown);
}

export function closeModal(modal) {
  modal.hidden = true;
  document.removeEventListener("keydown", handleKeydown);
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    const open = document.querySelector(".modal:not([hidden])");
    if (open) closeModal(open);
  }
}

export function openEditModal({ modal, reminder, onEdit, onClose }) {
  const form = modal.querySelector("#modal-form");
  if (typeof form.__submitHandler === "function") {
    form.removeEventListener("submit", form.__submitHandler);
  }

  const handler = (event) => {
    event.preventDefault();
    const when = new Date(form.querySelector("#modal-datetime").value);
    if (isNaN(when.getTime())) return;

    const recurringValue = form.querySelector("#modal-recurring").value;
    onEdit({
      title: form.querySelector("#modal-title").value.trim(),
      date: when,
      priority: form.querySelector("#modal-priority").value,
      tags: form
        .querySelector("#modal-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      recurring: recurringValue
        ? {
            freq: recurringValue,
            interval: Number(form.querySelector("#modal-interval").value) || 1,
          }
        : null,
    });
    closeModal(modal);
    if (onClose) onClose();
  };

  form.__submitHandler = handler;
  form.addEventListener("submit", handler);

  modal.querySelector("#modal-title").value = reminder.title;
  modal.querySelector("#modal-datetime").value = toLocalInputValue(
    reminder.date,
  );
  modal.querySelector("#modal-priority").value = reminder.priority || "medium";
  modal.querySelector("#modal-tags").value = (reminder.tags || []).join(", ");
  modal.querySelector("#modal-recurring").value = reminder.recurring
    ? reminder.recurring.freq
    : "";
  modal.querySelector("#modal-interval").value = reminder.recurring
    ? String(reminder.recurring.interval)
    : "1";

  ensureDismissBound(modal, onClose);
  openModal(modal, "#modal-title");
}

function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
