// Persistence layer: versioned, atomic-write JSON store for note records.
// A "record" is the durable note (id, content, position, visible flag) —
// independent of whether a BrowserWindow currently exists for it.
const fs = require('fs');
const path = require('path');

const STORE_VERSION = 4;

function nextId() {
  return 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
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
    ghost: !!overrides.ghost,
    visible: overrides.visible !== undefined ? !!overrides.visible : true,
    // Pinned = always-on-top, survives switching focus to another app.
    // Unpinned = a normal window that can be covered by whatever's focused.
    pinned: overrides.pinned !== undefined ? !!overrides.pinned : true,
    createdAt: now,
    updatedAt: overrides.updatedAt || now
  };
}

// v1 files were `{ notes: [...] }` with no `version` field and no `visible`/`title`.
// v2 files have a version field but no `pinned`.
// v3 files have pinned but no `monospace`.
function migrate(data) {
  if (!data || typeof data !== 'object') return { version: STORE_VERSION, notes: [] };
  if (!Array.isArray(data.notes)) return { version: STORE_VERSION, notes: [] };

  if (!data.version) {
    // v1 -> current: add visible/title/displayId/pinned/monospace/timestamps.
    return {
      version: STORE_VERSION,
      notes: data.notes.map((n) => defaultRecord({ ...n, visible: true, pinned: true }))
    };
  }
  if (data.version === 2) {
    // v2 -> current: backfill pinned:true so existing notes keep today's
    // always-on-top behavior unchanged. Monospace defaults to off unless
    // the record already has it set.
    return {
      version: STORE_VERSION,
      notes: data.notes.map((n) => ({
        ...n,
        pinned: n.pinned !== undefined ? !!n.pinned : true,
        monospace: !!n.monospace
      }))
    };
  }
  if (data.version === 3) {
    // v3 -> v4: existing notes stay proportional unless the user toggles {}.
    return {
      version: STORE_VERSION,
      notes: data.notes.map((n) => ({ ...n, monospace: !!n.monospace }))
    };
  }
  return data;
}

class NoteStore {
  // onCorrupted(backupPath) and onWriteError(error) are optional hooks so the
  // caller (main.js) can surface a friendly, non-technical notice — this
  // module has no Electron dependency and never shows UI itself.
  constructor(userDataPath, { onCorrupted, onWriteError } = {}) {
    this.filePath = path.join(userDataPath, 'notes.json');
    this.tmpPath = this.filePath + '.tmp';
    this.backupPath = this.filePath + '.corrupt';
    this.onCorrupted = onCorrupted;
    this.onWriteError = onWriteError;
    this.data = this._load();
    this._saveTimer = null;
  }

  _load() {
    let raw;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch (_) {
      return { version: STORE_VERSION, notes: [] };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== STORE_VERSION) {
        // About to run a schema migration — snapshot the pre-migration file
        // first so a bug in migrate() can never be the only copy of the data.
        try {
          fs.writeFileSync(this.filePath + `.pre-migration-v${parsed && parsed.version || 1}`, raw);
        } catch (_) {}
      }
      return migrate(parsed);
    } catch (e) {
      // Corrupted file: preserve it for inspection, never destroy silently
      // by overwriting, start fresh so the app still boots.
      try {
        fs.writeFileSync(this.backupPath, raw);
      } catch (_) {}
      console.error('notes.json was corrupted, backed up to', this.backupPath, e);
      if (this.onCorrupted) this.onCorrupted(this.backupPath);
      return { version: STORE_VERSION, notes: [] };
    }
  }

  _writeNow() {
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2));
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
    const record = defaultRecord(overrides);
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
}

module.exports = { NoteStore, defaultRecord, STORE_VERSION };
