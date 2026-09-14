// Notes Manager window and IPC; note mutations are injected from main.js.
const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const {
  registerShortcuts,
  getShortcuts,
  applyOverrides,
} = require("./shortcuts");
const {
  sanitizeWorkspaceName,
  STORE_VERSION,
  normalizeImport,
} = require("../store");

const MAX_TITLE_LENGTH = 80;

function sanitizeTitle(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

function createManagerModule({ store, actions, theme }) {
  let win = null;

  function snapshot() {
    return {
      notes: store.all(),
      workspaces: store.workspaces(),
      activeWorkspace: store.activeWorkspaceId(),
      listScope: store.listScope(),
      theme: store.getTheme(),
      accent: store.getAccent(),
      sidebarOpen: store.isSidebarOpen(),
      effectiveDark: theme ? theme.effectiveDark() : false,
    };
  }

  function notifyChanged() {
    if (win && !win.isDestroyed()) {
      win.webContents.send("manager:notesChanged", snapshot());
    }
  }

  function openManagerWindow(options = {}) {
    const showShortcuts = !!options.showShortcuts;
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      if (showShortcuts) win.webContents.send("manager:showShortcuts");
      return;
    }
    win = new BrowserWindow({
      width: 840,
      height: 640,
      minWidth: 560,
      minHeight: 420,
      title: "Notes Manager",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "manager-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.setMenuBarVisibility(false);
    registerShortcuts(win, {
      newNote: actions.createNote,
      toggleHideAll: actions.toggleHideAll,
      toggleGhostAll: actions.toggleGhostAll,
      openManager: openManagerWindow,
    });
    win.loadFile(path.join(__dirname, "manager.html"));
    win.once("ready-to-show", () => win.show());
    if (showShortcuts) {
      win.webContents.once("did-finish-load", () =>
        win.webContents.send("manager:showShortcuts"),
      );
    }
    win.on("closed", () => {
      win = null;
    });
  }

  ipcMain.handle("manager:list", () => snapshot());
  ipcMain.handle("manager:version", () => app.getVersion());
  ipcMain.handle("manager:shortcuts", () =>
    getShortcuts(store.getShortcutOverrides()),
  );

  ipcMain.handle("manager:setShortcut", (e, payload) => {
    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.accelerator !== "string"
    ) {
      return getShortcuts(store.getShortcutOverrides());
    }
    const cleanAccelerator = payload.accelerator.trim();
    if (!cleanAccelerator) return getShortcuts(store.getShortcutOverrides());

    store.setShortcutOverride(payload.id, cleanAccelerator);
    const overrides = store.getShortcutOverrides();
    applyOverrides(overrides);
    if (actions.onShortcutsUpdated) {
      actions.onShortcutsUpdated(overrides);
    }
    return getShortcuts(overrides);
  });

  ipcMain.handle("manager:resetShortcut", (e, id) => {
    if (typeof id !== "string")
      return getShortcuts(store.getShortcutOverrides());
    store.clearShortcutOverride(id);
    const overrides = store.getShortcutOverrides();
    applyOverrides(overrides);
    if (actions.onShortcutsUpdated) {
      actions.onShortcutsUpdated(overrides);
    }
    return getShortcuts(overrides);
  });

  ipcMain.on("manager:setWorkspace", (e, id) => {
    if (typeof id !== "string") return;
    actions.setActiveWorkspace(id);
  });

  ipcMain.on("manager:setListScope", (e, id) => {
    if (typeof id !== "string") return;
    if (actions.setListScope) actions.setListScope(id);
  });

  ipcMain.on("manager:setSidebarOpen", (e, isOpen) => {
    store.setSidebarOpen(isOpen);
    notifyChanged();
  });

  ipcMain.on("manager:openHelp", () => {
    shell.openExternal("https://github.com/navyabijoy/invisible-notes/issues");
  });

  ipcMain.on("manager:createWorkspace", (e, name) => {
    const clean = sanitizeWorkspaceName(name);
    if (!clean) return;
    actions.createWorkspace(clean);
  });

  ipcMain.on("manager:renameWorkspace", (e, payload) => {
    if (!payload || typeof payload.id !== "string") return;
    const clean = sanitizeWorkspaceName(payload.name);
    if (!clean) return;
    actions.renameWorkspace(payload.id, clean);
  });

  ipcMain.on("manager:moveNote", (e, payload) => {
    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.workspaceId !== "string"
    )
      return;
    actions.moveNoteToWorkspace(payload.id, payload.workspaceId);
  });

  ipcMain.on("manager:setTheme", (e, mode) => {
    if (typeof mode !== "string") return;
    if (actions.setTheme) actions.setTheme(mode);
  });

  ipcMain.on("manager:setAccent", (e, id) => {
    if (typeof id !== "string") return;
    if (actions.setAccent) actions.setAccent(id);
  });

  ipcMain.on("manager:deleteWorkspace", async (e, id) => {
    if (typeof id !== "string") return;
    const workspace = store.getWorkspace(id);
    if (!workspace) return;
    if (store.workspaces().length <= 1) {
      await dialog.showMessageBox(
        BrowserWindow.fromWebContents(e.sender) || undefined,
        {
          type: "info",
          buttons: ["OK"],
          title: "Cannot delete workspace",
          message: "This is your only workspace.",
          detail:
            "Create another workspace first. Ghost Notes always keeps at least one.",
        },
      );
      return;
    }

    const noteCount = store.notesInWorkspace(id).length;
    const plural = noteCount === 1 ? "" : "s";
    const fallback = store.fallbackWorkspaceFor(id);
    const detail =
      noteCount === 0
        ? "This workspace is empty. No notes will be affected."
        : `Its ${noteCount} note${plural} will be moved to "${fallback.name}", not deleted.`;

    const targetWindow = BrowserWindow.fromWebContents(e.sender) || undefined;
    const { response } = await dialog.showMessageBox(targetWindow, {
      type: "warning",
      buttons: ["Cancel", "Delete workspace"],
      defaultId: 0,
      cancelId: 0,
      title: "Delete workspace",
      message: `Delete the workspace "${workspace.name}"?`,
      detail,
    });
    if (response === 1) actions.removeWorkspace(id);
  });

  ipcMain.on("manager:new", () => actions.createNote());

  ipcMain.on("manager:open", (e, id) => {
    if (typeof id !== "string") return;
    actions.showNote(id);
  });

  ipcMain.on("manager:hide", (e, id) => {
    if (typeof id !== "string") return;
    actions.hideNote(id);
  });

  ipcMain.on("manager:rename", (e, payload) => {
    if (!payload || typeof payload.id !== "string") return;
    actions.renameNote(payload.id, sanitizeTitle(payload.title));
  });

  ipcMain.on("manager:delete", async (e, id) => {
    if (typeof id !== "string") return;
    const record = store.get(id);
    if (!record) return;
    const targetWindow = BrowserWindow.fromWebContents(e.sender) || undefined;
    const { response } = await dialog.showMessageBox(targetWindow, {
      type: "warning",
      buttons: ["Cancel", "Delete"],
      defaultId: 0,
      cancelId: 0,
      title: "Delete note",
      message: "Delete this note permanently?",
      detail:
        "This cannot be undone. The note will be removed from this device.",
    });
    if (response === 1) actions.deleteNoteRecord(id);
  });

  function managerWindow() {
    return win && !win.isDestroyed() ? win : undefined;
  }

  ipcMain.handle("manager:export", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(
      managerWindow(),
      {
        title: "Export All Notes",
        defaultPath: `ghost-notes-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Ghost Notes Backup", extensions: ["json"] }],
      },
    );
    if (canceled || !filePath) return { canceled: true };
    const payload = {
      app: "ghost-notes",
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      notes: store.all(),
    };
    try {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(payload, null, 2),
        "utf8",
      );
    } catch (_) {
      dialog.showErrorBox(
        "Could not export notes",
        "Ghost Notes could not write the backup file. Check that the chosen location is writable and try again.",
      );
      return { ok: false };
    }
    return { ok: true, count: payload.notes.length };
  });

  ipcMain.handle("manager:import", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      managerWindow(),
      {
        title: "Import Notes",
        filters: [
          { name: "Ghost Notes Backup", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      },
    );
    if (canceled || !filePaths || filePaths.length === 0)
      return { canceled: true };

    let records = null;
    try {
      const raw = await fs.promises.readFile(filePaths[0], "utf8");
      records = normalizeImport(JSON.parse(raw));
    } catch (_) {
      records = null;
    }
    if (!records) {
      dialog.showErrorBox(
        "Could not import notes",
        "That file is not a valid Ghost Notes backup — it contains no readable notes.",
      );
      return { ok: false };
    }

    const { response } = await dialog.showMessageBox(managerWindow(), {
      type: "question",
      buttons: ["Cancel", "Merge", "Replace"],
      defaultId: 1,
      cancelId: 0,
      title: "Import notes",
      message: `Import ${records.length} note${records.length === 1 ? "" : "s"} from this backup?`,
      detail:
        "Merge keeps your current notes and adds the imported ones (existing notes win on duplicates). " +
        "Replace deletes every current note and restores only the backup.",
    });
    if (response === 0) return { canceled: true };
    return {
      ok: true,
      ...actions.importNotes(records, response === 1 ? "merge" : "replace"),
    };
  });

  return { openManagerWindow, notifyChanged };
}

module.exports = { createManagerModule };
