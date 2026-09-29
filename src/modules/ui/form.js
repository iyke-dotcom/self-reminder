export function bindForm({ form, onAdd }) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = form.querySelector("#title").value;
    const datetime = form.querySelector("#datetime").value;
    const when = new Date(datetime);
    if (isNaN(when.getTime())) return;

    onAdd({ title, datetime: when });
    form.reset();
  });
}
