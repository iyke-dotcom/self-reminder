import { test, expect } from "@playwright/test";

test("searches and filters reminders", async ({ page }) => {
  await page.goto("/");

  await page.fill("#title", "Buy groceries");
  await page.fill("#datetime", "2030-01-01T09:00");
  await page.fill("#tags", "errand");
  await page.click('#reminder-form button[type="submit"]');

  await page.fill("#title", "Call dentist");
  await page.fill("#datetime", "2030-01-02T09:00");
  await page.click('#reminder-form button[type="submit"]');

  await expect(page.locator("ul.list > li")).toHaveCount(2);

  await page.fill("#search", "dentist");
  await expect(page.locator("ul.list > li")).toHaveCount(1);
  await expect(page.locator("ul.list > li")).toContainText("Call dentist");

  await page.fill("#search", "");
  await page.click('button[data-status="done"]');
  await expect(page.locator("ul.list > li")).toHaveCount(0);
  await page.click('button[data-status="all"]');
  await expect(page.locator("ul.list > li")).toHaveCount(2);
});
