import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { signupAs, unique } from "./helpers.js";

test("exports a backup and imports it back", async ({ page }) => {
  await signupAs(page, unique("bak"));
  await page.goto("/#/app/new");

  await page.fill("#title", "Do the dishes");
  await page.fill("#datetime", "2030-01-01T09:00");
  await page.click('#reminder-form button[type="submit"]');

  await page.goto("/#/app/settings");
  await expect(page.locator("#export-backup")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#export-backup"),
  ]);
  const path = await download.path();
  const text = await readFile(path, "utf8");
  expect(text).toContain("Do the dishes");

  // clear storage, reload (lands back on the login screen), sign up fresh,
  // then import the backup
  await page.evaluate(() => localStorage.clear());

  const db = await page.evaluate(async () => {
    const open = indexedDB.open("self-reminder-db");
    return new Promise((resolve, reject) => {
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("reminders", "readwrite");
        tx.objectStore("reminders").clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  expect(db).toBe(true);

  await page.reload();
  await signupAs(page, unique("bak2"));
  await page.goto("/#/app/settings");

  const file = await download.createReadStream();
  await page.locator("#import-backup").click();
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: await collect(file),
  });
  await page.goto("/#/app/manage");
  await expect(page.locator("#reminder-list > li")).toHaveCount(1);
  await expect(page.locator("#reminder-list > li")).toContainText(
    "Do the dishes",
  );
});

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
