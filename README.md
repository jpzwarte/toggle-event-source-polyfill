# ToggleEvent.source Polyfill

This polyfills [`ToggleEvent.source`](https://developer.mozilla.org/en-US/docs/Web/API/ToggleEvent/source):
the element which caused a popover or `<dialog>` to be shown or hidden.

```html
<button commandfor="my-popover" command="toggle-popover">Toggle</button>
<div popover id="my-popover">I'm a popover!</div>
<script>
  document.getElementById("my-popover").addEventListener("toggle", (event) => {
    // The button which opened or closed the popover, or null if it was
    // toggled programmatically.
    console.log(event.source);
  });
</script>
```

`source` landed well after popovers, dialogs and invoker commands themselves
(Chrome 140, Firefox 145, Safari 26.5), so it is missing in plenty of browsers
which otherwise support everything you would use it with.

## Installation

### With npm

If you're using npm, you only need to import the package, like so:

```js
import "toggle-event-source-polyfill";
```

This will automatically apply the polyfill if required.

If you'd like to manually apply the polyfill, you can instead import the
`isSupported` and `apply` functions directly from the `./toggle-event-source.js`
file, which is mapped to `/fn`:

```js
import { isSupported, apply } from "toggle-event-source-polyfill/fn";
if (!isSupported()) apply();
```

An `isPolyfilled` function is also available, to detect if it has been polyfilled:

```js
import { isSupported, isPolyfilled, apply } from "toggle-event-source-polyfill/fn";
if (!isSupported() && !isPolyfilled()) apply();
```

Alternatively, if you're not using a package manager, you can use the `unpkg` script:

```html
<!-- polyfill automatically -->
<script
  type="module"
  async
  src="https://unpkg.com/toggle-event-source-polyfill@latest/toggle-event-source.min.js"
></script>
```

## Usage

A source is reported for popovers and dialogs toggled by:

- a [`command`/`commandfor`](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API) button
- a [`popovertarget`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#popovertarget) button
- `showPopover({ source })` and `togglePopover({ source })`

As per spec, `hidePopover()` and the `<dialog>` `show()`, `showModal()`,
`close()` and `requestClose()` methods have no source, and neither does a
popover closed by light dismiss or by a close request - in all of those cases
`event.source` is `null`.

The polyfill also makes `new ToggleEvent(type, { source })` accept a source.

### Together with a `command`/`commandfor` polyfill

The polyfill reads `commandForElement`, `command`, `popoverTargetElement` and
`popoverTargetAction` off the button, so it works both with native invoker
commands and with a polyfill such as
[invokers-polyfill](https://github.com/keithamus/invokers-polyfill) providing
them. No cooperation between the two is needed, but **apply this polyfill
first**:

```js
import "toggle-event-source-polyfill";
import "invokers-polyfill";
```

A `command`/`commandfor` polyfill hides popovers and opens dialogs by calling
`hidePopover()`, `showModal()`, `close()` and `requestClose()`, none of which
carry a source of their own. This polyfill recognises those calls as belonging
to the click it is handling, which requires its click listener to run first. In
the other order the `toggle` event still reports the right source, but
`beforetoggle` - which those methods fire synchronously, before this polyfill
has seen the click - reports `null`.

## Limitations

- The polyfill hands the source to `toggle`/`beforetoggle` listeners from a
  capture phase listener on the popover's root node, so a capture phase
  listener registered on that root _before_ the polyfill is applied will see
  `event.source` as `null`. Apply the polyfill as early as possible.
- Setting a source does not make that element the popover's
  [implicit anchor element](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning),
  which cannot be polyfilled.
- Buttons inside a closed shadow root that was created before the polyfill was
  applied are not detected as sources.
- If a popover polyfill is used, it must be loaded _before_ this polyfill, as it
  replaces the popover methods this polyfill wraps.
- If an invoker's activation is cancelled (by calling `preventDefault()` on its
  `command` event, for example) and the same popover or dialog is later changed
  in the same direction without a source, that earlier invoker may be reported
  as the source.

## Demo

`npm start` opens the demo in Playwright's WebKit 26.0 - a real browser without
`ToggleEvent.source` - so you can try the polyfill in a browser which actually
needs it. Closing the browser window stops the dev server. `npm run dev` serves
the same page in your own browser at http://localhost:5173/ instead.

The page logs the source of every toggle event, and the button in its header
reports whether the polyfill is loaded:

- **Apply polyfill** - this browser has no `ToggleEvent.source`. Clicking
  reloads the page with `?polyfill`, which applies it.
- **Polyfill applied** - loaded with `?polyfill`. Clicking drops the parameter
  again, so you can see the same buttons with and without it.
- **No polyfill needed** - disabled, because the browser implements
  `ToggleEvent.source` itself.

The button reloads rather than applying the polyfill in place, because the
polyfill hands sources to listeners from a capture phase listener on the
popover's root node: anything registered before it applies would see a null
source. Reloading with a query parameter keeps it first on the page.

## Testing

The suite runs in [Playwright](https://playwright.dev) and drives `index.html` -
the demo's own buttons are clicked, and the source each `toggle` and
`beforetoggle` reports is checked against the spec. Cases with no button of
their own - the `ToggleEvent` constructor, the popover and dialog methods,
shadow DOM retargeting - run as scripts inside the same page.

```sh
npm install
npx playwright install
npm test
```

There are two projects:

- **WebKit 26.0**, the newest build Playwright ships which has popovers, dialogs
  and `command`/`commandfor` but _not_ `ToggleEvent.source`. The polyfill is the
  only missing piece there, so this is where it is exercised for real.
- **Chromium**, which implements `ToggleEvent.source` itself. As well as running
  the polyfill suites, it runs `native.spec.js`: the same expectations against
  the browser's own implementation. That is what keeps the suite honest, rather
  than only proving the polyfill agrees with itself.

`@playwright/test` is pinned to an exact version on purpose: Playwright 1.59 and
later bundle WebKit 26.4, which has `ToggleEvent.source` natively and would
leave the polyfill untested. `support.spec.js` asserts what each project is
expected to support, so an accidental upgrade fails loudly instead of quietly
testing nothing.

`npm run test:ui` opens Playwright's UI mode.

## Acknowledgements

Extracted from, and designed to work alongside,
[invokers-polyfill](https://github.com/keithamus/invokers-polyfill) by Keith
Cirkel, which polyfills the `command`/`commandfor` attributes themselves and is
MIT licensed.
