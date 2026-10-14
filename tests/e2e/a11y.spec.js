import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signupAs, unique } from "./helpers.js";

test("app shell has no automated accessibility violations", async ({
  page,
}) => {
  await signupAs(page, unique("a11y"));
  await page.goto("/#/app/new");
  await expect(page.locator("#reminder-form")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
