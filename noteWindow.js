// Builds the BrowserWindow for a single note record. Pure window-creation
// concerns live here; note *lifecycle* (what happens on move/resize/close)
// is wired by the caller via callbacks, so this module has no knowledge of
// the store.
const path = require('path');
const { BrowserWindow } = require('electron');
const platform = require('./platform');
const { clampToVisibleDisplay } = require('./displayUtils');

// Apply (or re-apply) screen-capture exclusion on a window.
// On Windows, some Electron versions clear the SetWindowDisplayAffinity flag
// when the window is hidden via win.hide(), or when the system sleeps, locks,
// or reinitializes the display. This helper is called:
//   1. At window creation (inside 'ready-to-show', so the HWND fully exists)
//   2. Every time a hidden note is shown again (see main.js showNote)
//   3. On window show/restore events (Windows only, see createNoteWindow)
//   4. After sleep/unlock/display changes (see main.js reconcileOpenWindowsAfterSystemChange)
function applyContentProtection(win) {
  if (!win || win.isDestroyed()) return;
  win.setContentProtection(true);
}

function createNoteWindow(record, { onMoved, onResized, onClosed } = {}) {
  const bounds = clampToVisibleDisplay(record);

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    // Keep the hover toolbar fully visible (issue #24). 160px clipped New/Close.
    minWidth: 280,
    minHeight: 120,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  platform.setPinned(win, record.pinned !== false);

  // Defense-in-depth: re-apply capture exclusion whenever Windows shows or
  // restores a note window (e.g. after minimize/restore or OS-driven show).
  if (platform.isWindows) {
    win.on('show', () => applyContentProtection(win));
    win.on('restore', () => applyContentProtection(win));
  }

  win.loadFile('note.html', { query: { id: record.id } });

  // Defer content-protection and show until 'ready-to-show' so the native
  // window handle (HWND on Windows) is fully realized. Calling
  // setContentProtection before the handle exists silently fails on Windows.
  win.once('ready-to-show', () => {
    applyContentProtection(win);
    if (record.visible !== false) win.showInactive();
  });

  if (onMoved) win.on('moved', () => onMoved(win));
  if (onResized) win.on('resized', () => onResized(win));
  if (onClosed) win.on('closed', () => onClosed());

  return win;
}

module.exports = { createNoteWindow, applyContentProtection };
