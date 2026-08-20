/**
 * Page-side helpers for observing `beforetoggle`/`toggle` sources.
 *
 * Sources are compared as descriptors rather than element handles: an element's
 * id when it has one, its trimmed text otherwise, matching how the demo page
 * itself describes a source.
 */

/**
 * Installs `window.__watch()` on an already-loaded page.
 *
 * Deliberately not an init script. The polyfill hands sources to listeners from
 * a capture phase listener on the popover's root node, so a capture listener
 * registered on that root *before* the polyfill is applied sees a null source.
 * Installing after load keeps the watcher behind the page's own `apply()` call.
 */
export async function installWatcher(page) {
  await page.evaluate(() => {
    const describe = (node) => (node ? (node.id ? `#${node.id}` : node.textContent.trim()) : null);

    window.__watch = (target) => {
      const element = typeof target === "string" ? document.getElementById(target) : target;
      const seen = { beforeSource: undefined, source: undefined, state: undefined };
      return new Promise((resolve) => {
        element.addEventListener(
          "beforetoggle",
          (event) => {
            seen.beforeSource = describe(event.source);
            seen.beforeState = event.newState;
          },
          { once: true },
        );
        element.addEventListener(
          "toggle",
          (event) => {
            seen.source = describe(event.source);
            seen.state = event.newState;
            // Resolve in a fresh task: acting on the element from inside its own
            // toggle dispatch makes the browser coalesce the next toggle away.
            setTimeout(() => resolve(seen), 0);
          },
          { once: true },
        );
        setTimeout(() => resolve({ ...seen, timedOut: true }), 2000);
      });
    };
  });
}

/** Starts watching `id` for the next toggle, before the click which causes it. */
export async function watch(page, id) {
  await page.evaluate((target) => {
    window.__pending = window.__watch(target);
  }, id);
}

/** Resolves with what the pending watcher saw. */
export function settled(page) {
  return page.evaluate(() => window.__pending);
}
