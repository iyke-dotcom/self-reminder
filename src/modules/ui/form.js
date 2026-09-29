export function bindForm({ form, onAdd }) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = form.querySelector("#title").value.trim();
    const datetime = form.querySelector("#datetime").value;
    const when = new Date(datetime);
    if (!title || isNaN(when.getTime())) return;

    const recurringValue = form.querySelector("#recurring").value;
    onAdd({
      title,
      date: when,
      priority: form.querySelector("#priority").value,
      tags: form
        .querySelector("#tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      recurring: recurringValue
        ? {
            freq: recurringValue,
            interval: Number(form.querySelector("#interval").value) || 1,
          }
        : null,
    });
    form.reset();
    form.querySelector("#priority").value = "medium";
    form.querySelector("#interval").value = "1";
  });
}
