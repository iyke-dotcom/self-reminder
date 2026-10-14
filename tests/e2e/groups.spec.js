import { test, expect } from "@playwright/test";
import { signupAs, loginAs, unique } from "./helpers.js";

test("pair shares an event, RSVPs, and sees the opt-out note", async ({
  page,
}) => {
  const aName = unique("grpA");
  const bName = unique("grpB");

  // user A creates a medical group
  await signupAs(page, aName);
  await page.goto("/#/app/groups/new");
  await page.fill("#group-name", "Dentist Pair");
  await page.selectOption("#group-type", "medical");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.locator(".invite-box")).toBeVisible();
  const gid = page.url().split("/").pop();
  const code = (await page.locator(".invite-box p").first().textContent())
    .split("Invite code: ")[1]
    .trim();

  // user A creates a shared event and RSVPs going
  await page.goto(`/#/app/groups/${gid}/events/new`);
  await page.fill("#group-event-title", "Checkup");
  await page.fill("#group-event-date", "2030-05-01T09:00");
  await page.getByRole("button", { name: /^Create / }).click();
  await expect(page.locator(".invite-box")).toBeVisible();
  const detail = page.locator("#group-detail");
  await detail.getByRole("button", { name: "Going ✅" }).click();
  await expect(
    detail.getByText("1 going · 0 maybe · 0 declined"),
  ).toBeVisible();

  await page.click("#logout-btn");

  // user B joins with the code, declines, leaves a note
  await signupAs(page, bName);
  await page.goto(`/#/app/groups/join/${code}`);
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(page.locator(".invite-box")).toBeVisible();
  await detail.getByRole("button", { name: "Can't make it ❌" }).click();
  // wait for the RSVP re-render to settle so the note draft isn't wiped
  await expect(
    detail.getByText("1 going · 0 maybe · 1 declined"),
  ).toBeVisible();
  await detail.getByLabel("Note text").fill("Down with flu, will reschedule.");
  await detail.getByRole("button", { name: "Add note" }).click();
  await expect(
    detail.getByText("Down with flu, will reschedule."),
  ).toBeVisible();
  await expect(
    detail.getByText("1 going · 0 maybe · 1 declined"),
  ).toBeVisible();

  // user A sees the note with the author attached
  await page.click("#logout-btn");
  await loginAs(page, aName);
  await page.goto(`/#/app/groups/${gid}`);
  await expect(
    detail.getByText("Down with flu, will reschedule."),
  ).toBeVisible();
  await expect(
    detail.getByText("1 going · 0 maybe · 1 declined"),
  ).toBeVisible();
});
