/**
 * Opens the demo in Playwright's WebKit 26.0 - a real browser without
 * `ToggleEvent.source` - so the polyfill can be tried by hand in a browser
 * which actually needs it. The page starts unpolyfilled: use the button in its
 * header to apply it.
 *
 * Run with `npm start`. Closing the browser window stops the dev server.
 */
import { webkit } from "@playwright/test";
import { createServer } from "vite";

const server = await createServer({ server: { open: false } });
await server.listen();

const url = server.resolvedUrls?.local?.[0];
if (!url) {
  await server.close();
  throw new Error("Vite did not report a local URL to open.");
}

let browser;
try {
  browser = await webkit.launch({ headless: false });
} catch (error) {
  await server.close();
  console.error("Could not launch WebKit. Run `npx playwright install webkit` first.\n");
  throw error;
}

const page = await browser.newPage({ viewport: null });
await page.goto(url);

console.log(`\n  WebKit ${browser.version()} - no native ToggleEvent.source`);
console.log(`  ${url}\n`);
console.log("  Close the browser window to stop.\n");

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await browser.close().catch(() => {});
  await server.close();
  process.exit(0);
};

browser.on("disconnected", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
