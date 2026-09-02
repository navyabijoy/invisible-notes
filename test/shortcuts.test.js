const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const platform = require('../platform');
const {
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  shortcutNameForInput,
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
