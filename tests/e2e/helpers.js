import { expect } from "@playwright/test";

export const e2ePassword = "correct-horse";

export const unique = (prefix) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// Registers through the public login screen and lands on the customer home.
export async function signupAs(page, username, password = e2ePassword) {
  await page.goto("/#/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", password);
  await page.click("#signup-btn");
  await page.waitForURL("**#/app*");
  await expect(page.locator("#view-home")).toBeVisible();
}

export async function loginAs(page, username, password = e2ePassword) {
  await page.goto("/#/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", password);
  await page.click("#login-btn");
  await page.waitForURL("**#/app*");
}
