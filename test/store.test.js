const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { NoteStore, normalizeImport, STORE_VERSION, DEFAULT_WORKSPACE_ID } = require('../store');

const tempDirs = [];
const stores = [];

// NoteStore reads and writes notes.json at construction, so each test gets its
// own directory. Passing `seed` writes a store file first, which is how the
// migration paths are exercised.
function storeDir(seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-notes-test-'));
  tempDirs.push(dir);
  if (seed !== undefined) {
    fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(seed));
  }
  return dir;
}

function openStore(dir) {
  const store = new NoteStore(dir);
  stores.push(store);
  return store;
}

function freshStore(seed) {
  return openStore(storeDir(seed));
}

test.after(() => {
  // Saves are debounced, so settle any pending write before the directories
  // go away. Otherwise the timer fires against a deleted path and the store
  // reports a write failure long after the test that caused it has passed.
  for (const store of stores) store.flush();
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

test('a fresh install starts with one default workspace', () => {
  const store = freshStore();
  assert.equal(store.data.version, STORE_VERSION);
  assert.equal(store.workspaces().length, 1);
  assert.equal(store.workspaces()[0].id, DEFAULT_WORKSPACE_ID);
  assert.equal(store.activeWorkspaceId(), DEFAULT_WORKSPACE_ID);
  assert.deepEqual(store.all(), []);
});

test('migrates a v1 file, backfilling the fields it predates', () => {
  const store = freshStore({ notes: [{ id: 'a', text: 'hello' }, { id: 'b', text: 'world' }] });
  assert.equal(store.data.version, STORE_VERSION);
  assert.equal(store.all().length, 2);
  assert.equal(store.get('a').text, 'hello');
  assert.ok(store.all().every((n) => n.visible === true));
  assert.ok(store.all().every((n) => n.pinned === true));
  assert.ok(store.all().every((n) => n.workspaceId === DEFAULT_WORKSPACE_ID));
});

test('migrates a v4 file without disturbing per-note state', () => {
  const store = freshStore({
    version: 4,
    notes: [
      { id: 'a', text: 'kept open', visible: true, monospace: false, color: 'blue' },
      { id: 'b', text: 'left closed', visible: false, monospace: true, color: 'pink' }
    ]
  });
  assert.equal(store.data.version, STORE_VERSION);
  // An upgrading user must see exactly the notes they saw before, so a note
  // the user had closed stays closed.
  assert.equal(store.get('a').visible, true);
  assert.equal(store.get('b').visible, false);
  assert.equal(store.get('b').monospace, true);
  assert.equal(store.get('b').color, 'pink');
  assert.ok(store.all().every((n) => n.workspaceId === DEFAULT_WORKSPACE_ID));
});

test('accepts a v5 file so merge order with the images change does not matter', () => {
  const store = freshStore({
    version: 5,
    notes: [{ id: 'a', text: 'has pics', visible: true, images: ['x.png', 'y.png'] }]
  });
  assert.equal(store.data.version, STORE_VERSION);
  assert.deepEqual(store.get('a').images, ['x.png', 'y.png']);
  assert.equal(store.get('a').workspaceId, DEFAULT_WORKSPACE_ID);
});

test('keeps settings keys it does not know about', () => {
  // `settings` is the app-level container; other features will add sibling
  // keys to it and a workspace migration must not drop them.
  const store = freshStore({ version: 4, settings: { theme: 'dark' }, notes: [] });
  assert.equal(store.settings().theme, 'dark');
  assert.equal(store.activeWorkspaceId(), DEFAULT_WORKSPACE_ID);
});

test('repairs notes and an active workspace pointing at a workspace that is gone', () => {
  const store = freshStore({
    version: STORE_VERSION,
    settings: { activeWorkspace: 'ws-gone' },
    workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: 'Default', createdAt: 1 }],
    notes: [{ id: 'a', text: 'orphan', workspaceId: 'ws-vanished', visible: true }]
  });
  // Otherwise the note would be stranded in a workspace no dropdown lists,
  // making it unreachable from the UI.
  assert.equal(store.get('a').workspaceId, DEFAULT_WORKSPACE_ID);
  assert.equal(store.activeWorkspaceId(), DEFAULT_WORKSPACE_ID);
});

test('collapses duplicate ids, drops non-objects, and repairs a missing id', () => {
  const store = freshStore({
    version: STORE_VERSION,
    settings: { activeWorkspace: DEFAULT_WORKSPACE_ID },
    workspaces: [
      { id: DEFAULT_WORKSPACE_ID, name: 'Default', createdAt: 1 },
      { id: DEFAULT_WORKSPACE_ID, name: 'Default again', createdAt: 2 },
      { id: 'ws-ok', name: 'Real', createdAt: 3 },
      null,
      { name: 'no id at all' }
    ],
    notes: [{ id: 'a', text: 'x', workspaceId: 'ws-ok' }]
  });
  // The genuine duplicate collapses and the first one wins. `null` is not an
  // object so it goes. The entry missing an id is a named workspace, so it is
  // repaired with a generated id rather than silently discarded.
  assert.equal(store.workspaces().length, 3);
  assert.equal(store.getWorkspace(DEFAULT_WORKSPACE_ID).name, 'Default');
  assert.ok(store.workspaces().some((w) => w.name === 'no id at all'));
  assert.equal(store.get('a').workspaceId, 'ws-ok');
});

test('replaces blank ids without merging distinct workspaces', () => {
  // defaultWorkspace generates an id for a blank one, so deduping on the raw
  // value would treat these two as the same workspace and drop the second.
  const store = freshStore({
    version: STORE_VERSION,
    settings: {},
    workspaces: [{ id: '', name: 'A' }, { id: '   ', name: 'B' }],
    notes: []
  });
  assert.equal(store.workspaces().length, 2);
  assert.notEqual(store.workspaces()[0].id, store.workspaces()[1].id);
  assert.ok(store.workspaces().every((w) => w.id.trim().length > 0));
  assert.ok(store.activeWorkspaceId());
});

test('a note pointing at a blank workspace id is reattached, not dropped', () => {
  const store = freshStore({
    version: STORE_VERSION,
    settings: {},
    workspaces: [{ id: '', name: 'A' }, { id: DEFAULT_WORKSPACE_ID, name: 'Default' }],
    notes: [{ id: 'n', text: 'keep me', workspaceId: '' }]
  });
  assert.equal(store.all().length, 1);
  assert.equal(store.get('n').text, 'keep me');
  assert.ok(store.getWorkspace(store.get('n').workspaceId));
});

test('creates, renames and switches workspaces', () => {
  const store = freshStore();
  const workspace = store.createWorkspace('Interview Notes');
  assert.equal(store.workspaces().length, 2);

  store.renameWorkspace(workspace.id, '  Presentation 1\n');
  assert.equal(store.getWorkspace(workspace.id).name, 'Presentation 1');

  // A blank rename would wipe the label off the dropdown, so it is ignored.
  store.renameWorkspace(workspace.id, '   ');
  assert.equal(store.getWorkspace(workspace.id).name, 'Presentation 1');

  assert.equal(store.setActiveWorkspace(workspace.id), workspace.id);
  assert.equal(store.setActiveWorkspace('nope'), null);
  assert.equal(store.activeWorkspaceId(), workspace.id);
});

test('new notes land in the active workspace', () => {
  const store = freshStore();
  const workspace = store.createWorkspace('Scratchpad');
  store.setActiveWorkspace(workspace.id);
  assert.equal(store.create({ text: 'in ws' }).workspaceId, workspace.id);
});

test('deleting a workspace reassigns its notes rather than deleting them', () => {
  const store = freshStore();
  const workspace = store.createWorkspace('Scratchpad');
  store.setActiveWorkspace(workspace.id);
  store.create({ text: 'one' });
  store.create({ text: 'two' });

  const result = store.removeWorkspace(workspace.id);
  assert.equal(result.movedCount, 2);
  assert.equal(store.all().length, 2);
  assert.ok(store.all().every((n) => n.workspaceId === DEFAULT_WORKSPACE_ID));
  assert.equal(store.activeWorkspaceId(), DEFAULT_WORKSPACE_ID);
  assert.equal(store.getWorkspace(workspace.id), null);
});

test('refuses to remove the last workspace', () => {
  const store = freshStore();
  assert.equal(store.fallbackWorkspaceFor(DEFAULT_WORKSPACE_ID), null);
  assert.equal(store.removeWorkspace(DEFAULT_WORKSPACE_ID), null);
  assert.equal(store.workspaces().length, 1);
});

test('names the workspace notes will really land in, which is not always Default', () => {
  const store = freshStore();
  store.renameWorkspace(DEFAULT_WORKSPACE_ID, 'Personal');
  const work = store.createWorkspace('Work');
  store.setActiveWorkspace(DEFAULT_WORKSPACE_ID);
  store.create({ text: 'one' });
  store.create({ text: 'two' });

  // The confirmation dialog asks for this so it can name the destination
  // instead of claiming the notes go to "Default".
  assert.equal(store.fallbackWorkspaceFor(DEFAULT_WORKSPACE_ID).id, work.id);

  const result = store.removeWorkspace(DEFAULT_WORKSPACE_ID);
  assert.equal(result.fallbackId, work.id);
  assert.equal(store.all().length, 2);
  assert.ok(store.all().every((n) => n.workspaceId === work.id));
  assert.equal(store.getWorkspace(DEFAULT_WORKSPACE_ID), null);
});

test('the default workspace is preferred as a fallback while it exists', () => {
  const store = freshStore();
  const a = store.createWorkspace('A');
  store.createWorkspace('B');
  assert.equal(store.fallbackWorkspaceFor(a.id).id, DEFAULT_WORKSPACE_ID);

  store.renameWorkspace(DEFAULT_WORKSPACE_ID, 'Home');
  assert.equal(store.fallbackWorkspaceFor(a.id).name, 'Home');
});

test('moves notes between workspaces and rejects unknown ids', () => {
  const store = freshStore();
  const workspace = store.createWorkspace('Other');
  const note = store.create({ text: 'movable' });

  assert.equal(store.moveNote(note.id, workspace.id).workspaceId, workspace.id);
  assert.equal(store.moveNote(note.id, 'nope'), null);
  assert.equal(store.moveNote('nope', workspace.id), null);
});

test('workspaces and per-note visibility survive a reload', () => {
  const dir = storeDir();
  const first = openStore(dir);
  const workspace = first.createWorkspace('Persisted');
  first.setActiveWorkspace(workspace.id);
  first.create({ text: 'survivor', visible: false });
  first.flush();

  const second = openStore(dir);
  assert.equal(second.activeWorkspaceId(), workspace.id);
  assert.equal(second.notesInWorkspace(workspace.id).length, 1);
  assert.equal(second.notesInWorkspace(workspace.id)[0].visible, false);
  assert.equal(second.data.version, STORE_VERSION);
});

test('a malformed store file loads instead of crashing on launch', () => {
  // Reading a field off a null entry throws, and the throw escapes the
  // JSON.parse try block in _load, so it would surface as a crash at startup
  // rather than the corrupt-file recovery path.
  const malformed = [
    { version: STORE_VERSION, settings: { activeWorkspace: DEFAULT_WORKSPACE_ID }, workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: 'D' }], notes: [null] },
    { version: 4, notes: [null] },
    { version: 2, notes: [null] },
    { notes: [null] },
    { version: STORE_VERSION, settings: null, workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: 'D' }], notes: [] },
    { version: STORE_VERSION, settings: 'not an object', workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: 'D' }], notes: [] }
  ];
  for (const seed of malformed) {
    assert.doesNotThrow(() => freshStore(seed));
  }
});

test('malformed entries are dropped without taking valid notes with them', () => {
  const store = freshStore({
    version: STORE_VERSION,
    settings: { activeWorkspace: DEFAULT_WORKSPACE_ID },
    workspaces: [{ id: DEFAULT_WORKSPACE_ID, name: 'D' }],
    notes: [{ id: 'a', text: 'real' }, null, { id: 'b', text: 'also real' }, 42]
  });
  assert.equal(store.all().length, 2);
  assert.equal(store.get('a').text, 'real');
  assert.equal(store.get('b').text, 'also real');
  assert.ok(store.all().every((n) => !!store.getWorkspace(n.workspaceId)));
});

test('normalizeImport returns null for a payload that is not a backup', () => {
  assert.equal(normalizeImport(null), null);
  assert.equal(normalizeImport({}), null);
  assert.equal(normalizeImport({ notes: 'nope' }), null);
  assert.equal(normalizeImport(42), null);
});

test('normalizeImport accepts a valid empty backup', () => {
  assert.deepEqual(normalizeImport({ app: 'ghost-notes', version: STORE_VERSION, notes: [] }), []);
  assert.deepEqual(normalizeImport({ version: STORE_VERSION, notes: [] }), []);
});

test('normalizeImport rejects empty notes without a backup marker', () => {
  assert.equal(normalizeImport({ notes: [] }), null);
  assert.equal(normalizeImport({ app: 'other-app', notes: [] }), null);
});

test('normalizeImport preserves a valid epoch timestamp of 0', () => {
  const records = normalizeImport({
    version: STORE_VERSION,
    notes: [{ id: 'a', createdAt: 0, updatedAt: 0 }]
  });
  assert.equal(records[0].createdAt, 0);
  assert.equal(records[0].updatedAt, 0);
});

test('normalizeImport coerces malformed numeric fields to sane values', () => {
  const records = normalizeImport({
    version: STORE_VERSION,
    notes: [{
      id: 'a',
      width: NaN,
      height: 5,
      opacity: 2,
      fontSize: 'large',
      x: Infinity,
      y: 'nope',
      createdAt: 'today'
    }]
  });
  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.width, 360);
  assert.equal(r.height, 220);
  assert.equal(r.opacity, 0.85);
  assert.equal(r.fontSize, 15);
  assert.equal(r.x, undefined);
  assert.equal(r.y, undefined);
  assert.equal(typeof r.createdAt, 'number');
  assert.equal(r.updatedAt, r.createdAt);
});

test('normalizeImport drops duplicate and malformed entries', () => {
  const records = normalizeImport({
    version: STORE_VERSION,
    notes: [
      { id: 'a', text: 'one' },
      { id: 'a', text: 'duplicate' },
      null,
      42,
      { id: 'b', text: 'two' }
    ]
  });
  assert.deepEqual(records.map((r) => r.id), ['a', 'b']);
});

test('replaceAll replaces notes but preserves settings and workspaces', () => {
  const store = freshStore();
  const ws = store.createWorkspace('Work');
  store.create({ text: 'before', workspaceId: ws.id });

  store.replaceAll([{ id: 'imported', text: 'after', workspaceId: ws.id }]);

  assert.deepEqual(store.all().map((n) => n.id), ['imported']);
  assert.equal(store.getWorkspace(ws.id).name, 'Work');
  assert.equal(store.activeWorkspaceId(), DEFAULT_WORKSPACE_ID);
});
