import { expect, test } from "@playwright/test";

/**
 * Guards the pinned browser versions. WebKit 26.4 (Playwright 1.59+) has
 * `ToggleEvent.source` natively, so an upgrade would silently leave the
 * polyfill untested; Chromium is what provides the native comparison.
 */
test("each project provides the support the suite expects of it", async ({ page, browserName }) => {
  await page.goto("/");
  expect(await page.evaluate(() => "source" in ToggleEvent.prototype)).toBe(
    browserName === "chromium",
  );
});
