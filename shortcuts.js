// App-scoped shortcuts. Listening on a Ghost Notes window's webContents keeps
// these bindings inactive while another app has focus, so common shortcuts
// such as Cmd+Shift+N remain available to browsers and IDEs.
const platform = require('./platform');

const BINDINGS = {
  newNote: 'CommandOrControl+Shift+N',
  toggleHideAll: 'CommandOrControl+Shift+H',
  toggleGhostAll: 'CommandOrControl+Shift+G',
  openManager: 'CommandOrControl+Shift+M'
};

const FALLBACK_BINDING = 'CommandOrControl+Alt+Shift+N';

const ACTION_BY_KEY = {
  n: 'newNote',
  h: 'toggleHideAll',
  g: 'toggleGhostAll',
  m: 'openManager'
};

const ACTION_BY_CODE = Object.fromEntries(
  Object.entries(ACTION_BY_KEY).map(([key, action]) => [`Key${key.toUpperCase()}`, action])
);

function shortcutNameForInput(input) {
  if (!input || input.type !== 'keyDown' || input.isAutoRepeat) return null;
  if (!platform.isCommandOrControlPressed(input) || !input.shift || input.alt) return null;
  if (input.code) return ACTION_BY_CODE[input.code] || null;
  return ACTION_BY_KEY[String(input.key || '').toLowerCase()] || null;
}

function registerShortcuts(win, actions) {
  win.webContents.on('before-input-event', (event, input) => {
    const name = shortcutNameForInput(input);
    const handler = name && actions[name];
    if (!handler) return;
    event.preventDefault();
    handler();
  });
}

function registerFallbackShortcut(globalShortcut, handler) {
  const registered = globalShortcut.register(FALLBACK_BINDING, handler);
  if (!registered) {
    console.warn(`Fallback shortcut ${FALLBACK_BINDING} could not be registered — likely in use by another app.`);
  }
  return registered;
}

function unregisterFallbackShortcut(globalShortcut) {
  globalShortcut.unregister(FALLBACK_BINDING);
}

module.exports = {
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  shortcutNameForInput,
  BINDINGS,
  FALLBACK_BINDING
};
