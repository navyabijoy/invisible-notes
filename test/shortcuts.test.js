const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const platform = require('../platform');
const {
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  shortcutNameForInput,
  getShortcuts,
  BINDINGS,
  FALLBACK_BINDING
} = require('../shortcuts');

function shortcutInput(key, overrides = {}) {
  return {
    type: 'keyDown',
    key,
    code: `Key${key.toUpperCase()}`,
    shift: true,
    alt: false,
    control: !platform.isMac,
    meta: platform.isMac,
    isAutoRepeat: false,
    ...overrides
  };
}

test('recognizes app shortcuts with the platform modifier', () => {
  assert.equal(shortcutNameForInput(shortcutInput('N')), 'newNote');
  assert.equal(shortcutNameForInput(shortcutInput('h')), 'toggleHideAll');
  assert.equal(shortcutNameForInput(shortcutInput('G')), 'toggleGhostAll');
  assert.equal(shortcutNameForInput(shortcutInput('m')), 'openManager');
});

test('uses physical key codes across keyboard layouts and falls back when unavailable', () => {
  assert.equal(shortcutNameForInput(shortcutInput('т', { code: 'KeyN' })), 'newNote');
  assert.equal(shortcutNameForInput(shortcutInput('n', { code: 'KeyQ' })), null);
  assert.equal(shortcutNameForInput(shortcutInput('n', { code: '' })), 'newNote');
});

test('ignores incomplete, modified, repeated, and key-up input', () => {
  assert.equal(shortcutNameForInput(shortcutInput('n', { shift: false })), null);
  assert.equal(shortcutNameForInput(shortcutInput('n', { alt: true })), null);
  assert.equal(shortcutNameForInput(shortcutInput('n', platform.isMac ? { control: true } : { meta: true })), null);
  assert.equal(shortcutNameForInput(shortcutInput('n', { isAutoRepeat: true })), null);
  assert.equal(shortcutNameForInput(shortcutInput('n', { type: 'keyUp' })), null);
});

test('handles shortcuts only through the registered Ghost Notes window', () => {
  const webContents = new EventEmitter();
  let newNotes = 0;
  registerShortcuts({ webContents }, { newNote: () => newNotes++ });

  let prevented = false;
  webContents.emit(
    'before-input-event',
    { preventDefault: () => { prevented = true; } },
    shortcutInput('n')
  );

  assert.equal(newNotes, 1);
  assert.equal(prevented, true);
});

test('registers and unregisters the global recovery shortcut', () => {
  let registeredBinding = null;
  let registeredHandler = null;
  let unregisteredBinding = null;
  const globalShortcut = {
    register: (binding, handler) => {
      registeredBinding = binding;
      registeredHandler = handler;
      return true;
    },
    unregister: (binding) => {
      unregisteredBinding = binding;
    }
  };
  let newNotes = 0;

  assert.equal(registerFallbackShortcut(globalShortcut, () => newNotes++), true);
  assert.equal(registeredBinding, FALLBACK_BINDING);
  registeredHandler();
  assert.equal(newNotes, 1);

  unregisterFallbackShortcut(globalShortcut);
  assert.equal(unregisteredBinding, FALLBACK_BINDING);
});

// The legend, the tray menu and the matcher all read from one definition list.
// These guard the derivation, so a shortcut can never be displayed somewhere
// as a binding the app does not actually answer to.
// Builds the key event a user pressing this accelerator would actually
// produce, so the assertion below tests the accelerator as written rather
// than restating what the matcher already assumes.
function inputForAccelerator(accelerator) {
  const parts = accelerator.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  const primary = modifiers.includes('CommandOrControl');
  return {
    type: 'keyDown',
    key,
    code: `Key${key.toUpperCase()}`,
    shift: modifiers.includes('Shift'),
    alt: modifiers.includes('Alt'),
    control: primary && !platform.isMac,
    meta: primary && platform.isMac,
    isAutoRepeat: false
  };
}

test('every app-scoped shortcut in the legend is one the matcher recognizes', () => {
  const appShortcuts = getShortcuts().filter((s) => s.scope === 'app');
  assert.ok(appShortcuts.length > 0);

  for (const shortcut of appShortcuts) {
    assert.equal(
      shortcutNameForInput(inputForAccelerator(shortcut.accelerator)),
      shortcut.id,
      `${shortcut.label} is listed as ${shortcut.accelerator} but the matcher does not answer to it`
    );
    assert.equal(shortcut.accelerator, BINDINGS[shortcut.id]);
  }
});

test('the legend describes every shortcut and formats it for this platform', () => {
  for (const shortcut of getShortcuts()) {
    assert.ok(shortcut.label, `${shortcut.id} has no label`);
    assert.ok(shortcut.description, `${shortcut.id} has no description`);
    assert.equal(shortcut.display, platform.formatAccelerator(shortcut.accelerator));
    assert.ok(!shortcut.display.includes('CommandOrControl'), 'display string is not human-readable');
  }
});

test('the legend lists the global recovery shortcut alongside the app ones', () => {
  const global = getShortcuts().filter((s) => s.scope === 'global');
  assert.equal(global.length, 1);
  assert.equal(global[0].accelerator, FALLBACK_BINDING);
});

test('formats accelerators the way this platform writes them', () => {
  assert.equal(
    platform.formatAccelerator('CommandOrControl+Shift+N'),
    platform.isMac ? '⇧⌘N' : 'Ctrl+Shift+N'
  );
  // macOS orders modifiers ctrl-opt-shift-cmd regardless of how the
  // accelerator was written; Windows keeps the written order.
  assert.equal(
    platform.formatAccelerator('CommandOrControl+Alt+Shift+N'),
    platform.isMac ? '⌥⇧⌘N' : 'Ctrl+Alt+Shift+N'
  );
  assert.equal(platform.formatAccelerator(''), '');
});
