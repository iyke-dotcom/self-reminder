export function showToast(
  toastEl,
  message,
  { isDue = false, action = null } = {},
) {
  toastEl.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  toastEl.appendChild(text);

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.onClick();
      hideToast(toastEl);
    });
    toastEl.appendChild(button);
  }

  toastEl.classList.toggle("due", isDue);
  toastEl.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => hideToast(toastEl), 6000);
}

export function hideToast(toastEl) {
  toastEl.classList.remove("show");
}
