// Shortcuts that apply while a Ghost Notes window is focused.
const platform = require("../platform");

// Shared shortcut list for matching, tray accelerators, and the in-app legend.
const SHORTCUTS = [
  {
    id: "newNote",
    scope: "app",
    accelerator: "CommandOrControl+Shift+N",
    label: "New note",
    description: "Drops a fresh note next to the cursor.",
  },
  {
    id: "openManager",
    scope: "app",
    accelerator: "CommandOrControl+Shift+M",
    label: "Notes Manager",
    description: "Every note you have saved, open or hidden.",
  },
  {
    id: "toggleHideAll",
    scope: "app",
    accelerator: "CommandOrControl+Shift+H",
    label: "Hide / show all notes",
    description:
      "Hiding keeps the contents — notes reopen exactly where they were.",
  },
  {
    id: "toggleGhostAll",
    scope: "app",
    accelerator: "CommandOrControl+Shift+G",
    label: "Toggle click-through",
    description:
      "Clicks pass straight through your notes. Hover a note bar to interact again.",
  },
  {
    id: "newNoteAnywhere",
    scope: "global",
    accelerator: "CommandOrControl+Alt+Shift+N",
    label: "New note from anywhere",
    description:
      "The only shortcut that works while another app has focus, so a new note is always reachable.",
  },
];

const GLOBAL_SHORTCUT = SHORTCUTS.find(
  (shortcut) => shortcut.scope === "global",
);

const FALLBACK_BINDING = GLOBAL_SHORTCUT.accelerator;

let activeOverrides = {};

function resolveShortcuts(overrides = activeOverrides) {
  return SHORTCUTS.map((shortcut) => {
    const accelerator = overrides[shortcut.id] || shortcut.accelerator;
    return {
      ...shortcut,
      accelerator,
      defaultAccelerator: shortcut.accelerator,
      isCustom: Boolean(
        overrides[shortcut.id] &&
        overrides[shortcut.id] !== shortcut.accelerator,
      ),
    };
  });
}

let BINDINGS = Object.fromEntries(
  resolveShortcuts()
    .filter((s) => s.scope === "app")
    .map((s) => [s.id, s.accelerator]),
);

function keyOf(accelerator) {
  const parts = accelerator.split("+");
  return parts[parts.length - 1];
}

let ACTION_BY_KEY = {};
let ACTION_BY_CODE = {};

function buildLookupTables(overrides = activeOverrides) {
  const appShortcuts = resolveShortcuts(overrides).filter(
    (s) => s.scope === "app",
  );
  ACTION_BY_KEY = Object.fromEntries(
    appShortcuts.map((s) => [keyOf(s.accelerator).toLowerCase(), s.id]),
  );
  ACTION_BY_CODE = Object.fromEntries(
    appShortcuts.map((s) => [`Key${keyOf(s.accelerator).toUpperCase()}`, s.id]),
  );
  BINDINGS = Object.fromEntries(appShortcuts.map((s) => [s.id, s.accelerator]));
}

buildLookupTables();

function applyOverrides(overrides = {}) {
  activeOverrides = { ...overrides };
  buildLookupTables(activeOverrides);
}

function getShortcuts(overrides = activeOverrides) {
  return resolveShortcuts(overrides).map((shortcut) => ({
    ...shortcut,
    display: platform.formatAccelerator(shortcut.accelerator),
  }));
}

function shortcutNameForInput(input) {
  if (!input || input.type !== "keyDown" || input.isAutoRepeat) return null;
  if (!platform.isCommandOrControlPressed(input) || !input.shift || input.alt)
    return null;
  if (input.code) return ACTION_BY_CODE[input.code] || null;
  return ACTION_BY_KEY[String(input.key || "").toLowerCase()] || null;
}

function registerShortcuts(win, actions) {
  win.webContents.on("before-input-event", (event, input) => {
    const name = shortcutNameForInput(input);
    const handler = name && actions[name];
    if (!handler) return;
    event.preventDefault();
    handler();
  });
}

function registerFallbackShortcut(globalShortcut, handler, customBinding) {
  const binding =
    customBinding || activeOverrides[GLOBAL_SHORTCUT.id] || FALLBACK_BINDING;
  const registered = globalShortcut.register(binding, handler);
  if (!registered) {
    console.warn(
      `Fallback shortcut ${binding} could not be registered — likely in use by another app.`,
    );
  }
  return registered;
}

function unregisterFallbackShortcut(globalShortcut, customBinding) {
  const binding =
    customBinding || activeOverrides[GLOBAL_SHORTCUT.id] || FALLBACK_BINDING;
  globalShortcut.unregister(binding);
}

module.exports = {
  SHORTCUTS,
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  shortcutNameForInput,
  getShortcuts,
  applyOverrides,
  get BINDINGS() {
    return BINDINGS;
  },
  FALLBACK_BINDING,
};
