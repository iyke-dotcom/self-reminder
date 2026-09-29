import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("exports a backup and imports it back", async ({ page }) => {
  await page.goto("/");

  await page.fill("#title", "Do the dishes");
  await page.fill("#datetime", "2030-01-01T09:00");
  await page.click('#reminder-form button[type="submit"]');
  await expect(page.locator("ul.list > li")).toHaveCount(1);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#export-backup"),
  ]);
  const path = await download.path();
  const text = await readFile(path, "utf8");
  expect(text).toContain("Do the dishes");

  // clear storage, reload, then import the backup
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
  await expect(page.locator("ul.list > li")).toHaveCount(0);

  const file = await download.createReadStream();
  await page.locator("#import-backup").click();
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: await collect(file),
  });
  await expect(page.locator("ul.list > li")).toHaveCount(1);
  await expect(page.locator("ul.list > li")).toContainText("Do the dishes");
});

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
