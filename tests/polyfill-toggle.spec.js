import { expect, test } from "@playwright/test";

/**
 * The button in the demo's header: it reports whether the polyfill is loaded,
 * and loads it by reloading the page with `?polyfill`. A reload rather than an
 * in-place apply, because the polyfill has to wrap the popover methods before
 * anything on the page uses them.
 */

const button = (page) => page.locator("#polyfill-toggle");
const banner = (page) => page.locator("#support");

test.describe("with native support", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "needs native ToggleEvent.source");

  test("the button is disabled, because there is nothing to apply", async ({ page }) => {
    await page.goto("/");
    await expect(button(page)).toBeDisabled();
    await expect(button(page)).toHaveText("No polyfill needed");
    await expect(banner(page)).toHaveAttribute("data-state", "native");
  });
});

test.describe("without native support", () => {
  test.skip(({ browserName }) => browserName === "chromium", "needs a browser missing the API");

  test("the button offers to apply the polyfill", async ({ page }) => {
    await page.goto("/");
    await expect(button(page)).toBeEnabled();
    await expect(button(page)).toHaveText("Apply polyfill");
    await expect(banner(page)).toHaveAttribute("data-state", "missing");
  });

  test("until it is applied, toggles report no source", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => "source" in ToggleEvent.prototype)).toBe(false);

    await page.getByRole("button", { name: "Toggle with command" }).click();
    await expect(page.locator("#log")).toHaveText("#my-popover is open - source: null");
  });

  test("clicking it reloads with the query param and applies the polyfill", async ({ page }) => {
    await page.goto("/");
    await button(page).click();

    await expect(page).toHaveURL(/\?polyfill$/);
    await expect(button(page)).toHaveText("Polyfill applied");
    await expect(banner(page)).toHaveAttribute("data-state", "polyfilled");
    expect(await page.evaluate(() => "source" in ToggleEvent.prototype)).toBe(true);

    await page.getByRole("button", { name: "Toggle with command" }).click();
    await expect(page.locator("#log")).toHaveText(
      "#my-popover is open - source: <button> Toggle with command",
    );
  });

  test("clicking it again drops the query param", async ({ page }) => {
    await page.goto("/?polyfill");
    await button(page).click();

    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(button(page)).toHaveText("Apply polyfill");
    await expect(banner(page)).toHaveAttribute("data-state", "missing");
  });
});
