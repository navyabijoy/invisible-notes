const {
  app,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  nativeTheme,
  dialog,
  powerMonitor,
  safeStorage,
  globalShortcut,
} = require("electron");
const path = require("path");
const { NoteStore, ALL_NOTES_SCOPE } = require("./store");
const { DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT } = require("./note/noteSize");
const platform = require("./platform");
const {
  createNoteWindow,
  applyContentProtection,
} = require("./note/noteWindow");
const { clampToVisibleDisplay, displayIdForPoint } = require("./displayUtils");
const {
  registerShortcuts,
  registerFallbackShortcut,
  unregisterFallbackShortcut,
  getShortcuts,
  applyOverrides,
} = require("./manager/shortcuts");
const { createManagerModule } = require("./manager/manager");

// User-facing save errors; stack traces stay in the console.
let writeErrorShown = false;

// Store and manager are created in app.whenReady() once safeStorage is available.
let store = null;
let manager = null;

// OS-backed encryption for notes.json, or plaintext if the platform cannot encrypt.
function createStoreCodec() {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return {
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (cipher) => safeStorage.decryptString(cipher),
    };
  }
  console.warn(
    "OS-level storage encryption (safeStorage) is unavailable on this system; " +
      "notes will be stored in plaintext.",
  );
  return null;
}

function createStore() {
  return new NoteStore(app.getPath("userData"), {
    codec: createStoreCodec(),
    onCorrupted: () => {
      dialog.showErrorBox(
        "Notes file was reset",
        "Your saved notes file could not be read and looked corrupted, so it was backed up and Ghost Notes started fresh. Your previous notes were not deleted — the backup is in the app data folder if you need to recover them.",
      );
    },
    onWriteError: () => {
      if (writeErrorShown) return;
      writeErrorShown = true;
      dialog.showErrorBox(
        "Could not save notes",
        "Ghost Notes could not write to its data folder. Check that the app has permission to write there and that the disk is not full. Your notes in memory are safe until you quit.",
      );
    },
  });
}

// Open note windows; a stored note can exist with no window (hidden, not deleted).
const noteWindows = new Map(); // id -> BrowserWindow
let tray = null;

// Manager theme is applied here; renderers only receive the resolved dark/light value.
function applyThemeToOS() {
  if (!store) return;
  const mode = store.getTheme();
  nativeTheme.themeSource = mode === "system" ? "system" : mode;
}

function resolveEffectiveDark() {
  return nativeTheme.shouldUseDarkColors;
}

function setThemeMode(mode) {
  if (!store || !manager) return null;
  const clean = store.setTheme(mode);
  applyThemeToOS();
  manager.notifyChanged();
  return clean;
}

function setAccentId(id) {
  if (!store || !manager) return null;
  const clean = store.setAccent(id);
  manager.notifyChanged();
  return clean;
}

function createManager() {
  return createManagerModule({
    store,
    theme: {
      effectiveDark: () => resolveEffectiveDark(),
    },
    actions: {
      showNote: (id) => showNote(id),
      hideNote: (id) => hideNote(id),
      deleteNoteRecord: (id) => deleteNoteRecord(id),
      renameNote: (id, title) => renameNote(id, title),
      createNote: () => createNoteNearCursor(),
      toggleHideAll: () => toggleHideAll(),
      toggleGhostAll: () => toggleGhostAll(),
      setActiveWorkspace: (id) => setActiveWorkspace(id),
      setListScope: (id) => setListScope(id),
      createWorkspace: (name) => createWorkspace(name),
      renameWorkspace: (id, name) => renameWorkspace(id, name),
      removeWorkspace: (id) => removeWorkspace(id),
      moveNoteToWorkspace: (noteId, workspaceId) =>
        moveNoteToWorkspace(noteId, workspaceId),
      importNotes: (records, mode) => importNotes(records, mode),
      setTheme: (mode) => setThemeMode(mode),
      setAccent: (id) => setAccentId(id),
      onShortcutsUpdated: () => {
        unregisterFallbackShortcut(globalShortcut);
        registerFallbackShortcut(globalShortcut, () => createNoteNearCursor());
        updateTrayMenu();
      },
    },
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
      store.update(record.id, {
        x,
        y,
        width,
        height,
        displayId: displayIdForPoint(x, y),
      });
    },
    onClosed: () => {
      noteWindows.delete(record.id);
    },
  });
  registerShortcuts(win, {
    newNote: () => createNoteNearCursor(),
    toggleHideAll: () => toggleHideAll(),
    toggleGhostAll: () => toggleGhostAll(),
    openManager: () => manager.openManagerWindow(),
  });
  noteWindows.set(record.id, win);
  return win;
}

// A note is on screen when it is visible and in the current list scope (workspace or All notes).

function noteBelongsOnScreen(record) {
  if (!record || !record.visible) return false;
  if (store.listScope() === ALL_NOTES_SCOPE) return true;
  return record.workspaceId === store.activeWorkspaceId();
}

function notesInCurrentScope() {
  if (store.listScope() === ALL_NOTES_SCOPE) return store.all();
  return store.notesInWorkspace(store.activeWorkspaceId());
}

function openWindowFor(id) {
  const existing = noteWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.showInactive();
    // Windows may drop capture exclusion after hide(); re-apply it on show.
    applyContentProtection(existing);
    return existing;
  }
  const record = store.get(id);
  if (!record) return null;
  return openNoteWindow(record);
}

// Hide the window without destroying it so workspace switches can reuse it.
function closeWindowFor(id) {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) win.hide();
}

// Show or hide windows to match the current list scope, without changing `visible`.
function applyActiveWorkspace() {
  for (const record of store.all()) {
    if (noteBelongsOnScreen(record)) openWindowFor(record.id);
    else closeWindowFor(record.id);
  }
}

function showNote(id) {
  const record = store.get(id);
  if (!record) return;
  store.update(id, { visible: true });
  if (noteBelongsOnScreen(store.get(id))) openWindowFor(id);
  updateTrayMenu();
  manager.notifyChanged();
}

// Hide a note; the record stays in the store until Notes Manager deletes it.
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

function setActiveWorkspace(id) {
  if (!store.setActiveWorkspace(id)) return;
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
}

function setListScope(id) {
  store.setListScope(id);
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
}

// New workspaces become the active workspace immediately.
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

// Reassign notes from the removed workspace; does not delete those notes.
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
  applyActiveWorkspace();
  updateTrayMenu();
  manager.notifyChanged();
}

function createNoteNearCursor() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const wa = display.workArea;
  const offset = (noteWindows.size % 6) * 26;
  const x = Math.max(
    wa.x,
    Math.min(cursor.x + offset, wa.x + wa.width - DEFAULT_NOTE_WIDTH),
  );
  const y = Math.max(
    wa.y,
    Math.min(cursor.y + offset, wa.y + wa.height - DEFAULT_NOTE_HEIGHT),
  );
  const record = store.create({ x, y, displayId: display.id });
  openNoteWindow(record);
  updateTrayMenu();
  manager.notifyChanged();
  return record.id;
}

// Import notes from a backup, then reconcile windows to the new records.
function importNotes(records, mode) {
  let added = 0;
  let skipped = 0;

  // Map unknown workspace ids onto the active workspace (import does not restore workspaces).
  const workspaceIds = new Set(store.workspaces().map((w) => w.id));
  const fallbackWorkspaceId = store.activeWorkspaceId();
  records = records.map((r) =>
    workspaceIds.has(r.workspaceId)
      ? r
      : { ...r, workspaceId: fallbackWorkspaceId },
  );

  if (mode === "replace") {
    // Destroy windows first so none outlive their records or keep stale content.
    for (const win of noteWindows.values()) {
      if (!win.isDestroyed()) win.destroy();
    }
    noteWindows.clear();
    store.replaceAll(records);
    added = records.length;
  } else {
    // Merge: keep existing notes on duplicate ids and count skipped imports.
    const existingIds = new Set(store.all().map((n) => n.id));
    const fresh = [];
    for (const record of records) {
      if (existingIds.has(record.id)) skipped++;
      else fresh.push(record);
    }
    store.replaceAll([...store.all(), ...fresh]);
    added = fresh.length;
  }

  // Clamp imported notes onto a connected display; already-open notes keep their position.
  for (const record of store.all()) {
    if (noteWindows.has(record.id)) continue;
    const safe = clampToVisibleDisplay({
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
    });
    if (safe.x !== record.x || safe.y !== record.y) {
      store.update(record.id, {
        x: safe.x,
        y: safe.y,
        width: safe.width,
        height: safe.height,
        displayId: safe.displayId,
      });
    }
    if (noteBelongsOnScreen(store.get(record.id) || record))
      openNoteWindow(store.get(record.id));
  }

  updateTrayMenu();
  manager.notifyChanged();
  return { added, skipped };
}

// Hide/show only notes in the current list scope.
function toggleHideAll() {
  const records = notesInCurrentScope();
  const anyVisible = records.some((n) => n.visible);
  for (const record of records) {
    if (anyVisible) hideNote(record.id);
    else showNote(record.id);
  }
}

// Toggle click-through only on notes that currently belong on screen.
function toggleGhostAll() {
  for (const [id, win] of noteWindows) {
    const record = store.get(id);
    if (!record || !noteBelongsOnScreen(record)) continue;
    if (!win.isDestroyed()) win.webContents.send("note:toggleGhost");
  }
}

// Move notes back onto a connected display after monitor or resolution changes.
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

// Re-apply screen-capture exclusion on Windows after sleep, lock, or display changes.
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
ipcMain.on("note:update", (e, payload) => {
  if (!payload || typeof payload.id !== "string") return;
  const { id, text, rich, color, opacity, fontSize, monospace, ghost } =
    payload;
  const patch = {};
  if (typeof text === "string") patch.text = text;
  if (typeof rich === "boolean") patch.rich = rich;
  if (typeof color === "string") patch.color = color;
  if (typeof opacity === "number") patch.opacity = opacity;
  if (typeof fontSize === "number") patch.fontSize = fontSize;
  if (typeof monospace === "boolean") patch.monospace = monospace;
  if (typeof ghost === "boolean") patch.ghost = ghost;
  const record = store.update(id, patch);

  // Ghost mode forces always-on-top so the toolbar stays reachable; pin is restored when it ends.
  if (typeof ghost === "boolean" && record) {
    const win = noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      platform.setPinned(win, ghost ? true : record.pinned !== false);
    }
  }

  manager.notifyChanged();
});

ipcMain.on("note:setIgnoreMouse", (e, { id, ignore }) => {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed())
    win.setIgnoreMouseEvents(!!ignore, { forward: true });
});

ipcMain.on("note:setPinned", (e, { id, pinned }) => {
  if (typeof id !== "string") return;
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) platform.setPinned(win, !!pinned);
  store.update(id, { pinned: !!pinned });
  manager.notifyChanged();
});

ipcMain.handle("note:getState", (e, id) => store.get(id));

ipcMain.on("note:close", (e, id) => hideNote(id));

ipcMain.on("note:new", () => createNoteNearCursor());

function buildTrayIcon() {
  // Full-color tray icon; do not mark as a template image or macOS will strip the color.
  return nativeImage.createFromPath(
    path.join(__dirname, "build", "tray-icon.png"),
  );
}

function noteLabel(record) {
  const snippet = (record.title || record.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  return snippet || "Untitled note";
}

// Tray list of notes in the active workspace, including hidden ones.
function buildNotesSubmenu() {
  const records = store.notesInWorkspace(store.activeWorkspaceId());
  if (records.length === 0)
    return [{ label: "No notes in this workspace", enabled: false }];
  return records.map((record) => ({
    label: `${record.visible ? "●" : "○"} ${noteLabel(record)}`,
    click: () => (record.visible ? hideNote(record.id) : showNote(record.id)),
  }));
}

function buildWorkspaceSubmenu() {
  const activeId = store.activeWorkspaceId();
  return store.workspaces().map((workspace) => ({
    label: `${workspace.name} (${store.notesInWorkspace(workspace.id).length})`,
    type: "radio",
    checked: workspace.id === activeId,
    click: () => setActiveWorkspace(workspace.id),
  }));
}

function updateTrayMenu() {
  if (!tray) return;
  const caveat = platform.captureExclusionCaveat();
  const accelerator = Object.fromEntries(
    getShortcuts().map((s) => [s.id, s.accelerator]),
  );
  const activeWorkspace = store.getWorkspace(store.activeWorkspaceId());
  const menu = Menu.buildFromTemplate([
    {
      label: "New Note",
      accelerator: accelerator.newNote,
      click: () => createNoteNearCursor(),
    },
    {
      label: "Notes Manager…",
      accelerator: accelerator.openManager,
      click: () => manager.openManagerWindow(),
    },
    { type: "separator" },
    {
      label: `Workspace: ${activeWorkspace ? activeWorkspace.name : "(none)"}`,
      enabled: false,
    },
    { label: "Switch Workspace", submenu: buildWorkspaceSubmenu() },
    { label: "Notes", submenu: buildNotesSubmenu() },
    {
      label: "Hide/Show All",
      accelerator: accelerator.toggleHideAll,
      click: () => toggleHideAll(),
    },
    {
      label: "Toggle Click-Through (all)",
      accelerator: accelerator.toggleGhostAll,
      click: () => toggleGhostAll(),
    },
    { type: "separator" },
    {
      label: "Keyboard Shortcuts…",
      click: () => manager.openManagerWindow({ showShortcuts: true }),
    },
    { type: "separator" },
    { label: "Notes are invisible to screen sharing ✓", enabled: false },
    ...(caveat ? [{ label: caveat, enabled: false }] : []),
    { type: "separator" },
    {
      label: `About Ghost Notes (v${app.getVersion()})`,
      click: () => {
        dialog.showMessageBox({
          type: "info",
          title: "About Ghost Notes",
          message: "Ghost Notes",
          detail: `Version ${app.getVersion()}\nPrivate, local sticky notes invisible to screen sharing.`,
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit Ghost Notes",
      accelerator: "CmdOrCtrl+Q",
      click: () => app.quit(),
    },
  ]);
  tray.setContextMenu(menu);
}

function setupTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Ghost Notes");
  updateTrayMenu();
  tray.on("click", () => tray.popUpContextMenu());
}

// One process per store file so a second launch cannot duplicate note windows.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (tray) tray.popUpContextMenu();
  });

  app.whenReady().then(() => {
    platform.hideDockIconIfMac(app);

    store = createStore();
    applyOverrides(store.getShortcutOverrides());
    manager = createManager();
    applyThemeToOS();
    nativeTheme.on("updated", () => {
      if (manager) manager.notifyChanged();
    });

    setupTray();
    registerFallbackShortcut(globalShortcut, () => createNoteNearCursor());

    if (store.all().length === 0) {
      createNoteNearCursor();
    } else {
      applyActiveWorkspace();
    }

    screen.on("display-added", reconcileOpenWindowsAfterSystemChange);
    screen.on("display-removed", reconcileOpenWindowsAfterSystemChange);
    screen.on("display-metrics-changed", reconcileOpenWindowsAfterSystemChange);

    powerMonitor.on("resume", reconcileOpenWindowsAfterSystemChange);
    powerMonitor.on("unlock-screen", reconcileOpenWindowsAfterSystemChange);
  });

  app.on("before-quit", () => {
    store.flush();
  });

  app.on("will-quit", () => {
    unregisterFallbackShortcut(globalShortcut);
  });

  app.on("window-all-closed", () => {});
}
