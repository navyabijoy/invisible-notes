const test = require("node:test");
const assert = require("node:assert/strict");

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
const display = { id: 1, workArea };
const screen = {
  getAllDisplays: () => [display],
  getPrimaryDisplay: () => display,
  getDisplayNearestPoint: () => display,
  getDisplayMatching: () => display,
};
const electronId = require.resolve("electron");
const original = require.cache[electronId];
require.cache[electronId] = { exports: { screen } };
const { createNoteCollapseController } = require("../note/noteCollapse");
if (original) require.cache[electronId] = original;
else delete require.cache[electronId];

function setup(overrides = {}) {
  const record = {
    id: "note-a",
    x: 100,
    y: 100,
    width: 360,
    height: 220,
    collapsed: false,
    text: "Private content",
    ...overrides,
  };
  let bounds = {
    x: record.x,
    y: record.y,
    width: record.collapsed ? 48 : record.width,
    height: record.collapsed ? 48 : record.height,
  };
  let cursor = { x: 110, y: 110 };
  let changes = 0;
  const win = {
    webContents: {},
    isDestroyed: () => false,
    getBounds: () => ({ ...bounds }),
    setBounds: (next) => {
      assert.equal(controller.isChanging(win) || record.collapsed, true);
      bounds = next;
    },
    setMinimumSize: (...size) => {
      win.minimum = size;
    },
    setResizable: (value) => {
      win.resizable = value;
    },
    setIgnoreMouseEvents: (value) => {
      win.ignoring = value;
    },
    setContentProtection: (value) => {
      win.protected = value;
    },
  };
  const controller = createNoteCollapseController({
    store: {
      get: (id) => (id === record.id ? record : null),
      update: (id, patch) => Object.assign(record, patch),
    },
    noteWindows: new Map([[record.id, win]]),
    screen: { ...screen, getCursorScreenPoint: () => cursor },
    onChanged: () => {
      changes++;
    },
  });
  const event = { sender: win.webContents };
  return {
    record,
    win,
    controller,
    event,
    change: (collapsed) =>
      controller.setCollapsed(event, { id: record.id, collapsed }),
    drag: (phase) => controller.dragBubble(event, { id: record.id, phase }),
    moveCursor: (x, y) => {
      cursor = { x, y };
    },
    changes: () => changes,
  };
}

test("collapse and restore preserve full dimensions, content, and center", () => {
  const h = setup();
  assert.equal(h.change(true), true);
  assert.deepEqual(h.win.getBounds(), {
    x: 256,
    y: 186,
    width: 48,
    height: 48,
  });
  assert.equal(h.record.width, 360);
  assert.equal(h.record.height, 220);
  assert.equal(h.win.resizable, false);
  assert.equal(h.win.ignoring, false);
  assert.equal(h.win.protected, true);
  assert.equal(h.change(false), false);
  assert.deepEqual(h.win.getBounds(), {
    x: 100,
    y: 100,
    width: 360,
    height: 220,
  });
  assert.deepEqual(h.win.minimum, [280, 120]);
  assert.equal(h.win.resizable, true);
  assert.equal(h.record.text, "Private content");
  assert.equal(h.changes(), 2);
});

test("dragging moves the bubble without expanding or losing full size", () => {
  const h = setup();
  h.change(true);
  h.drag("start");
  h.moveCursor(210, 160);
  h.drag("move");
  h.drag("end");
  assert.equal(h.record.collapsed, true);
  assert.equal(h.record.x, 356);
  assert.equal(h.record.y, 236);
  h.change(false);
  assert.deepEqual(h.win.getBounds(), {
    x: 200,
    y: 150,
    width: 360,
    height: 220,
  });
});

test("restoring a persisted bubble at the screen edge keeps the note reachable", () => {
  const h = setup({ collapsed: true, x: 1872, y: 1032 });
  h.change(false);
  assert.deepEqual(h.win.getBounds(), {
    x: 1560,
    y: 860,
    width: 360,
    height: 220,
  });
});

test("tiny pointer movement is treated as a click, not a drag", () => {
  const h = setup({ collapsed: true });
  h.drag("start");
  h.moveCursor(112, 111);
  h.drag("end");
  assert.equal(h.record.x, 100);
  assert.equal(h.record.y, 100);
});

test("collapse IPC rejects malformed payloads and other windows", () => {
  const h = setup();
  for (const payload of [
    null,
    {},
    { id: 7 },
    { id: "note-a", collapsed: "true" },
    { id: "missing", collapsed: true },
  ]) {
    assert.equal(h.controller.setCollapsed(h.event, payload), null);
    assert.doesNotThrow(() => h.controller.dragBubble(h.event, payload));
  }
  assert.equal(
    h.controller.setCollapsed(
      { sender: {} },
      { id: "note-a", collapsed: true },
    ),
    null,
  );
  assert.equal(h.record.collapsed, false);
  assert.equal(h.changes(), 0);
});

test("repeated collapse requests do not shrink the saved full size", () => {
  const h = setup();
  h.change(true);
  h.change(true);
  assert.equal(h.record.width, 360);
  assert.equal(h.record.height, 220);
  assert.equal(h.changes(), 1);
});
