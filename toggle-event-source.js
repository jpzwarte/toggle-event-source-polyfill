// Polyfill for `ToggleEvent.source`: the element which caused a popover or
// `<dialog>` to be shown or hidden.
//
// The `toggle`/`beforetoggle` events themselves are dispatched by the browser,
// so this polyfill records the element responsible for a state change right
// before the change happens, then hands it to the event during the capture
// phase - which runs before any listener on the popover/dialog itself.

const ELEMENT_NODE = 1;

const NativeToggleEvent = globalThis.ToggleEvent;

// event -> source element (or null)
const eventSources = new WeakMap();
// popover/dialog -> { source, newState, activation } for the state change which
// is about to happen
const pendingSources = new WeakMap();
const observedRoots = new WeakSet();

let applied = false;
// The click event currently being dispatched, if it activated an invoker.
let clickActivation = null;

function isElement(node) {
  return Boolean(node) && node.nodeType === ELEMENT_NODE;
}

function getRootNode(node) {
  if (node && typeof node.getRootNode === "function") {
    return node.getRootNode();
  }
  if (node && node.parentNode) return getRootNode(node.parentNode);
  return node;
}

// Node returning IDL attributes are retargeted against the tree the event is
// being observed in, so a source inside a shadow tree is reported as its host.
function retarget(source, event) {
  if (!isElement(source)) return null;
  const sourceRoot = getRootNode(source);
  if (sourceRoot !== getRootNode(event.target || document)) {
    return sourceRoot.host || null;
  }
  return source;
}

function isPopoverOpen(element) {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

function isDialogOpen(element) {
  return element.localName === "dialog" && element.hasAttribute("open");
}

class ToggleEvent extends (NativeToggleEvent || Event) {
  constructor(type, toggleEventInit = {}) {
    super(type, toggleEventInit);
    const { source } = toggleEventInit;
    if (source != null && !isElement(source)) {
      throw new TypeError(`source must be an element`);
    }
    eventSources.set(this, source || null);
    if (!NativeToggleEvent) {
      const { oldState = "", newState = "" } = toggleEventInit;
      Object.defineProperties(this, {
        oldState: { value: String(oldState), enumerable: true },
        newState: { value: String(newState), enumerable: true },
      });
    }
  }

  get [Symbol.toStringTag]() {
    return "ToggleEvent";
  }
}

// Events dispatched by the browser are instances of the native class, so
// `instanceof` has to keep working for those too.
if (NativeToggleEvent) {
  Object.defineProperty(ToggleEvent, Symbol.hasInstance, {
    configurable: true,
    value: (value) => value instanceof NativeToggleEvent,
  });
}

function setEventSource(event, source) {
  eventSources.set(event, source);
  // Events which aren't instances of the `ToggleEvent` we patched (for example
  // ones dispatched by a popover polyfill) don't inherit the `source` getter.
  if (!("source" in event)) {
    Object.defineProperty(event, "source", {
      enumerable: true,
      configurable: true,
      get() {
        return retarget(eventSources.get(event) || null, event);
      },
    });
  }
}

function handleToggleEvent(event) {
  const pending = pendingSources.get(event.target);
  if (!pending) return;
  // A state change we didn't predict isn't the one we recorded a source for.
  if (event.newState !== pending.newState) return;
  if (event.type === "toggle") pendingSources.delete(event.target);
  if (!pending.source) return;
  setEventSource(event, pending.source);
}

function observeRootOf(element) {
  const root = getRootNode(element);
  if (!root || observedRoots.has(root)) return;
  if (typeof root.addEventListener !== "function") return;
  observedRoots.add(root);
  root.addEventListener("beforetoggle", handleToggleEvent, true);
  root.addEventListener("toggle", handleToggleEvent, true);
}

function setPendingSource(element, source, newState) {
  if (!isElement(element)) return () => {};
  const existing = pendingSources.get(element);
  // `hidePopover()` and the `<dialog>` methods carry no source of their own.
  // When one of them is called while an invoker click is being dispatched -
  // which is how a `command`/`commandfor` polyfill drives them - it is that
  // click, not the sourceless call, which describes the state change.
  if (
    !isElement(source) &&
    existing &&
    existing.source &&
    existing.newState === newState &&
    clickActivation !== null &&
    existing.activation === clickActivation
  ) {
    return () => {};
  }
  const pending = {
    source: isElement(source) ? source : null,
    newState,
    activation: clickActivation,
  };
  pendingSources.set(element, pending);
  observeRootOf(element);
  return () => {
    if (pendingSources.get(element) === pending) pendingSources.delete(element);
  };
}

function patchMethod(prototype, name, getPending) {
  const method = prototype && prototype[name];
  if (typeof method !== "function") return;
  Object.defineProperty(prototype, name, {
    ...Object.getOwnPropertyDescriptor(prototype, name),
    value: function (...args) {
      const { source, newState } = getPending.call(this, args);
      const undo = setPendingSource(this, source, newState);
      try {
        return method.apply(this, args);
      } catch (error) {
        undo();
        throw error;
      }
    },
  });
}

function patchPopoverMethods() {
  const prototype = globalThis.HTMLElement && HTMLElement.prototype;
  if (!prototype || typeof prototype.showPopover !== "function") return;

  patchMethod(prototype, "showPopover", function ([options]) {
    return { source: options && options.source, newState: "open" };
  });

  // `hidePopover()` is specified to always hide with a null source.
  patchMethod(prototype, "hidePopover", function () {
    return { source: null, newState: "closed" };
  });

  patchMethod(prototype, "togglePopover", function ([options]) {
    const dictionary = typeof options === "object" && options ? options : null;
    const force = typeof options === "boolean" ? options : dictionary?.force;
    const willShow = force == null ? !isPopoverOpen(this) : Boolean(force);
    return {
      // Only the showing branch of `togglePopover()` carries a source.
      source: willShow && dictionary ? dictionary.source : null,
      newState: willShow ? "open" : "closed",
    };
  });
}

function patchDialogMethods() {
  const prototype = globalThis.HTMLDialogElement && HTMLDialogElement.prototype;
  if (!prototype) return;
  // None of these take a source; they are patched so a state change they cause
  // isn't attributed to an invoker which is no longer responsible for it.
  for (const [name, newState] of [
    ["show", "open"],
    ["showModal", "open"],
    ["close", "closed"],
    ["requestClose", "closed"],
  ]) {
    patchMethod(prototype, name, () => ({ source: null, newState }));
  }
}

function recordActivationSource(element, source, newState, possible) {
  const pending = pendingSources.get(element);
  if (pending) {
    // Something already performed the state change during this click - most
    // likely a `command`/`commandfor` or popover polyfill acting on the button
    // before this listener ran. It is recorded, it just has no source yet.
    if (!pending.source) {
      pending.source = source;
      return;
    }
    // Or it recorded this same source itself, via `showPopover({ source })`.
    if (pending.source === source) return;
  }
  if (possible) setPendingSource(element, source, newState);
}

function recordCommandSource(target, command, source) {
  switch (command) {
    case "show-popover":
      if (target.popover) {
        recordActivationSource(target, source, "open", !isPopoverOpen(target));
      }
      break;
    case "hide-popover":
      if (target.popover) {
        recordActivationSource(target, source, "closed", isPopoverOpen(target));
      }
      break;
    case "toggle-popover":
      if (target.popover) {
        const open = isPopoverOpen(target);
        recordActivationSource(target, source, open ? "closed" : "open", true);
      }
      break;
    case "show-modal":
      if (target.localName === "dialog") {
        recordActivationSource(target, source, "open", !isDialogOpen(target));
      }
      break;
    case "close":
    case "request-close":
      if (target.localName === "dialog") {
        recordActivationSource(target, source, "closed", isDialogOpen(target));
      }
      break;
  }
}

function recordInvokerSource(node) {
  if (node.localName !== "button" && node.localName !== "input") return false;

  const commandFor = node.commandForElement;
  const command = typeof node.command === "string" ? node.command : "";
  if (commandFor && command) {
    recordCommandSource(commandFor, command.toLowerCase(), node);
    return true;
  }

  const popover = node.popoverTargetElement;
  if (popover) {
    const action = String(node.popoverTargetAction || "toggle").toLowerCase();
    const open = isPopoverOpen(popover);
    const possible = (action !== "show" || !open) && (action !== "hide" || open);
    recordActivationSource(popover, node, open ? "closed" : "open", possible);
    return true;
  }

  return false;
}

// Both `command`/`commandfor` and `popovertarget` buttons act on their target
// after the click event has finished dispatching, so recording the source
// during the capture phase is early enough.
function handleClick(event) {
  if (event.type !== "click" || event.defaultPrevented) return;
  const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  clickActivation = event;
  let activated = false;
  for (const node of path) {
    // Only the innermost button/input can be the activation target.
    if (isElement(node) && recordInvokerSource(node)) {
      activated = true;
      break;
    }
  }
  if (!activated) {
    clickActivation = null;
    return;
  }
  // A polyfill driving this click acts on the target synchronously, so the
  // activation only needs to outlive the current task.
  setTimeout(() => {
    if (clickActivation === event) clickActivation = null;
  }, 0);
}

function observeShadowRoots(ElementClass, callback) {
  const attachShadow = ElementClass.prototype.attachShadow;
  ElementClass.prototype.attachShadow = function (init) {
    const shadow = attachShadow.call(this, init);
    callback(shadow);
    return shadow;
  };
  const attachInternals = ElementClass.prototype.attachInternals;
  if (typeof attachInternals !== "function") return;
  ElementClass.prototype.attachInternals = function () {
    const internals = attachInternals.call(this);
    if (internals.shadowRoot) callback(internals.shadowRoot);
    return internals;
  };
}

export function isSupported() {
  return (
    typeof globalThis.ToggleEvent !== "undefined" && "source" in globalThis.ToggleEvent.prototype
  );
}

export function isPolyfilled() {
  return Boolean(globalThis.ToggleEvent) && !/native code/i.test(String(globalThis.ToggleEvent));
}

export function apply() {
  if (applied) return;
  applied = true;

  Object.defineProperty((NativeToggleEvent || ToggleEvent).prototype, "source", {
    enumerable: true,
    configurable: true,
    get() {
      return retarget(eventSources.get(this) || null, this);
    },
  });

  patchPopoverMethods();
  patchDialogMethods();

  document.addEventListener("click", handleClick, true);
  observeRootOf(document);

  observeShadowRoots(HTMLElement, (shadow) => {
    shadow.addEventListener("click", handleClick, true);
    observeRootOf(shadow);
  });

  Object.assign(globalThis, { ToggleEvent });
}
