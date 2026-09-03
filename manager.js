// Notes Manager: the only place a note record can be permanently deleted.
// Owns its own BrowserWindow (singleton) and IPC surface; note lifecycle
// actions (show/hide/delete/rename) are injected so this module never
// touches the store directly — main.js stays the single source of truth.
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { registerShortcuts, getShortcuts } = require('./shortcuts');
const { sanitizeWorkspaceName } = require('./store');

const MAX_TITLE_LENGTH = 80;

function sanitizeTitle(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function createManagerModule({ store, actions }) {
  let win = null;

  // One payload for both the initial load and every update, so the renderer
  // always sees notes and workspaces from the same consistent snapshot. A
  // note can never render against a workspace list that doesn't contain it.
  function snapshot() {
    return {
      notes: store.all(),
      workspaces: store.workspaces(),
      activeWorkspace: store.activeWorkspaceId()
    };
  }

  function notifyChanged() {
    if (win && !win.isDestroyed()) {
      win.webContents.send('manager:notesChanged', snapshot());
    }
  }

  // `showShortcuts` opens the window straight onto the shortcut legend — the
  // tray's "Keyboard Shortcuts…" item. Also called as a plain click/shortcut
  // handler, which passes an event object with no such property, so anything
  // that isn't an explicit request just opens the note list as before.
  function openManagerWindow(options = {}) {
    const showShortcuts = !!options.showShortcuts;
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      if (showShortcuts) win.webContents.send('manager:showShortcuts');
      return;
    }
    win = new BrowserWindow({
      width: 420,
      height: 580,
      minWidth: 340,
      minHeight: 360,
      title: 'Notes Manager',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'manager-preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    win.setMenuBarVisibility(false);
    registerShortcuts(win, {
      newNote: actions.createNote,
      toggleHideAll: actions.toggleHideAll,
      toggleGhostAll: actions.toggleGhostAll,
      openManager: openManagerWindow
    });
    win.loadFile('manager.html');
    win.once('ready-to-show', () => win.show());
    // did-finish-load rather than ready-to-show: the renderer has to have run
    // its scripts before it can be listening for this.
    if (showShortcuts) {
      win.webContents.once('did-finish-load', () => win.webContents.send('manager:showShortcuts'));
    }
    win.on('closed', () => {
      win = null;
    });
  }

  ipcMain.handle('manager:list', () => snapshot());
  ipcMain.handle('manager:version', () => app.getVersion());
  ipcMain.handle('manager:shortcuts', () => getShortcuts());

  // ---------- Workspaces (issue #8) ----------
  ipcMain.on('manager:setWorkspace', (e, id) => {
    if (typeof id !== 'string') return;
    actions.setActiveWorkspace(id);
  });

  ipcMain.on('manager:createWorkspace', (e, name) => {
    const clean = sanitizeWorkspaceName(name);
    if (!clean) return;
    actions.createWorkspace(clean);
  });

  ipcMain.on('manager:renameWorkspace', (e, payload) => {
    if (!payload || typeof payload.id !== 'string') return;
    const clean = sanitizeWorkspaceName(payload.name);
    if (!clean) return;
    actions.renameWorkspace(payload.id, clean);
  });

  ipcMain.on('manager:moveNote', (e, payload) => {
    if (!payload || typeof payload.id !== 'string' || typeof payload.workspaceId !== 'string') return;
    actions.moveNoteToWorkspace(payload.id, payload.workspaceId);
  });

  // Deleting a workspace never deletes notes, it reassigns them. The
  // confirmation says so explicitly, and names the count, so the user is
  // never guessing what happens to the notes inside.
  ipcMain.on('manager:deleteWorkspace', async (e, id) => {
    if (typeof id !== 'string') return;
    const workspace = store.getWorkspace(id);
    if (!workspace) return;
    if (store.workspaces().length <= 1) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender) || undefined, {
        type: 'info',
        buttons: ['OK'],
        title: 'Cannot delete workspace',
        message: 'This is your only workspace.',
        detail: 'Create another workspace first. Ghost Notes always keeps at least one.'
      });
      return;
    }

    const noteCount = store.notesInWorkspace(id).length;
    const plural = noteCount === 1 ? '' : 's';
    // Name the workspace the notes will actually land in. Hardcoding
    // "Default" is wrong once that workspace has been renamed or deleted.
    const fallback = store.fallbackWorkspaceFor(id);
    const detail = noteCount === 0
      ? 'This workspace is empty. No notes will be affected.'
      : `Its ${noteCount} note${plural} will be moved to "${fallback.name}", not deleted.`;

    const targetWindow = BrowserWindow.fromWebContents(e.sender) || undefined;
    const { response } = await dialog.showMessageBox(targetWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Delete workspace'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete workspace',
      message: `Delete the workspace "${workspace.name}"?`,
      detail
    });
    if (response === 1) actions.removeWorkspace(id);
  });

  ipcMain.on('manager:new', () => actions.createNote());

  ipcMain.on('manager:open', (e, id) => {
    if (typeof id !== 'string') return;
    actions.showNote(id);
  });

  ipcMain.on('manager:hide', (e, id) => {
    if (typeof id !== 'string') return;
    actions.hideNote(id);
  });

  ipcMain.on('manager:rename', (e, payload) => {
    if (!payload || typeof payload.id !== 'string') return;
    actions.renameNote(payload.id, sanitizeTitle(payload.title));
  });

  ipcMain.on('manager:delete', async (e, id) => {
    if (typeof id !== 'string') return;
    const record = store.get(id);
    if (!record) return;
    const targetWindow = BrowserWindow.fromWebContents(e.sender) || undefined;
    const { response } = await dialog.showMessageBox(targetWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete note',
      message: 'Delete this note permanently?',
      detail: 'This cannot be undone. The note will be removed from this device.'
    });
    if (response === 1) actions.deleteNoteRecord(id);
  });

  return { openManagerWindow, notifyChanged };
}

module.exports = { createManagerModule };
