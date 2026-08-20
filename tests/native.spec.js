import { expect, test } from "@playwright/test";
import { installWatcher, settled, watch } from "./watch.js";

/**
 * The same expectations, run against the browser's own ToggleEvent.source with
 * no polyfill loaded. This is what keeps the suite honest: without it the
 * assertions would only prove the polyfill is self-consistent, not that it
 * matches what browsers actually do.
 */

test.skip(({ browserName }) => browserName !== "chromium", "needs native ToggleEvent.source");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await installWatcher(page);
});

test("a command button is the source", async ({ page }) => {
  await watch(page, "my-popover");
  await page.getByRole("button", { name: "Toggle with command" }).click();
  expect(await settled(page)).toMatchObject({
    beforeSource: "Toggle with command",
    source: "Toggle with command",
    state: "open",
  });
});

test("a popovertarget button is the source", async ({ page }) => {
  await watch(page, "my-popover");
  await page.getByRole("button", { name: "Toggle with popovertarget" }).click();
  expect(await settled(page)).toMatchObject({
    source: "Toggle with popovertarget",
    state: "open",
  });
});

test("togglePopover() has no source", async ({ page }) => {
  await watch(page, "my-popover");
  await page.locator("#toggle-with-method").click();
  expect(await settled(page)).toMatchObject({ source: null, state: "open" });
});

test("togglePopover({ source }) reports the element it was given", async ({ page }) => {
  await watch(page, "my-popover");
  await page.locator("#toggle-with-source").click();
  expect(await settled(page)).toMatchObject({
    source: "#toggle-with-source",
    state: "open",
  });
});

test("a show-modal command button is the source", async ({ page }) => {
  await watch(page, "my-dialog");
  await page.getByRole("button", { name: "Open with command" }).click();
  expect(await settled(page)).toMatchObject({
    source: "Open with command",
    state: "open",
  });
});

test("showModal() has no source", async ({ page }) => {
  await watch(page, "my-dialog");
  await page.locator("#open-with-method").click();
  expect(await settled(page)).toMatchObject({ source: null, state: "open" });
});

test("light dismiss has no source", async ({ page }) => {
  await watch(page, "my-popover");
  await page.getByRole("button", { name: "Toggle with command" }).click();
  await settled(page);

  await watch(page, "my-popover");
  await page.locator("h1").click();
  expect(await settled(page)).toMatchObject({ source: null, state: "closed" });
});
