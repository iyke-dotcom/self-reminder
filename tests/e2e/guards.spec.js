import { test, expect } from "@playwright/test";
import { signupAs, unique, e2ePassword } from "./helpers.js";

// Seeded admin credentials (see README: seed with ADMIN_USERNAME /
// ADMIN_PASSWORD, then run e2e with E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD).
const adminUser = process.env.E2E_ADMIN_USERNAME;
const adminPass = process.env.E2E_ADMIN_PASSWORD || e2ePassword;

test("unauthenticated users are sent to the login screen", async ({ page }) => {
  await page.goto("/#/app");
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator("#login-screen")).toBeVisible();
  await expect(page.locator("#app-main")).toBeHidden();

  await page.goto("/#/admin");
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator("#login-screen")).toBeVisible();
});

test("customers cannot reach the admin segment", async ({ page }) => {
  await signupAs(page, unique("cust"));
  await expect(page.locator("#admin-main")).toBeHidden();

  await page.goto("/#/admin");
  await expect(page).toHaveURL(/#\/app/);
  await expect(page.locator("#admin-main")).toBeHidden();
  await expect(page.locator("#view-home")).toBeVisible();
});

test("customer home shows only welcome, links and logout", async ({ page }) => {
  await signupAs(page, unique("home"));
  await expect(page.locator("#welcome-heading")).toContainText("Welcome");
  await expect(page.locator('#view-home a[href="#/app/new"]')).toBeVisible();
  await expect(page.locator('#view-home a[href="#/app/manage"]')).toBeVisible();
  await expect(page.locator("#logout-btn")).toBeVisible();
  // no admin UI on customer pages
  await expect(page.locator("#admin-main")).toBeHidden();
  await expect(page.locator("#admin-users")).toBeHidden();
});

test("admin lands on /admin and is kept out of customer pages", async ({
  page,
}) => {
  test.skip(
    !adminUser,
    "needs a seeded admin: set E2E_ADMIN_USERNAME (+E2E_ADMIN_PASSWORD)",
  );
  await page.goto("/#/login");
  await page.fill("#login-username", adminUser);
  await page.fill("#login-password", adminPass);
  await page.click("#login-btn");
  await page.waitForURL("**#/admin*");
  await expect(page.locator("#admin-main")).toBeVisible();
  await expect(page.locator("#app-main")).toBeHidden();

  await page.goto("/#/app");
  await expect(page).toHaveURL(/#\/admin/);
  await expect(page.locator("#admin-main")).toBeVisible();
});
