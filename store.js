// Persistence layer: versioned, atomic-write JSON store for note records.
// A "record" is the durable note (id, content, position, visible flag) —
// independent of whether a BrowserWindow currently exists for it.
const fs = require('fs');
const path = require('path');

const STORE_VERSION = 3;

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
function migrate(data) {
  if (!data || typeof data !== 'object') return { version: STORE_VERSION, notes: [] };
  if (!Array.isArray(data.notes)) return { version: STORE_VERSION, notes: [] };

  if (!data.version) {
    // v1 -> v3: add visible/title/displayId/pinned/timestamps, keep the rest.
    return {
      version: STORE_VERSION,
      notes: data.notes.map((n) => defaultRecord({ ...n, visible: true, pinned: true }))
    };
  }
  if (data.version === 2) {
    // v2 -> v3: backfill pinned:true so existing notes keep today's
    // always-on-top behavior unchanged.
    return {
      version: STORE_VERSION,
      notes: data.notes.map((n) => ({ ...n, pinned: n.pinned !== undefined ? !!n.pinned : true }))
    };
  }
  return data;
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
      return { data: { version: STORE_VERSION, notes: [] }, migrated: false };
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
    return { version: STORE_VERSION, notes: [] };
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
