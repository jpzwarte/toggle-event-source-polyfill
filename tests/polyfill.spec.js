import { expect, test } from "@playwright/test";
import { installWatcher } from "./watch.js";

/**
 * The parts of the API which have no button on the demo page: the ToggleEvent
 * constructor, the popover and dialog methods, and shadow DOM retargeting.
 * These run inside index.html with `?polyfill`, so they exercise the applied polyfill.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/?polyfill");
  await installWatcher(page);
});

test.describe("constructor", () => {
  test("accepts a source", async ({ page }) => {
    expect(
      await page.evaluate(() => {
        const event = new ToggleEvent("toggle", {
          oldState: "closed",
          newState: "open",
          source: document.getElementById("toggle-with-source"),
        });
        return { source: event.source?.id ?? null, newState: event.newState };
      }),
    ).toEqual({ source: "toggle-with-source", newState: "open" });
  });

  test("defaults source to null", async ({ page }) => {
    expect(await page.evaluate(() => new ToggleEvent("toggle", {}).source)).toBeNull();
  });

  test("rejects a non-element source", async ({ page }) => {
    expect(
      await page.evaluate(() => {
        try {
          new ToggleEvent("toggle", { source: "nope" });
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
  });

  test("leaves a natively dispatched toggle a real ToggleEvent", async ({ page }) => {
    expect(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const popover = document.getElementById("my-popover");
            popover.addEventListener(
              "toggle",
              (event) => resolve(event instanceof ToggleEvent && event instanceof Event),
              { once: true },
            );
            popover.showPopover();
          }),
      ),
    ).toBe(true);
  });

  test("still produces a real ToggleEvent", async ({ page }) => {
    expect(
      await page.evaluate(() => {
        const event = new ToggleEvent("toggle");
        return event instanceof ToggleEvent && event instanceof Event;
      }),
    ).toBe(true);
  });
});

test.describe("popover methods", () => {
  test("showPopover() and hidePopover() have no source", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const popover = document.getElementById("my-popover");
        const shown = window.__watch(popover);
        popover.showPopover();
        const open = await shown;

        const hidden = window.__watch(popover);
        popover.hidePopover();
        return { open: open.source, closed: (await hidden).source };
      }),
    ).toEqual({ open: null, closed: null });
  });

  test("showPopover({ source }) reports the element it was given", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const popover = document.getElementById("my-popover");
        const shown = window.__watch(popover);
        popover.showPopover({ source: document.getElementById("toggle-with-method") });
        return await shown;
      }),
    ).toMatchObject({
      beforeSource: "#toggle-with-method",
      source: "#toggle-with-method",
      state: "open",
    });
  });

  test("togglePopover() still returns whether the popover is open", async ({ page }) => {
    expect(
      await page.evaluate(() => {
        const popover = document.getElementById("my-popover");
        return popover.togglePopover({ source: document.getElementById("toggle-with-method") });
      }),
    ).toBe(true);
  });

  test("togglePopover({ source }) reports no source when it hides", async ({ page }) => {
    // Per spec a hide never carries a source, even when one was passed.
    expect(
      await page.evaluate(async () => {
        const popover = document.getElementById("my-popover");
        const button = document.getElementById("toggle-with-source");

        const shown = window.__watch(popover);
        popover.togglePopover({ source: button });
        await shown;

        const hidden = window.__watch(popover);
        popover.togglePopover({ source: button });
        return await hidden;
      }),
    ).toMatchObject({ source: null, state: "closed" });
  });

  test("hiding without a source after a source-driven show reports null", async ({ page }) => {
    // The light dismiss / close request case: no source, even though the
    // popover was opened by one.
    expect(
      await page.evaluate(async () => {
        const popover = document.getElementById("my-popover");
        const shown = window.__watch(popover);
        popover.showPopover({ source: document.getElementById("toggle-with-source") });
        await shown;

        const hidden = window.__watch(popover);
        popover.hidePopover();
        return await hidden;
      }),
    ).toMatchObject({ source: null, state: "closed" });
  });
});

test.describe("command buttons", () => {
  test("show-popover and hide-popover commands each report their button", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const popover = document.getElementById("my-popover");
        const button = (id, command) => {
          const element = document.createElement("button");
          element.id = id;
          element.setAttribute("command", command);
          element.setAttribute("commandfor", "my-popover");
          document.body.append(element);
          return element;
        };
        const show = button("cmd-show", "show-popover");
        const hide = button("cmd-hide", "hide-popover");

        const shown = window.__watch(popover);
        show.click();
        const open = await shown;

        const hidden = window.__watch(popover);
        hide.click();
        return { show: open.source, hide: (await hidden).source };
      }),
    ).toEqual({ show: "#cmd-show", hide: "#cmd-hide" });
  });
});

test.describe("dialog methods", () => {
  test("showModal(), close() and requestClose() have no source", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const dialog = document.getElementById("my-dialog");
        const opened = window.__watch(dialog);
        dialog.showModal();
        const open = await opened;

        const closed = window.__watch(dialog);
        dialog.requestClose();
        return { open: open.source, closed: (await closed).source };
      }),
    ).toEqual({ open: null, closed: null });
  });
});

test.describe("shadow DOM", () => {
  test("a source inside a shadow root retargets to the host", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const host = document.createElement("div");
        host.id = "host";
        document.body.append(host);

        const popover = document.createElement("div");
        popover.setAttribute("popover", "");
        popover.id = "light-dom-popover";
        document.body.append(popover);

        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `<button id="inner">shadow invoker</button>`;
        const inner = shadow.getElementById("inner");
        inner.popoverTargetElement = popover;

        const shown = window.__watch(popover);
        inner.click();
        return await shown;
      }),
    ).toMatchObject({ source: "#host", state: "open" });
  });

  test("a popover inside a shadow root sees the invoker directly", async ({ page }) => {
    expect(
      await page.evaluate(async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `<button id="invoker" popovertarget="scoped">x</button>
          <div popover id="scoped">scoped popover</div>`;

        const popover = shadow.getElementById("scoped");
        const shown = window.__watch(popover);
        shadow.getElementById("invoker").click();
        return await shown;
      }),
    ).toMatchObject({ source: "#invoker", state: "open" });
  });
});
