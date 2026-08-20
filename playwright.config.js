import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;

/**
 * The polyfill suites load `index.html` with `?polyfill`, so they exercise the
 * polyfill on both engines. `native.spec.js` loads it without, and runs only
 * where the browser implements `ToggleEvent.source` itself.
 *
 * Pinning `@playwright/test` matters: Playwright 1.59+ bundles WebKit 26.4,
 * which has `source` natively and would leave the polyfill untested.
 */
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // WebKit 26.0: has popovers, dialogs and `command`/`commandfor`, but no
    // `ToggleEvent.source`, so the polyfill is the only missing piece.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // Chromium has `source` natively, which is what `native.spec.js` compares
    // the polyfill's behaviour against.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
