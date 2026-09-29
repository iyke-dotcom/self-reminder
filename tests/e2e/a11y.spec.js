import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("app shell has no automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#reminder-form")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
