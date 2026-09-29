import { test, expect } from "@playwright/test";

test("adds, edits, toggles done, and deletes a reminder", async ({ page }) => {
  await page.goto("/");

  await page.fill("#title", "Water the plants");
  await page.fill("#datetime", "2030-01-01T09:00");
  await page.selectOption("#priority", "high");
  await page.fill("#tags", "home,chores");
  await page.click('#reminder-form button[type="submit"]');

  const first = page.locator("ul.list > li").first();
  await expect(first).toContainText("Water the plants");
  await expect(first).toContainText("home");
  await expect(first).toContainText("chores");

  // edit
  await first.getByRole("button", { name: "Edit Water the plants" }).click();
  await page.fill("#modal-title", "Water the indoor plants");
  await page.click("#modal-form button[type='submit']");
  await expect(page.locator("ul.list > li").first()).toContainText(
    "Water the indoor plants",
  );

  // toggle done
  await page
    .locator("ul.list > li")
    .first()
    .locator("button[title='Mark as done']")
    .click();
  await expect(page.locator("ul.list > li").first()).toHaveClass(/done/);

  // delete
  await page
    .locator("ul.list > li")
    .first()
    .getByRole("button", { name: "Delete", exact: false })
    .click();
  await expect(page.locator("ul.list > li")).toHaveCount(0);
});
