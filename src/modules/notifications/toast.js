export function showToast(toastEl, message, isDue = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle("due", isDue);
  toastEl.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toastEl.classList.remove("show"), 4000);
}
