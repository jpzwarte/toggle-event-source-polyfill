import { expect, test } from "@playwright/test";
import { installWatcher, settled, watch } from "./watch.js";

/**
 * Drives index.html the way a person would - real clicks on the demo's buttons -
 * and checks the source each toggle reports. Loaded with `?polyfill`, so these
 * run against the polyfill on every project.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/?polyfill");
  await installWatcher(page);
});

test.describe("popover", () => {
  test("a command button is the source when showing and when hiding", async ({ page }) => {
    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with command" }).click();
    expect(await settled(page)).toMatchObject({
      beforeSource: "Toggle with command",
      source: "Toggle with command",
      state: "open",
    });

    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with command" }).click();
    expect(await settled(page)).toMatchObject({
      source: "Toggle with command",
      state: "closed",
    });
  });

  test("a popovertarget button is the source when showing and when hiding", async ({ page }) => {
    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with popovertarget" }).click();
    expect(await settled(page)).toMatchObject({
      beforeSource: "Toggle with popovertarget",
      source: "Toggle with popovertarget",
      state: "open",
    });

    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with popovertarget" }).click();
    expect(await settled(page)).toMatchObject({
      source: "Toggle with popovertarget",
      state: "closed",
    });
  });

  test("the hide-popover button inside the popover is the source", async ({ page }) => {
    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with command" }).click();
    await settled(page);

    await watch(page, "my-popover");
    await page.getByRole("button", { name: "X" }).click();
    expect(await settled(page)).toMatchObject({ source: "X", state: "closed" });
  });

  test("light dismiss has no source, even after a source-driven show", async ({ page }) => {
    await watch(page, "my-popover");
    await page.getByRole("button", { name: "Toggle with command" }).click();
    await settled(page);

    await watch(page, "my-popover");
    await page.locator("h1").click();
    expect(await settled(page)).toMatchObject({ source: null, state: "closed" });
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
      beforeSource: "#toggle-with-source",
      source: "#toggle-with-source",
      state: "open",
    });
  });
});

test.describe("dialog", () => {
  test("a show-modal command button is the source", async ({ page }) => {
    await watch(page, "my-dialog");
    await page.getByRole("button", { name: "Open with command" }).click();
    expect(await settled(page)).toMatchObject({
      source: "Open with command",
      state: "open",
    });
  });

  test("a close command button is the source", async ({ page }) => {
    await watch(page, "my-dialog");
    await page.getByRole("button", { name: "Open with command" }).click();
    await settled(page);

    await watch(page, "my-dialog");
    await page.getByRole("button", { name: "Close with command" }).click();
    expect(await settled(page)).toMatchObject({
      source: "Close with command",
      state: "closed",
    });
  });

  test("showModal() and close() have no source", async ({ page }) => {
    await watch(page, "my-dialog");
    await page.locator("#open-with-method").click();
    expect(await settled(page)).toMatchObject({ source: null, state: "open" });

    await watch(page, "my-dialog");
    await page.locator("#close-with-method").click();
    expect(await settled(page)).toMatchObject({ source: null, state: "closed" });
  });
});

test.describe("the demo's own log", () => {
  test("reports the source of the last toggle", async ({ page }) => {
    await expect(page.locator("#log")).toHaveText("No toggle events yet");

    await page.getByRole("button", { name: "Toggle with command" }).click();
    await expect(page.locator("#log")).toHaveText(
      "#my-popover is open - source: <button> Toggle with command",
    );

    await page.getByRole("button", { name: "Toggle with command" }).click();
    await expect(page.locator("#log")).toHaveText(
      "#my-popover is closed - source: <button> Toggle with command",
    );

    // From closed, so the click does not light-dismiss the popover first.
    await page.locator("#toggle-with-method").click();
    await expect(page.locator("#log")).toHaveText("#my-popover is open - source: null");
  });
});
