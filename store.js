// Versioned JSON store for note records, independent of open windows.
const fs = require("fs");
const path = require("path");

const STORE_VERSION = 7;

const {
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
} = require("./note/noteSize");

// Stable id used when migrating notes; any workspace can still be deleted except the last one.
const DEFAULT_WORKSPACE_ID = "ws-default";
const DEFAULT_WORKSPACE_NAME = "Default";
const MAX_WORKSPACE_NAME_LENGTH = 40;

const THEME_MODES = ["light", "dark", "system"];
const DEFAULT_THEME = "system";
const ACCENT_IDS = ["violet", "blue", "green", "orange", "pink"];
const DEFAULT_ACCENT = "violet";

// List-scope sentinel for every note; new notes still land in the active workspace.
const ALL_NOTES_SCOPE = "__all__";

function sanitizeTheme(input) {
  return THEME_MODES.includes(input) ? input : DEFAULT_THEME;
}

function sanitizeAccent(input) {
  return ACCENT_IDS.includes(input) ? input : DEFAULT_ACCENT;
}

function sanitizeListScope(value, workspaceIds, activeId) {
  if (value === ALL_NOTES_SCOPE) {
    return workspaceIds.size > 1 ? ALL_NOTES_SCOPE : activeId;
  }
  if (typeof value === "string" && workspaceIds.has(value)) return value;
  return activeId;
}

function sanitizeShortcutOverrides(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [id, accelerator] of Object.entries(input)) {
    if (typeof id !== "string" || typeof accelerator !== "string") continue;
    const clean = accelerator.trim();
    if (clean) out[id] = clean;
  }
  return out;
}

function nextId() {
  return (
    "note-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function nextWorkspaceId() {
  return (
    "ws-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function sanitizeWorkspaceName(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, MAX_WORKSPACE_NAME_LENGTH);
}

function defaultWorkspace(overrides = {}) {
  const id = typeof overrides.id === "string" ? overrides.id.trim() : "";
  return {
    id: id || nextWorkspaceId(),
    name: sanitizeWorkspaceName(overrides.name) || "Untitled workspace",
    createdAt: overrides.createdAt || Date.now(),
  };
}

function defaultRecord(overrides = {}) {
  const now = overrides.createdAt || Date.now();
  return {
    id: overrides.id || nextId(),
    title: overrides.title || "",
    text: overrides.text || "",
    color: overrides.color || "yellow",
    x: overrides.x,
    y: overrides.y,
    width: overrides.width || DEFAULT_NOTE_WIDTH,
    height: overrides.height || DEFAULT_NOTE_HEIGHT,
    displayId: overrides.displayId ?? null,
    opacity: typeof overrides.opacity === "number" ? overrides.opacity : 0.85,
    fontSize: overrides.fontSize || 15,
    monospace: !!overrides.monospace,
    rich: !!overrides.rich,
    // Filenames (not paths) of pasted images living in userData/note-images.
    images: Array.isArray(overrides.images) ? overrides.images : [],
    // Which workspace this note belongs to (issue #8). Independent of
    // `visible`. See the note on effective visibility below.
    workspaceId: overrides.workspaceId || DEFAULT_WORKSPACE_ID,
    ghost: !!overrides.ghost,
    visible: overrides.visible !== undefined ? !!overrides.visible : true,
    pinned: overrides.pinned !== undefined ? !!overrides.pinned : true,
    createdAt: now,
    updatedAt: overrides.updatedAt || now,
  };
}

// Destination for notes whose workspace is missing or being removed.
function pickFallbackWorkspace(workspaces, excludeId) {
  const remaining =
    excludeId === undefined
      ? workspaces
      : workspaces.filter((w) => w.id !== excludeId);
  return (
    remaining.find((w) => w.id === DEFAULT_WORKSPACE_ID) || remaining[0] || null
  );
}

function emptyStore() {
  const workspace = defaultWorkspace({
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
  });
  return {
    version: STORE_VERSION,
    settings: {
      activeWorkspace: workspace.id,
      listScope: workspace.id,
      theme: DEFAULT_THEME,
      accent: DEFAULT_ACCENT,
      sidebarOpen: false,
      shortcuts: {},
    },
    workspaces: [workspace],
    notes: [],
  };
}

// Keep at least one workspace, valid membership, and a valid active/list scope.
function normalizeWorkspaces(data) {
  const seenIds = new Set();
  let workspaces = [];
  for (const entry of Array.isArray(data.workspaces) ? data.workspaces : []) {
    if (!entry || typeof entry !== "object") continue;
    const workspace = defaultWorkspace(entry);
    if (seenIds.has(workspace.id)) continue;
    seenIds.add(workspace.id);
    workspaces.push(workspace);
  }

  if (workspaces.length === 0) {
    workspaces = [
      defaultWorkspace({
        id: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME,
      }),
    ];
  }

  const ids = new Set(workspaces.map((w) => w.id));
  const fallbackId = pickFallbackWorkspace(workspaces).id;

  const notes = data.notes.map((n) => ({
    ...n,
    workspaceId: ids.has(n.workspaceId) ? n.workspaceId : fallbackId,
  }));

  const requested = data.settings?.activeWorkspace;
  const activeId = ids.has(requested) ? requested : fallbackId;
  return {
    version: STORE_VERSION,
    settings: {
      ...data.settings,
      activeWorkspace: activeId,
      listScope: sanitizeListScope(data.settings?.listScope, ids, activeId),
      theme: sanitizeTheme(data.settings?.theme),
      accent: sanitizeAccent(data.settings?.accent),
      sidebarOpen:
        typeof data.settings?.sidebarOpen === "boolean"
          ? data.settings.sidebarOpen
          : false,
      shortcuts: sanitizeShortcutOverrides(data.settings?.shortcuts),
    },
    workspaces,
    notes,
  };
}

// Upgrade older notes.json schemas to the current store version.
function migrate(data) {
  if (!data || typeof data !== "object") return emptyStore();
  if (!Array.isArray(data.notes)) return emptyStore();

  const sourceNotes = data.notes.filter((n) => n && typeof n === "object");

  let notes;
  if (!data.version) {
    notes = sourceNotes.map((n) =>
      defaultRecord({ ...n, visible: true, pinned: true }),
    );
  } else if (data.version === 2) {
    notes = sourceNotes.map((n) => ({
      ...n,
      pinned: n.pinned !== undefined ? !!n.pinned : true,
      monospace: !!n.monospace,
    }));
  } else if (data.version === 3 || data.version === 4 || data.version === 5) {
    notes = sourceNotes.map((n) => ({ ...n, monospace: !!n.monospace }));
  } else {
    notes = sourceNotes;
  }

  // v7 adds `images`; backfill it on every migration path.
  notes = notes.map((n) => ({
    ...n,
    images: Array.isArray(n.images) ? n.images : [],
  }));

  return normalizeWorkspaces({ ...data, notes });
}

// Coerce a backup payload into current-schema records, or null if it is not a notes file.
function normalizeImport(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.notes))
    return null;
  if (
    data.notes.length === 0 &&
    data.app !== "ghost-notes" &&
    !Number.isFinite(data.version)
  )
    return null;
  const seen = new Set();
  const notes = [];
  for (const entry of migrate(data).notes) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rawCreatedAt = entry.createdAt;
    const rawUpdatedAt = entry.updatedAt;
    const record = defaultRecord(entry);
    if (Number.isFinite(rawCreatedAt)) record.createdAt = rawCreatedAt;
    if (Number.isFinite(rawUpdatedAt)) record.updatedAt = rawUpdatedAt;
    if (typeof record.id !== "string" || !record.id) record.id = nextId();
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    if (typeof record.title !== "string") record.title = "";
    if (typeof record.text !== "string") record.text = "";
    if (typeof record.color !== "string") record.color = "yellow";
    if (
      !Number.isFinite(record.opacity) ||
      record.opacity <= 0 ||
      record.opacity > 1
    )
      record.opacity = 0.85;
    if (!Number.isFinite(record.fontSize)) record.fontSize = 15;
    if (!Number.isFinite(record.width)) record.width = DEFAULT_NOTE_WIDTH;
    else if (record.width < MIN_NOTE_WIDTH) record.width = MIN_NOTE_WIDTH;
    if (!Number.isFinite(record.height)) record.height = DEFAULT_NOTE_HEIGHT;
    else if (record.height < MIN_NOTE_HEIGHT) record.height = MIN_NOTE_HEIGHT;
    if (!Number.isFinite(record.x)) record.x = undefined;
    if (!Number.isFinite(record.y)) record.y = undefined;
    if (!Number.isFinite(record.createdAt)) record.createdAt = Date.now();
    if (!Number.isFinite(record.updatedAt)) record.updatedAt = record.createdAt;
    notes.push(record);
  }
  return notes;
}

class NoteStore {
  constructor(userDataPath, { onCorrupted, onWriteError, codec } = {}) {
    this.filePath = path.join(userDataPath, "notes.json");
    this.tmpPath = this.filePath + ".tmp";
    this.backupPath = this.filePath + ".corrupt";
    this.onCorrupted = onCorrupted;
    this.onWriteError = onWriteError;
    this.codec = codec || null;
    const { data, migrated } = this._load();
    this.data = data;
    this._saveTimer = null;
    if (migrated && this.codec) {
      this._writeNow();
    }
  }

  _load() {
    let raw;
    try {
      raw = fs.readFileSync(this.filePath);
    } catch (_) {
      return { data: emptyStore(), migrated: false };
    }

    if (this.codec) {
      try {
        const plain = this.codec.decrypt(raw);
        let parsed = null;
        try {
          parsed = JSON.parse(plain);
        } catch (_) {}
        if (parsed) {
          return { data: this._parseAndMigrate(parsed, raw), migrated: false };
        }
      } catch (_) {
        // Fall through to plaintext for files saved before encryption.
      }
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch (_) {
      return { data: this._corrupt(raw), migrated: false };
    }
    return { data: this._parseAndMigrate(parsed, raw), migrated: !!this.codec };
  }

  _parseAndMigrate(parsed, raw) {
    if (!parsed || parsed.version !== STORE_VERSION) {
      try {
        fs.writeFileSync(
          this.filePath + `.pre-migration-v${(parsed && parsed.version) || 1}`,
          raw,
        );
      } catch (_) {}
    }
    return migrate(parsed);
  }

  _corrupt(raw) {
    try {
      fs.writeFileSync(this.backupPath, raw);
    } catch (_) {}
    console.error("notes.json was corrupted, backed up to", this.backupPath);
    if (this.onCorrupted) this.onCorrupted(this.backupPath);
    return emptyStore();
  }

  _writeNow() {
    let out;
    if (this.codec) {
      out = this.codec.encrypt(JSON.stringify(this.data));
    } else {
      out = Buffer.from(JSON.stringify(this.data, null, 2), "utf8");
    }
    try {
      fs.writeFileSync(this.tmpPath, out);
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (e) {
      console.error("Failed to save notes:", e);
      if (this.onWriteError) this.onWriteError(e);
    }
  }

  save() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._writeNow();
    }, 250);
  }

  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._writeNow();
  }

  all() {
    return this.data.notes;
  }

  get(id) {
    return this.data.notes.find((n) => n.id === id) || null;
  }

  create(overrides = {}) {
    const record = defaultRecord({
      workspaceId: this.activeWorkspaceId(),
      ...overrides,
    });
    this.data.notes.push(record);
    this.save();
    return record;
  }

  update(id, patch) {
    const record = this.get(id);
    if (!record) return null;
    Object.assign(record, patch, { updatedAt: Date.now() });
    this.save();
    return record;
  }

  remove(id) {
    const idx = this.data.notes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.data.notes.splice(idx, 1);
    this.save();
    return true;
  }

  settings() {
    return this.data.settings;
  }

  getShortcutOverrides() {
    return this.data.settings?.shortcuts || {};
  }

  setShortcutOverride(id, accelerator) {
    if (typeof id !== "string" || typeof accelerator !== "string") {
      return this.getShortcutOverrides();
    }
    const clean = accelerator.trim();
    if (!clean) return this.getShortcutOverrides();
    if (!this.data.settings.shortcuts) this.data.settings.shortcuts = {};
    this.data.settings.shortcuts[id] = clean;
    this.save();
    return this.data.settings.shortcuts;
  }

  clearShortcutOverride(id) {
    if (this.data.settings?.shortcuts && id in this.data.settings.shortcuts) {
      delete this.data.settings.shortcuts[id];
      this.save();
    }
    return this.data.settings?.shortcuts || {};
  }

  getTheme() {
    return sanitizeTheme(this.data.settings.theme);
  }

  setTheme(mode) {
    const clean = sanitizeTheme(mode);
    if (this.data.settings.theme === clean) return clean;
    this.data.settings.theme = clean;
    this.save();
    return clean;
  }

  getAccent() {
    return sanitizeAccent(this.data.settings.accent);
  }

  setAccent(id) {
    const clean = sanitizeAccent(id);
    if (this.data.settings.accent === clean) return clean;
    this.data.settings.accent = clean;
    this.save();
    return clean;
  }

  workspaces() {
    return this.data.workspaces;
  }

  getWorkspace(id) {
    return this.data.workspaces.find((w) => w.id === id) || null;
  }

  activeWorkspaceId() {
    return this.data.settings.activeWorkspace;
  }

  notesInWorkspace(workspaceId) {
    return this.data.notes.filter((n) => n.workspaceId === workspaceId);
  }

  setActiveWorkspace(id) {
    if (!this.getWorkspace(id)) return null;
    this.data.settings.activeWorkspace = id;
    this.data.settings.listScope = id;
    this.save();
    return id;
  }

  listScope() {
    return this.data.settings.listScope || this.activeWorkspaceId();
  }

  setListScope(id) {
    const ids = new Set(this.data.workspaces.map((w) => w.id));
    const clean = sanitizeListScope(id, ids, this.activeWorkspaceId());
    if (this.data.settings.listScope === clean) return clean;
    this.data.settings.listScope = clean;
    this.save();
    return clean;
  }

  isSidebarOpen() {
    return !!this.data.settings.sidebarOpen;
  }

  setSidebarOpen(value) {
    if (this.data.settings.sidebarOpen === !!value) return;
    this.data.settings.sidebarOpen = !!value;
    this.save();
  }

  createWorkspace(name) {
    const workspace = defaultWorkspace({ name });
    this.data.workspaces.push(workspace);
    this.save();
    return workspace;
  }

  renameWorkspace(id, name) {
    const workspace = this.getWorkspace(id);
    if (!workspace) return null;
    const clean = sanitizeWorkspaceName(name);
    if (!clean) return workspace;
    workspace.name = clean;
    this.save();
    return workspace;
  }

  fallbackWorkspaceFor(id) {
    if (this.data.workspaces.length <= 1) return null;
    return pickFallbackWorkspace(this.data.workspaces, id);
  }

  removeWorkspace(id) {
    if (this.data.workspaces.length <= 1) return null;
    const idx = this.data.workspaces.findIndex((w) => w.id === id);
    if (idx === -1) return null;

    const fallback = pickFallbackWorkspace(this.data.workspaces, id);

    let movedCount = 0;
    for (const note of this.data.notes) {
      if (note.workspaceId === id) {
        note.workspaceId = fallback.id;
        movedCount++;
      }
    }

    this.data.workspaces.splice(idx, 1);
    if (this.data.settings.activeWorkspace === id) {
      this.data.settings.activeWorkspace = fallback.id;
    }
    if (
      this.data.settings.listScope === id ||
      this.data.workspaces.length <= 1
    ) {
      this.data.settings.listScope = this.data.settings.activeWorkspace;
    }
    this.save();
    return { movedCount, fallbackId: fallback.id };
  }

  moveNote(noteId, workspaceId) {
    const record = this.get(noteId);
    if (!record || !this.getWorkspace(workspaceId)) return null;
    record.workspaceId = workspaceId;
    record.updatedAt = Date.now();
    this.save();
    return record;
  }

  replaceAll(records) {
    this.data = { ...this.data, notes: records };
    this.save();
  }
}

module.exports = {
  NoteStore,
  defaultRecord,
  normalizeImport,
  STORE_VERSION,
  DEFAULT_WORKSPACE_ID,
  sanitizeWorkspaceName,
  sanitizeTheme,
  sanitizeAccent,
  THEME_MODES,
  ACCENT_IDS,
  DEFAULT_THEME,
  DEFAULT_ACCENT,
  ALL_NOTES_SCOPE,
};
