// Tests for the "invisible" contract in noteWindow.js.
// BrowserWindow and Electron APIs are mocked so this runs without a display.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { EventEmitter } = require("node:events");

// --- minimal BrowserWindow mock ---

class MockBrowserWindow extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this._destroyed = false;
    this._contentProtection = false;
    this._alwaysOnTop = false;
    this._ignoreMouseEvents = false;
    this._visibleOnAllWorkspaces = false;
    this.webContents = new EventEmitter();
  }

  isDestroyed() {
    return this._destroyed;
  }

  destroy() {
    this._destroyed = true;
    this.emit("closed");
  }

  setContentProtection(value) {
    this._contentProtection = value;
  }

  setAlwaysOnTop(value, _level) {
    this._alwaysOnTop = value;
  }

  setVisibleOnAllWorkspaces(value, _opts) {
    this._visibleOnAllWorkspaces = value;
  }

  setIgnoreMouseEvents(value, _opts) {
    this._ignoreMouseEvents = value;
  }

  setMenuBarVisibility() {}

  showInactive() {
    this.emit("show");
  }

  show() {
    this.emit("show");
  }

  hide() {}

  loadFile(_p, _opts) {
    // Simulate ready-to-show firing synchronously for testing.
    process.nextTick(() => this.emit("ready-to-show"));
  }

  once(event, handler) {
    super.once(event, handler);
    return this;
  }

  on(event, handler) {
    super.on(event, handler);
    return this;
  }
}

// --- fakes for Electron modules noteWindow.js requires ---

const fakeScreen = {
  getAllDisplays: () => [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  ],
  getPrimaryDisplay: () => ({
    id: 1,
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  }),
  getDisplayNearestPoint: () => ({ id: 1 }),
};

function makeElectronFake() {
  return {
    BrowserWindow: MockBrowserWindow,
    screen: fakeScreen,
    app: { getPath: () => "/tmp" },
    ipcMain: { on() {}, handle() {}, removeAllListeners() {} },
    nativeTheme: new EventEmitter(),
  };
}

// Register module mocks before requiring noteWindow.js.
function loadNoteWindowWithPlatform(platformOverrides = {}) {
  // Clear the require cache for our local modules so each test gets a fresh instance.
  const localModules = [
    "../note/noteWindow",
    "../platform",
    "../displayUtils",
  ].map((rel) => require.resolve(path.join(__dirname, rel)));

  for (const mod of localModules) delete require.cache[mod];

  // Also clear electron from cache and replace with fake.
  const electronId = require.resolve("electron");
  const originalElectron = require.cache[electronId];
  require.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: makeElectronFake(),
  };

  // Apply platform overrides by patching after load.
  const noteWindow = require("../note/noteWindow");
  const platform = require("../platform");
  Object.assign(platform, platformOverrides);

  // Restore electron.
  if (originalElectron) {
    require.cache[electronId] = originalElectron;
  } else {
    delete require.cache[electronId];
  }

  return { noteWindow, platform };
}

function baseRecord(overrides = {}) {
  return {
    id: "test-note",
    visible: true,
    pinned: true,
    x: 100,
    y: 100,
    width: 360,
    height: 220,
    ...overrides,
  };
}

// --- tests ---

test("createNoteWindow passes transparent:true and frame:false to BrowserWindow", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  const win = noteWindow.createNoteWindow(baseRecord());

  assert.equal(win.options.transparent, true);
  assert.equal(win.options.frame, false);
  done();
});

test("createNoteWindow sets contextIsolation:true and nodeIntegration:false", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  const win = noteWindow.createNoteWindow(baseRecord());

  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  done();
});

test("setContentProtection(true) is called in ready-to-show before the window is shown", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  const win = noteWindow.createNoteWindow(baseRecord());

  // ready-to-show fires asynchronously (process.nextTick in loadFile mock).
  win.once("ready-to-show", () => {
    assert.equal(
      win._contentProtection,
      true,
      "setContentProtection must be true",
    );
    done();
  });
});

test("applyContentProtection is a no-op on a destroyed window", () => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  const win = noteWindow.createNoteWindow(baseRecord());
  win._destroyed = true;
  // Should not throw.
  assert.doesNotThrow(() => noteWindow.applyContentProtection(win));
  // setContentProtection should not have been updated after destruction.
  assert.equal(win._contentProtection, false);
});

test("applyContentProtection is a no-op on null", () => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  assert.doesNotThrow(() => noteWindow.applyContentProtection(null));
});

test("on Windows: show and restore events re-call setContentProtection", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: false,
    isWindows: true,
  });
  const win = noteWindow.createNoteWindow(baseRecord());

  win.once("ready-to-show", () => {
    const callsBefore = win._contentProtection ? 1 : 0;

    // Reset to false so we can detect a re-application.
    win._contentProtection = false;
    win.emit("show");
    assert.equal(
      win._contentProtection,
      true,
      "show must re-apply content protection on Windows",
    );

    win._contentProtection = false;
    win.emit("restore");
    assert.equal(
      win._contentProtection,
      true,
      "restore must re-apply content protection on Windows",
    );

    done();
  });
});

test("on macOS: show and restore events do NOT attach extra protection handlers", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  const win = noteWindow.createNoteWindow(baseRecord());

  win.once("ready-to-show", () => {
    win._contentProtection = false;
    win.emit("show");
    // On macOS the show listener added by Windows branch must not exist.
    assert.equal(
      win._contentProtection,
      false,
      "macOS must not have a show listener that re-applies content protection",
    );
    done();
  });
});

test("a note with visible:false is not shown after ready-to-show", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  let shown = false;
  const win = noteWindow.createNoteWindow(baseRecord({ visible: false }));

  const origShowInactive = win.showInactive.bind(win);
  win.showInactive = () => {
    shown = true;
    origShowInactive();
  };

  win.once("ready-to-show", () => {
    assert.equal(shown, false, "hidden note must not call showInactive");
    // Content protection still applied even for invisible notes.
    assert.equal(win._contentProtection, true);
    done();
  });
});

test("onClosed callback fires when the window emits closed", (t, done) => {
  const { noteWindow } = loadNoteWindowWithPlatform({
    isMac: true,
    isWindows: false,
  });
  let closedFired = false;
  noteWindow.createNoteWindow(baseRecord(), {
    onClosed: () => (closedFired = true),
  });
  // Simulate the window closing.
  const { BrowserWindow } = makeElectronFake();

  assert.doesNotThrow(() =>
    noteWindow.createNoteWindow(baseRecord(), { onClosed: () => {} }),
  );
  done();
});
