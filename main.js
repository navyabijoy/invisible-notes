const {
  app,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  dialog,
  powerMonitor,
  safeStorage,
  globalShortcut
} = require('electron');
const path = require('path');
const { NoteStore, DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT } = require('./store');
const platform = require('./platform');
const { createNoteWindow, applyContentProtection } = require('./noteWindow');
const { clampToVisibleDisplay, displayIdForPoint } = require('./displayUtils');
const {
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  getShortcuts
} = require('./shortcuts');
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
      createNote: () => createNoteNearCursor(),
      toggleHideAll: () => toggleHideAll(),
      toggleGhostAll: () => toggleGhostAll(),
      setActiveWorkspace: (id) => setActiveWorkspace(id),
      createWorkspace: (name) => createWorkspace(name),
      renameWorkspace: (id, name) => renameWorkspace(id, name),
      removeWorkspace: (id) => removeWorkspace(id),
      moveNoteToWorkspace: (noteId, workspaceId) => moveNoteToWorkspace(noteId, workspaceId),
      importNotes: (records, mode) => importNotes(records, mode)
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
  registerShortcuts(win, {
    newNote: () => createNoteNearCursor(),
    toggleHideAll: () => toggleHideAll(),
    toggleGhostAll: () => toggleGhostAll(),
    openManager: () => manager.openManagerWindow()
  });
  noteWindows.set(record.id, win);
  return win;
}

// ---------- Window vs. record (issue #8) ----------
//
// A note is on screen when BOTH are true:
//
//     record.visible === true            (the user's own show/hide choice)
//     record.workspaceId === active      (its workspace is the one selected)
//
// The two are deliberately independent. openWindowFor/closeWindowFor touch
// only the window, so switching workspaces can pull notes off screen and put
// them back without ever rewriting `visible`. Otherwise, leaving 2 of 5 notes
// open, switching away and switching back would return all 5, silently
// destroying the user's per-note choices on every switch.
//
// showNote/hideNote are the record-writing pair, used when the user really
// does mean "show/hide this note" (the X button, the tray, the manager).

function openWindowFor(id) {
  const existing = noteWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.showInactive();
    // Re-apply capture exclusion: some Electron versions on Windows clear the
    // SetWindowDisplayAffinity flag when a window is hidden via win.hide().
    applyContentProtection(existing);
    return existing;
  }
  const record = store.get(id);
  if (!record) return null;
  return openNoteWindow(record);
}

// Pull a note off screen without touching its record. Intentionally
// hide() and not close()/destroy(), because the window is reused when its
// workspace comes back, which keeps the switch instant.
function closeWindowFor(id) {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.hide();
}

// Reconcile every window against the active workspace. Doubles as the
// startup path: notes that are visible in the active workspace get windows,
// everything else stays off screen with its `visible` flag intact.
function applyActiveWorkspace() {
  const activeId = store.activeWorkspaceId();
  for (const record of store.all()) {
    if (record.visible && record.workspaceId === activeId) openWindowFor(record.id);
    else closeWindowFor(record.id);
  }
}

function showNote(id) {
  const record = store.get(id);
  if (!record) return;
  store.update(id, { visible: true });
  // Only notes in the active workspace get a window; a note shown while
  // another workspace is selected stays marked visible and appears as soon
  // as its workspace is selected again.
  if (record.workspaceId === store.activeWorkspaceId()) openWindowFor(id);
  updateTrayMenu();
  manager.notifyChanged();
}

// The note's X button calls this via IPC. It hides the window; the record
// (and its content) stays in the store untouched. This is intentionally
// NOT window.close()/destroy() — only Notes Manager delete removes a record.
function hideNote(id) {
  closeWindowFor(id);
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

// ---------- Workspaces ----------
function setActiveWorkspace(id) {
  if (!store.setActiveWorkspace(id)) return;
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
}

// Creating a workspace switches to it, because the user just named the context
// they want to work in, so landing them somewhere else would be surprising.
function createWorkspace(name) {
  const workspace = store.createWorkspace(name);
  setActiveWorkspace(workspace.id);
  return workspace;
}

function renameWorkspace(id, name) {
  store.renameWorkspace(id, name);
  updateTrayMenu();
  manager.notifyChanged();
}

// Notes in the removed workspace are reassigned, never deleted (see
// NoteStore.removeWorkspace). Returns the store's result so the caller can
// tell the user how many notes moved.
function removeWorkspace(id) {
  const result = store.removeWorkspace(id);
  if (!result) return null;
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
  return result;
}

function moveNoteToWorkspace(noteId, workspaceId) {
  if (!store.moveNote(noteId, workspaceId)) return;
  // The note may have just moved out of (or into) the active workspace, so
  // its window has to follow, without disturbing its `visible` flag.
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
}

function createNoteNearCursor() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const wa = display.workArea;
  // Cascade a little so stacked notes don't perfectly overlap.
  const offset = (noteWindows.size % 6) * 26;
  const x = Math.min(cursor.x, wa.x + wa.width - (DEFAULT_NOTE_WIDTH + 20)) + offset;
  const y = Math.min(cursor.y, wa.y + wa.height - (DEFAULT_NOTE_HEIGHT + 20)) + offset;
  const record = store.create({ x, y, displayId: display.id });
  openNoteWindow(record);
  updateTrayMenu();
  manager.notifyChanged();
  return record.id;
}

// Scoped to the active workspace, because "hide all" should never reach into a
// workspace the user isn't looking at and rewrite its notes' visibility.
// Import (backup restore / migration). The store mutation is bulk; the
// delicate part is reconciling note windows to the new record set.
function importNotes(records, mode) {
  let added = 0;
  let skipped = 0;

  // Imported records can carry workspaceIds from the backup that don't exist
  // locally (import doesn't restore workspaces). Those notes would become
  // unreachable — the manager filters by active workspace — so remap any
  // unknown id onto the active workspace before saving.
  const workspaceIds = new Set(store.workspaces().map((w) => w.id));
  const fallbackWorkspaceId = store.activeWorkspaceId();
  records = records.map((r) => (workspaceIds.has(r.workspaceId) ? r : { ...r, workspaceId: fallbackWorkspaceId }));

  if (mode === 'replace') {
    // Close every note window first so no window outlives its record — and
    // no window keeps stale content for an imported record that happens to
    // reuse an existing id. They are reopened fresh from the new store below.
    for (const win of noteWindows.values()) {
      if (!win.isDestroyed()) win.destroy();
    }
    noteWindows.clear();
    store.replaceAll(records);
    added = records.length;
  } else {
    // Merge: existing notes win on duplicate ids, imported duplicates are
    // counted so the manager can report how many were skipped.
    const existingIds = new Set(store.all().map((n) => n.id));
    const fresh = [];
    for (const record of records) {
      if (existingIds.has(record.id)) skipped++;
      else fresh.push(record);
    }
    store.replaceAll([...store.all(), ...fresh]);
    added = fresh.length;
  }

  // Records without a window are the imported ones. Their saved positions
  // may belong to monitors that don't exist on this machine, so clamp them
  // onto a visible display before showing them (same recovery the app uses
  // at startup after display changes). On-screen notes keep their exact
  // exported position and timestamps.
  for (const record of store.all()) {
    if (noteWindows.has(record.id)) continue;
    const safe = clampToVisibleDisplay({ x: record.x, y: record.y, width: record.width, height: record.height });
    if (safe.x !== record.x || safe.y !== record.y) {
      store.update(record.id, { x: safe.x, y: safe.y, width: safe.width, height: safe.height, displayId: safe.displayId });
    }
    if (record.visible && record.workspaceId === store.activeWorkspaceId()) openNoteWindow(store.get(record.id));
  }

  updateTrayMenu();
  manager.notifyChanged();
  return { added, skipped };
}

function toggleHideAll() {
  const records = store.notesInWorkspace(store.activeWorkspaceId());
  const anyVisible = records.some((n) => n.visible);
  for (const record of records) {
    if (anyVisible) hideNote(record.id);
    else showNote(record.id);
  }
}

// Also scoped to the active workspace. Windows for other workspaces are
// hidden rather than destroyed, so an unscoped loop would silently flip
// click-through on notes the user can't even see.
function toggleGhostAll() {
  const activeId = store.activeWorkspaceId();
  for (const [id, win] of noteWindows) {
    const record = store.get(id);
    if (!record || record.workspaceId !== activeId) continue;
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

// On Windows, SetWindowDisplayAffinity can be silently dropped after sleep,
// screen lock, or display topology changes. Re-apply to every open note window.
function reapplyContentProtectionToOpenWindows() {
  if (!platform.isWindows) return;
  for (const win of noteWindows.values()) {
    applyContentProtection(win);
  }
}

function reconcileOpenWindowsAfterSystemChange() {
  reconcileOpenWindowsToDisplays();
  reapplyContentProtectionToOpenWindows();
}

// ---------- IPC from renderer ----------
ipcMain.on('note:update', (e, payload) => {
  if (!payload || typeof payload.id !== 'string') return;
  const { id, text, color, opacity, fontSize, monospace, ghost } = payload;
  const patch = {};
  if (typeof text === 'string') patch.text = text;
  if (typeof color === 'string') patch.color = color;
  if (typeof opacity === 'number') patch.opacity = opacity;
  if (typeof fontSize === 'number') patch.fontSize = fontSize;
  if (typeof monospace === 'boolean') patch.monospace = monospace;
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

// Lists the active workspace's records, open or hidden, so a hidden note is
// never stranded. Notes in other workspaces are reachable by switching to
// that workspace from the Workspace submenu.
function buildNotesSubmenu() {
  const records = store.notesInWorkspace(store.activeWorkspaceId());
  if (records.length === 0) return [{ label: 'No notes in this workspace', enabled: false }];
  return records.map((record) => ({
    label: `${record.visible ? '●' : '○'} ${noteLabel(record)}`,
    click: () => (record.visible ? hideNote(record.id) : showNote(record.id))
  }));
}

// Radio items so the active workspace is unambiguous at a glance; the note
// count makes it obvious where notes went after a switch.
function buildWorkspaceSubmenu() {
  const activeId = store.activeWorkspaceId();
  return store.workspaces().map((workspace) => ({
    label: `${workspace.name} (${store.notesInWorkspace(workspace.id).length})`,
    type: 'radio',
    checked: workspace.id === activeId,
    click: () => setActiveWorkspace(workspace.id)
  }));
}

function updateTrayMenu() {
  if (!tray) return;
  const caveat = platform.captureExclusionCaveat();
  // Accelerators come from the shortcut definitions rather than being spelled
  // out again here, so the tray can never advertise a binding the app has
  // stopped answering to.
  const accelerator = Object.fromEntries(getShortcuts().map((s) => [s.id, s.accelerator]));
  const activeWorkspace = store.getWorkspace(store.activeWorkspaceId());
  const menu = Menu.buildFromTemplate([
    { label: 'New Note', accelerator: accelerator.newNote, click: () => createNoteNearCursor() },
    { label: 'Notes Manager…', accelerator: accelerator.openManager, click: () => manager.openManagerWindow() },
    { type: 'separator' },
    { label: `Workspace: ${activeWorkspace ? activeWorkspace.name : '(none)'}`, enabled: false },
    { label: 'Switch Workspace', submenu: buildWorkspaceSubmenu() },
    { label: 'Notes', submenu: buildNotesSubmenu() },
    { label: 'Hide/Show All', accelerator: accelerator.toggleHideAll, click: () => toggleHideAll() },
    { label: 'Toggle Click-Through (all)', accelerator: accelerator.toggleGhostAll, click: () => toggleGhostAll() },
    { type: 'separator' },
    {
      label: 'Keyboard Shortcuts…',
      click: () => manager.openManagerWindow({ showShortcuts: true })
    },
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
    registerFallbackShortcut(globalShortcut, () => createNoteNearCursor());

    if (store.all().length === 0) {
      createNoteNearCursor();
    } else {
      // Restores exactly the notes that are visible AND in the active
      // workspace, which is the same rule that governs a workspace switch.
      applyActiveWorkspace();
    }

    registerShortcuts({
      newNote: () => createNoteNearCursor(),
      toggleHideAll: () => toggleHideAll(),
      toggleGhostAll: () => toggleGhostAll(),
      openManager: () => manager.openManagerWindow()
    });

    screen.on('display-added', reconcileOpenWindowsAfterSystemChange);
    screen.on('display-removed', reconcileOpenWindowsAfterSystemChange);
    screen.on('display-metrics-changed', reconcileOpenWindowsAfterSystemChange);

    // Waking from sleep can silently change the connected-display set before
    // the OS fires its own display events — re-check note positions either way.
    powerMonitor.on('resume', reconcileOpenWindowsAfterSystemChange);
    powerMonitor.on('unlock-screen', reconcileOpenWindowsAfterSystemChange);
  });

  app.on('before-quit', () => {
    store.flush();
  });

  app.on('will-quit', () => {
    unregisterFallbackShortcut(globalShortcut);
  });

  // Keep running with no visible windows (tray app).
  app.on('window-all-closed', () => {});
}
