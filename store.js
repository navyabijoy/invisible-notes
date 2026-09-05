// Persistence layer: versioned, atomic-write JSON store for note records.
// A "record" is the durable note (id, content, position, visible flag) —
// independent of whether a BrowserWindow currently exists for it.
const fs = require('fs');
const path = require('path');

const STORE_VERSION = 6;

// The workspace every migrated note lands in. The id is fixed so migrations
// have a stable target and so the "where do orphaned notes go" fallback has
// something to prefer.
//
// It is NOT permanent: any workspace can be deleted as long as it is not the
// last one, this one included. Someone who organises into "Work" and
// "Personal" should not be stuck with an unused "Default" forever. The
// invariant that actually holds is that at least one workspace always exists,
// so pickFallbackWorkspace() always has a destination.
const DEFAULT_WORKSPACE_ID = 'ws-default';
const DEFAULT_WORKSPACE_NAME = 'Default';
const MAX_WORKSPACE_NAME_LENGTH = 40;

// Appearance preferences (Manager-only theming). Note bodies keep their
// per-note color; theme/accent only restyle Manager chrome.
const THEME_MODES = ['light', 'dark', 'system'];
const DEFAULT_THEME = 'system';
const ACCENT_IDS = ['violet', 'blue', 'green', 'orange', 'pink'];
const DEFAULT_ACCENT = 'violet';

function sanitizeTheme(input) {
  return THEME_MODES.includes(input) ? input : DEFAULT_THEME;
}

function sanitizeAccent(input) {
  return ACCENT_IDS.includes(input) ? input : DEFAULT_ACCENT;
}

function nextId() {
  return 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function nextWorkspaceId() {
  return 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

// Workspace names are shown in a tray menu, where a newline or an
// over-long string would break the layout, so normalize at the boundary.
function sanitizeWorkspaceName(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_WORKSPACE_NAME_LENGTH);
}

function defaultWorkspace(overrides = {}) {
  // A blank or whitespace-only id is not a usable identifier, so it is
  // replaced rather than stored. Notes still pointing at the old value are
  // reattached by normalizeWorkspaces, which reassigns any workspaceId that
  // does not match a workspace that exists.
  const id = typeof overrides.id === 'string' ? overrides.id.trim() : '';
  return {
    id: id || nextWorkspaceId(),
    name: sanitizeWorkspaceName(overrides.name) || 'Untitled workspace',
    createdAt: overrides.createdAt || Date.now()
  };
}

function defaultRecord(overrides = {}) {
  const now = overrides.createdAt || Date.now();
  return {
    id: overrides.id || nextId(),
    title: overrides.title || '',
    text: overrides.text || '',
    color: overrides.color || 'yellow',
    x: overrides.x,
    y: overrides.y,
    width: overrides.width || 300,
    height: overrides.height || 220,
    displayId: overrides.displayId ?? null,
    opacity: typeof overrides.opacity === 'number' ? overrides.opacity : 0.85,
    fontSize: overrides.fontSize || 15,
    // Per-note monospace toggle for code walkthroughs (issue #7).
    monospace: !!overrides.monospace,
    // Which workspace this note belongs to (issue #8). Independent of
    // `visible`. See the note on effective visibility below.
    workspaceId: overrides.workspaceId || DEFAULT_WORKSPACE_ID,
    ghost: !!overrides.ghost,
    visible: overrides.visible !== undefined ? !!overrides.visible : true,
    // Pinned = always-on-top, survives switching focus to another app.
    // Unpinned = a normal window that can be covered by whatever's focused.
    pinned: overrides.pinned !== undefined ? !!overrides.pinned : true,
    createdAt: now,
    updatedAt: overrides.updatedAt || now
  };
}

// Where notes go when their own workspace is missing or is being removed.
// Prefers the default workspace when it is still present, otherwise the
// first remaining one. Callers use this to name the real destination rather
// than assuming it is "Default", which is wrong once that workspace has been
// renamed or deleted. Returns null only for an empty list.
function pickFallbackWorkspace(workspaces, excludeId) {
  const remaining = excludeId === undefined ? workspaces : workspaces.filter((w) => w.id !== excludeId);
  return remaining.find((w) => w.id === DEFAULT_WORKSPACE_ID) || remaining[0] || null;
}

function emptyStore() {
  const workspace = defaultWorkspace({
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME
  });
  return {
    version: STORE_VERSION,
    settings: {
      activeWorkspace: workspace.id,
      theme: DEFAULT_THEME,
      accent: DEFAULT_ACCENT
    },
    workspaces: [workspace],
    notes: []
  };
}

// Guarantees the workspace invariants the rest of the app relies on:
//   1. at least one workspace always exists,
//   2. every note points at a workspace that exists,
//   3. settings.activeWorkspace points at a workspace that exists.
// Applied to every load, not just migrations, so a hand-edited or
// partially-written file can't leave notes stranded in a workspace that
// isn't in the dropdown, which would make them unreachable from the UI.
function normalizeWorkspaces(data) {
  // Drop malformed entries and duplicate ids. A duplicate id would put two
  // identical-looking options in the dropdown while only one of them could
  // ever be selected, and would make note membership ambiguous.
  //
  // Normalize before deduping, so the check runs against the id actually
  // being stored. Deduping on the raw value would treat two entries with a
  // blank id as the same workspace and drop the second, even though
  // defaultWorkspace gives each of them a distinct generated id.
  const seenIds = new Set();
  let workspaces = [];
  for (const entry of Array.isArray(data.workspaces) ? data.workspaces : []) {
    if (!entry || typeof entry !== 'object') continue;
    const workspace = defaultWorkspace(entry);
    if (seenIds.has(workspace.id)) continue;
    seenIds.add(workspace.id);
    workspaces.push(workspace);
  }

  if (workspaces.length === 0) {
    workspaces = [defaultWorkspace({ id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME })];
  }

  const ids = new Set(workspaces.map((w) => w.id));
  const fallbackId = pickFallbackWorkspace(workspaces).id;

  const notes = data.notes.map((n) => ({
    ...n,
    workspaceId: ids.has(n.workspaceId) ? n.workspaceId : fallbackId
  }));

  const requested = data.settings?.activeWorkspace;
  return {
    version: STORE_VERSION,
    // Spread first so future app-level settings (custom shortcuts in #5)
    // survive a workspace migration untouched. Theme/accent are re-sanitized
    // so a hand-edited value can never break the UI.
    settings: {
      ...data.settings,
      activeWorkspace: ids.has(requested) ? requested : fallbackId,
      theme: sanitizeTheme(data.settings?.theme),
      accent: sanitizeAccent(data.settings?.accent)
    },
    workspaces,
    notes
  };
}

// v1 files were `{ notes: [...] }` with no `version` field and no `visible`/`title`.
// v2 files have a version field but no `pinned`.
// v3 files have pinned but no `monospace`.
// v4 files have monospace but no workspaces.
// v5 is the `images` schema from #9, accepted here as a migration source too,
// so this change and that one are independent of merge order.
function migrate(data) {
  if (!data || typeof data !== 'object') return emptyStore();
  if (!Array.isArray(data.notes)) return emptyStore();

  // Drop entries that are not objects before anything reads fields off them.
  // A hand-edited or partially written file can hold a null or a bare number
  // in the array, and every branch below (and normalizeWorkspaces after it)
  // dereferences each entry. Reading `n.monospace` off a null throws, and the
  // throw escapes _load's JSON.parse try block, so it would surface as a
  // crash on launch rather than the corrupt-file recovery path.
  const sourceNotes = data.notes.filter((n) => n && typeof n === 'object');

  let notes;
  if (!data.version) {
    // v1 -> current: add visible/title/displayId/pinned/monospace/timestamps.
    notes = sourceNotes.map((n) => defaultRecord({ ...n, visible: true, pinned: true }));
  } else if (data.version === 2) {
    // v2 -> current: backfill pinned:true so existing notes keep today's
    // always-on-top behavior unchanged. Monospace defaults to off unless
    // the record already has it set.
    notes = sourceNotes.map((n) => ({
      ...n,
      pinned: n.pinned !== undefined ? !!n.pinned : true,
      monospace: !!n.monospace
    }));
  } else if (data.version === 3 || data.version === 4 || data.version === 5) {
    // v3 -> v4: existing notes stay proportional unless the user toggles {}.
    // v4/v5 -> v6: the workspace backfill below is the only change; spreading
    // keeps any fields this version doesn't know about (e.g. v5 `images`).
    notes = sourceNotes.map((n) => ({ ...n, monospace: !!n.monospace }));
  } else {
    notes = sourceNotes;
  }

  // Every pre-v6 file predates workspaces, so normalizeWorkspaces drops all
  // of its notes into a single "Default" workspace and makes it active, so an
  // upgrading user sees exactly the notes they saw before.
  return normalizeWorkspaces({ ...data, notes });
}

// Convert a parsed backup file (any schema version this app has ever
// written) into a clean list of current-schema records. Backups are
// untrusted input — hand-edited, from another machine, or an older schema —
// so every field the UI relies on is re-coerced to a sane type, unknown
// fields are dropped by defaultRecord(), and duplicate ids are skipped.
// Returns null when the payload is not a notes file at all.
function normalizeImport(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.notes)) return null;
  // An empty array is intentionally importable (so "Replace" can clear notes),
  // but that means any random JSON with notes: [] would otherwise pass. Exports
  // always write the app marker and a numeric version, so require one of those
  // when there is nothing else to look at.
  if (data.notes.length === 0 && data.app !== 'ghost-notes' && !Number.isFinite(data.version)) return null;
  const seen = new Set();
  const notes = [];
  for (const entry of migrate(data).notes) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    // defaultRecord() uses overrides.createdAt || Date.now(), so a valid epoch
    // timestamp of 0 would be overwritten before the checks below run. Capture
    // the raw values and restore them when they are actually finite.
    const rawCreatedAt = entry.createdAt;
    const rawUpdatedAt = entry.updatedAt;
    const record = defaultRecord(entry);
    if (Number.isFinite(rawCreatedAt)) record.createdAt = rawCreatedAt;
    if (Number.isFinite(rawUpdatedAt)) record.updatedAt = rawUpdatedAt;
    if (typeof record.id !== 'string' || !record.id) record.id = nextId();
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    if (typeof record.title !== 'string') record.title = '';
    if (typeof record.text !== 'string') record.text = '';
    if (typeof record.color !== 'string') record.color = 'yellow';
    // typeof alone lets NaN/Infinity through; only finite numbers are valid
    // for sizes, positions and timestamps. width/height/opacity also get
    // bounds so a bad backup can't produce an unusable window.
    if (!Number.isFinite(record.opacity) || record.opacity <= 0 || record.opacity > 1) record.opacity = 0.85;
    if (!Number.isFinite(record.fontSize)) record.fontSize = 15;
    if (!Number.isFinite(record.width) || record.width < 160) record.width = 300;
    if (!Number.isFinite(record.height) || record.height < 120) record.height = 220;
    if (!Number.isFinite(record.x)) record.x = undefined;
    if (!Number.isFinite(record.y)) record.y = undefined;
    if (!Number.isFinite(record.createdAt)) record.createdAt = Date.now();
    if (!Number.isFinite(record.updatedAt)) record.updatedAt = record.createdAt;
    notes.push(record);
  }
  return notes;
}

class NoteStore {
  // onCorrupted(backupPath) and onWriteError(error) are optional hooks so the
  // caller (main.js) can surface a friendly, non-technical notice — this
  // module has no Electron dependency and never shows UI itself.
  //
  // `codec` is an optional `{ encrypt(string) -> Buffer, decrypt(Buffer) -> string }`
  // pair that encrypts the file's bytes at rest (typically Electron's
  // safeStorage). When provided, writes are encrypted and reads are decrypted.
  // When omitted (e.g. OS-level encryption unavailable), notes are stored as
  // plaintext — matching the original behavior.
  constructor(userDataPath, { onCorrupted, onWriteError, codec } = {}) {
    this.filePath = path.join(userDataPath, 'notes.json');
    this.tmpPath = this.filePath + '.tmp';
    this.backupPath = this.filePath + '.corrupt';
    this.onCorrupted = onCorrupted;
    this.onWriteError = onWriteError;
    this.codec = codec || null;
    const { data, migrated } = this._load();
    this.data = data;
    this._saveTimer = null;
    if (migrated && this.codec) {
      // A legacy plaintext file was loaded while encryption is now enabled —
      // re-encrypt it immediately so plaintext doesn't linger on disk.
      this._writeNow();
    }
  }

  // Returns { data, migrated } where `migrated` indicates a legacy plaintext
  // file was found while a codec is enabled (and should be re-encrypted).
  _load() {
    let raw;
    try {
      raw = fs.readFileSync(this.filePath); // Buffer
    } catch (_) {
      return { data: emptyStore(), migrated: false };
    }

    // 1) Encryption enabled: try to decrypt the file first.
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
        // Decryption failed — the file is probably a legacy plaintext file
        // saved before encryption was enabled. Fall through and migrate it.
      }
    }

    // 2) Legacy plaintext JSON (or an unreadable/corrupted file).
    let parsed = null;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return { data: this._corrupt(raw), migrated: false };
    }
    return { data: this._parseAndMigrate(parsed, raw), migrated: !!this.codec };
  }

  _parseAndMigrate(parsed, raw) {
    if (!parsed || parsed.version !== STORE_VERSION) {
      // About to run a schema migration — snapshot the pre-migration file
      // first so a bug in migrate() can never be the only copy of the data.
      try {
        fs.writeFileSync(this.filePath + `.pre-migration-v${(parsed && parsed.version) || 1}`, raw);
      } catch (_) {}
    }
    return migrate(parsed);
  }

  _corrupt(raw) {
    // Preserve the bad file for inspection, never destroy it silently by
    // overwriting; start fresh so the app still boots.
    try {
      fs.writeFileSync(this.backupPath, raw);
    } catch (_) {}
    console.error('notes.json was corrupted, backed up to', this.backupPath);
    if (this.onCorrupted) this.onCorrupted(this.backupPath);
    return emptyStore();
  }

  _writeNow() {
    let out;
    if (this.codec) {
      // safeStorage.encryptString returns a Buffer; write it as-is.
      out = this.codec.encrypt(JSON.stringify(this.data));
    } else {
      out = Buffer.from(JSON.stringify(this.data, null, 2), 'utf8');
    }
    try {
      fs.writeFileSync(this.tmpPath, out);
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (e) {
      console.error('Failed to save notes:', e);
      if (this.onWriteError) this.onWriteError(e);
    }
  }

  // Debounced save so rapid move/resize/typing events don't hammer disk.
  save() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._writeNow();
    }, 250);
  }

  // Flush pending debounced save immediately (call before quit).
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
    // A new note belongs to whatever workspace is on screen right now,
    // unless the caller is explicit about it.
    const record = defaultRecord({
      workspaceId: this.activeWorkspaceId(),
      ...overrides
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

  // ---------- Workspaces (issue #8) ----------
  //
  // Workspace membership and `visible` are deliberately independent.
  // `visible` stays the user's per-note choice *within* its workspace, so
  // switching away and back restores exactly the notes that were open. It
  // is never rewritten as a side effect of changing workspace. Callers
  // decide what to render with:
  //
  //     shown = note.visible && note.workspaceId === activeWorkspaceId()

  settings() {
    return this.data.settings;
  }

  // ---------- Appearance (Manager-only theme + accent) ----------
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
    this.save();
    return id;
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
    if (!clean) return workspace; // ignore a blank rename rather than wiping the label
    workspace.name = clean;
    this.save();
    return workspace;
  }

  // Where the notes of `id` would go if it were deleted. Exposed so the
  // confirmation dialog can name the real destination instead of assuming
  // it is called "Default". Returns null when `id` is the last workspace.
  fallbackWorkspaceFor(id) {
    if (this.data.workspaces.length <= 1) return null;
    return pickFallbackWorkspace(this.data.workspaces, id);
  }

  // Deleting a workspace never deletes notes. They are reassigned to the
  // fallback workspace. Refuses to remove the last remaining workspace so
  // the "at least one workspace" invariant always holds.
  // Returns { movedCount, fallbackId } on success, or null if refused.
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

  // Bulk swap of the whole notes array — used by import (merge or replace),
  // where callers have already normalized the records. One save instead of N.
  replaceAll(records) {
    // Replace only the notes, preserving settings and workspaces so the
    // workspace invariants (active workspace, membership) survive an import.
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
  DEFAULT_ACCENT
};
