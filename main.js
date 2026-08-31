const { app, ipcMain, screen, Tray, Menu, nativeImage, dialog, powerMonitor, safeStorage } = require('electron');
const path = require('path');
const { NoteStore } = require('./store');
const platform = require('./platform');
const { createNoteWindow, applyContentProtection } = require('./noteWindow');
const { clampToVisibleDisplay, displayIdForPoint } = require('./displayUtils');
const { registerShortcuts, unregisterAll } = require('./shortcuts');
const { createManagerModule } = require('./manager');

// Show plain-language notices only — never a raw stack trace to the user.
let writeErrorShown = false;

// The store is created lazily inside app.whenReady(): NoteStore reads/writes
// notes.json synchronously at construction, but safeStorage — which we use to
// encrypt notes at rest — is only guaranteed to be available after the app is
// ready. `store`/`manager` are hoisted as `let` and assigned there; every
// function that touches them is invoked from the ready lifecycle or IPC, both
// of which run only after app is ready.
let store = null;
let manager = null;

// Build the encryption codec used by NoteStore to protect notes.json at rest.
// safeStorage leverages OS-level encryption (Keychain on macOS, DPAPI on
// Windows) keyed to the current OS user. We only enable it when the platform
// actually supports it; otherwise we fall back to plaintext with a warning.
function createStoreCodec() {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return {
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (cipher) => safeStorage.decryptString(cipher)
    };
  }
  console.warn(
    'OS-level storage encryption (safeStorage) is unavailable on this system; ' +
      'notes will be stored in plaintext.'
  );
  return null;
}

function createStore() {
  return new NoteStore(app.getPath('userData'), {
    codec: createStoreCodec(),
    onCorrupted: () => {
      dialog.showErrorBox(
        'Notes file was reset',
        'Your saved notes file could not be read and looked corrupted, so it was backed up and Ghost Notes started fresh. Your previous notes were not deleted — the backup is in the app data folder if you need to recover them.'
      );
    },
    onWriteError: () => {
      if (writeErrorShown) return;
      writeErrorShown = true;
      dialog.showErrorBox(
        'Could not save notes',
        'Ghost Notes could not write to its data folder. Check that the app has permission to write there and that the disk is not full. Your notes in memory are safe until you quit.'
      );
    }
  });
}

// Open BrowserWindows only — a subset of store records. A record can exist
// (and be listed in the future Notes Manager) with no entry here at all,
// which is exactly the "closed but not deleted" state the X button needs.
const noteWindows = new Map(); // id -> BrowserWindow
let tray = null;

// createManagerModule registers IPC handlers that only act once a renderer
// sends a message, so it can be created lazily after app is ready alongside
// `store` (which createManagerModule closes over). See createStore() above.
function createManager() {
  return createManagerModule({
    store,
    actions: {
      showNote: (id) => showNote(id),
      hideNote: (id) => hideNote(id),
      deleteNoteRecord: (id) => deleteNoteRecord(id),
      renameNote: (id, title) => renameNote(id, title),
      createNote: () => createNoteNearCursor()
    }
  });
}

function openNoteWindow(record) {
  const win = createNoteWindow(record, {
    onMoved: (w) => {
      const [x, y] = w.getPosition();
      store.update(record.id, { x, y, displayId: displayIdForPoint(x, y) });
    },
    onResized: (w) => {
      const [x, y] = w.getPosition();
      const [width, height] = w.getSize();
      store.update(record.id, { x, y, width, height, displayId: displayIdForPoint(x, y) });
    },
    onClosed: () => {
      noteWindows.delete(record.id);
    }
  });
  noteWindows.set(record.id, win);
  return win;
}

function showNote(id) {
  const existing = noteWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.showInactive();
    // Re-apply capture exclusion: some Electron versions on Windows clear the
    // SetWindowDisplayAffinity flag when a window is hidden via win.hide().
    applyContentProtection(existing);
  } else {
    const record = store.get(id);
    if (!record) return;
    openNoteWindow(record);
  }
  store.update(id, { visible: true });
  updateTrayMenu();
  manager.notifyChanged();
}

// The note's X button calls this via IPC. It hides the window; the record
// (and its content) stays in the store untouched. This is intentionally
// NOT window.close()/destroy() — only Notes Manager delete removes a record.
function hideNote(id) {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.hide();
  store.update(id, { visible: false });
  updateTrayMenu();
  manager.notifyChanged();
}

function deleteNoteRecord(id) {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.destroy();
  noteWindows.delete(id);
  store.remove(id);
  updateTrayMenu();
  manager.notifyChanged();
}

function renameNote(id, title) {
  store.update(id, { title });
  updateTrayMenu();
  manager.notifyChanged();
}

function createNoteNearCursor() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const wa = display.workArea;
  // Cascade a little so stacked notes don't perfectly overlap.
  const offset = (noteWindows.size % 6) * 26;
  const x = Math.min(cursor.x, wa.x + wa.width - 320) + offset;
  const y = Math.min(cursor.y, wa.y + wa.height - 240) + offset;
  const record = store.create({ x, y, displayId: display.id });
  openNoteWindow(record);
  updateTrayMenu();
  manager.notifyChanged();
  return record.id;
}

function toggleHideAll() {
  const anyVisible = store.all().some((n) => n.visible);
  for (const record of store.all()) {
    if (anyVisible) hideNote(record.id);
    else showNote(record.id);
  }
}

function toggleGhostAll() {
  for (const win of noteWindows.values()) {
    if (!win.isDestroyed()) win.webContents.send('note:toggleGhost');
  }
}

// Recover notes whose saved position is no longer on any connected display
// (monitor unplugged, resolution/DPI changed, etc.) instead of leaving them
// permanently unreachable.
function reconcileOpenWindowsToDisplays() {
  for (const [id, win] of noteWindows) {
    if (win.isDestroyed()) continue;
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    const safe = clampToVisibleDisplay({ x, y, width, height });
    if (safe.x !== x || safe.y !== y) {
      win.setBounds({ x: safe.x, y: safe.y, width, height });
      store.update(id, { x: safe.x, y: safe.y, displayId: safe.displayId });
    }
  }
}

// ---------- IPC from renderer ----------
ipcMain.on('note:update', (e, payload) => {
  if (!payload || typeof payload.id !== 'string') return;
  const { id, text, color, opacity, fontSize, ghost } = payload;
  const patch = {};
  if (typeof text === 'string') patch.text = text;
  if (typeof color === 'string') patch.color = color;
  if (typeof opacity === 'number') patch.opacity = opacity;
  if (typeof fontSize === 'number') patch.fontSize = fontSize;
  if (typeof ghost === 'boolean') patch.ghost = ghost;
  const record = store.update(id, patch);

  // Click-through mode only works if you can still reach the note to turn
  // it back off (hover the toolbar) or drag it. If an unpinned note were
  // covered by another window while click-through, there'd be no way to
  // reach it at all — so force always-on-top while ghosted, regardless of
  // the pin preference, and restore that preference when ghost turns off.
  if (typeof ghost === 'boolean' && record) {
    const win = noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      platform.setPinned(win, ghost ? true : record.pinned !== false);
    }
  }

  manager.notifyChanged();
});

ipcMain.on('note:setIgnoreMouse', (e, { id, ignore }) => {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});

ipcMain.on('note:setPinned', (e, { id, pinned }) => {
  if (typeof id !== 'string') return;
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) platform.setPinned(win, !!pinned);
  store.update(id, { pinned: !!pinned });
  manager.notifyChanged();
});

ipcMain.handle('note:getState', (e, id) => store.get(id));

ipcMain.on('note:close', (e, id) => hideNote(id));

ipcMain.on('note:new', () => createNoteNearCursor());

// ---------- Tray ----------
function buildTrayIcon() {
  // @2x file supplies the retina variant automatically (Electron/macOS
  // convention: same base name + "@2x" in the same folder).
  // This is a full-color logo (purple/white ghost), not a monochrome
  // silhouette, so it must NOT be marked as a template image — macOS
  // template mode discards color and uses alpha as a mask, which turns
  // any non-monochrome glyph into a solid blob.
  return nativeImage.createFromPath(path.join(__dirname, 'build', 'tray-icon.png'));
}

function noteLabel(record) {
  const snippet = (record.title || record.text || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return snippet || 'Untitled note';
}

// Stopgap until the full Notes Manager window (step 2) exists: lists every
// saved record, open or hidden, so a hidden note is never actually stranded.
function buildNotesSubmenu() {
  const records = store.all();
  if (records.length === 0) return [{ label: 'No notes yet', enabled: false }];
  return records.map((record) => ({
    label: `${record.visible ? '●' : '○'} ${noteLabel(record)}`,
    click: () => (record.visible ? hideNote(record.id) : showNote(record.id))
  }));
}

function updateTrayMenu() {
  if (!tray) return;
  const caveat = platform.captureExclusionCaveat();
  const menu = Menu.buildFromTemplate([
    { label: 'New Note', accelerator: 'CmdOrCtrl+Shift+N', click: () => createNoteNearCursor() },
    { label: 'Notes Manager…', accelerator: 'CmdOrCtrl+Shift+M', click: () => manager.openManagerWindow() },
    { label: 'Notes', submenu: buildNotesSubmenu() },
    { label: 'Hide/Show All', accelerator: 'CmdOrCtrl+Shift+H', click: () => toggleHideAll() },
    { label: 'Toggle Click-Through (all)', accelerator: 'CmdOrCtrl+Shift+G', click: () => toggleGhostAll() },
    { type: 'separator' },
    { label: 'Notes are invisible to screen sharing ✓', enabled: false },
    ...(caveat ? [{ label: caveat, enabled: false }] : []),
    { type: 'separator' },
    {
      label: `About Ghost Notes (v${app.getVersion()})`,
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'About Ghost Notes',
          message: 'Ghost Notes',
          detail: `Version ${app.getVersion()}\nPrivate, local sticky notes invisible to screen sharing.`
        });
      }
    },
    { type: 'separator' },
    { label: 'Quit Ghost Notes', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

function setupTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('Ghost Notes');
  updateTrayMenu();
  tray.on('click', () => tray.popUpContextMenu());
}

// ---------- App lifecycle ----------
// Single instance: prevent a second launch from spawning duplicate note
// windows on top of the same store file.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (tray) tray.popUpContextMenu();
  });

  app.whenReady().then(() => {
    platform.hideDockIconIfMac(app);

    // safeStorage is only guaranteed available after the app is ready, so this
    // is the earliest safe point to construct the (synchronous) store and wire
    // up the manager that depends on it.
    store = createStore();
    manager = createManager();

    setupTray();

    const records = store.all();
    if (records.length === 0) {
      createNoteNearCursor();
    } else {
      for (const record of records) {
        if (record.visible) openNoteWindow(record);
      }
    }

    registerShortcuts({
      newNote: () => createNoteNearCursor(),
      toggleHideAll: () => toggleHideAll(),
      toggleGhostAll: () => toggleGhostAll(),
      openManager: () => manager.openManagerWindow()
    });

    screen.on('display-added', reconcileOpenWindowsToDisplays);
    screen.on('display-removed', reconcileOpenWindowsToDisplays);
    screen.on('display-metrics-changed', reconcileOpenWindowsToDisplays);

    // Waking from sleep can silently change the connected-display set before
    // the OS fires its own display events — re-check note positions either way.
    powerMonitor.on('resume', reconcileOpenWindowsToDisplays);
    powerMonitor.on('unlock-screen', reconcileOpenWindowsToDisplays);
  });

  app.on('before-quit', () => {
    store.flush();
  });

  app.on('will-quit', () => {
    unregisterAll();
  });

  // Keep running with no visible windows (tray app).
  app.on('window-all-closed', () => {});
}
