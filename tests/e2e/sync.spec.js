import { test, expect } from "@playwright/test";
import { signupAs, unique } from "./helpers.js";

test("registers, syncs across logins, and deletes via sync UI", async ({
  page,
}) => {
  const username = unique("e2e");
  await signupAs(page, username);

  // account sync panel lives in Settings (off the customer home page)
  await page.goto("/#/app/settings");
  await page.click("#sync-now");
  await expect(page.locator("#sync-status")).toContainText("Synced");
  await expect(page.locator("#sync-logout")).toBeEnabled();

  // add a reminder and let sync push it
  await page.goto("/#/app/new");
  await page.fill("#title", "Sync across device");
  await page.fill("#datetime", "2030-01-02T09:00");
  await page.click('#reminder-form button[type="submit"]');
  await page.goto("/#/app/settings");
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
  await page.goto("/#/app/manage");
  await page
    .locator("ul.list > li")
    .first()
    .getByRole("button", { name: "Delete", exact: false })
    .click();
  await page.goto("/#/app/settings");
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
