import { test, expect } from "@playwright/test";

const unique = (prefix) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const password = "correct-horse";

test("registers, syncs across logins, and deletes via sync UI", async ({
  page,
}) => {
  const username = unique("e2e");
  await page.goto("/");

  // register in the account panel
  await page.fill("#sync-username", username);
  await page.fill("#sync-password", password);
  await page.click("#sync-register");

  await expect(page.locator("#sync-status")).toContainText("Synced");
  await expect(page.locator("#sync-logout")).toBeEnabled();

  // add a reminder and let debounced auto-sync push it
  await page.fill("#title", "Sync across device");
  await page.fill("#datetime", "2030-01-02T09:00");
  await page.click('#reminder-form button[type="submit"]');
  await page.click("#sync-now");
  await expect(page.locator("#sync-status")).toContainText("Synced");

  // verify it landed on the PostgreSQL backend
  const token = await page.evaluate(
    () => JSON.parse(localStorage.getItem("self-reminder.auth")).token,
  );
  const reminders = await page.request.get(
    "http://localhost:3000/api/reminders",
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = await reminders.json();
  expect(body.reminders.map((r) => r.title)).toContain("Sync across device");

  // delete it; the tombstone should reach the backend
  await page
    .locator("ul.list > li")
    .first()
    .getByRole("button", { name: "Delete", exact: false })
    .click();
  await page.click("#sync-now");
  await expect(page.locator("#sync-status")).toContainText("Synced");

  const after = await page.request.get("http://localhost:3000/api/reminders", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterBody = await after.json();
  expect(afterBody.reminders.map((r) => r.title)).not.toContain(
    "Sync across device",
  );

  // log out / log back in, and the server state is still gone
  await page.click("#sync-logout");
  await expect(page.locator("#sync-status")).toContainText("Not logged in");
});
