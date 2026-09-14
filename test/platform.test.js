// Tests for platform.js helpers.
// Platform-branched functions (setPinned, captureExclusionCaveat, formatAccelerator)
// are tested against the real platform the test runner is executing on, so assertions
// stay valid on both macOS and Windows CI runners.
const test = require("node:test");
const assert = require("node:assert/strict");

const platform = require("../platform");

// --- setPinned ---

function makeFakeWin() {
  const calls = [];
  return {
    calls,
    setAlwaysOnTop(value, level) {
      calls.push({ method: "setAlwaysOnTop", value, level });
    },
    setVisibleOnAllWorkspaces(value, opts) {
      calls.push({ method: "setVisibleOnAllWorkspaces", value, opts });
    },
  };
}

test("setPinned(true) always calls setAlwaysOnTop(true, 'screen-saver')", () => {
  const win = makeFakeWin();
  platform.setPinned(win, true);

  const aot = win.calls.find((c) => c.method === "setAlwaysOnTop");
  assert.ok(aot, "setAlwaysOnTop must be called");
  assert.equal(aot.value, true);
  assert.equal(aot.level, "screen-saver");
});

test("setPinned(false) always calls setAlwaysOnTop(false)", () => {
  const win = makeFakeWin();
  platform.setPinned(win, false);

  const aot = win.calls.find((c) => c.method === "setAlwaysOnTop");
  assert.ok(aot, "setAlwaysOnTop must be called");
  assert.equal(aot.value, false);
});

test(
  "setPinned(true) on macOS also enables visibleOnAllWorkspaces with fullscreen support",
  {
    skip: !platform.isMac ? "macOS only" : false,
  },
  () => {
    const win = makeFakeWin();
    platform.setPinned(win, true);

    const ws = win.calls.find((c) => c.method === "setVisibleOnAllWorkspaces");
    assert.ok(ws, "setVisibleOnAllWorkspaces must be called on macOS");
    assert.equal(ws.value, true);
    assert.equal(ws.opts?.visibleOnFullScreenSpaces, true);
  },
);

test(
  "setPinned(false) on macOS clears visibleOnAllWorkspaces",
  {
    skip: !platform.isMac ? "macOS only" : false,
  },
  () => {
    const win = makeFakeWin();
    platform.setPinned(win, false);

    const ws = win.calls.find((c) => c.method === "setVisibleOnAllWorkspaces");
    assert.ok(ws, "setVisibleOnAllWorkspaces must be called on macOS unpin");
    assert.equal(ws.value, false);
  },
);

test(
  "setPinned on Windows never calls setVisibleOnAllWorkspaces",
  {
    skip: !platform.isWindows ? "Windows only" : false,
  },
  () => {
    const win = makeFakeWin();
    platform.setPinned(win, true);

    const ws = win.calls.find((c) => c.method === "setVisibleOnAllWorkspaces");
    assert.equal(ws, undefined);
  },
);

// --- captureExclusionCaveat ---

test(
  "captureExclusionCaveat returns null on macOS",
  {
    skip: !platform.isMac ? "macOS only" : false,
  },
  () => {
    assert.equal(platform.captureExclusionCaveat(), null);
  },
);

test(
  "captureExclusionCaveat returns a non-empty warning string on Windows",
  {
    skip: !platform.isWindows ? "Windows only" : false,
  },
  () => {
    const caveat = platform.captureExclusionCaveat();
    assert.equal(typeof caveat, "string");
    assert.ok(caveat.length > 0);
    // Must reference the minimum Windows build so users understand the limitation.
    assert.ok(
      caveat.includes("19041") || caveat.includes("Windows 10"),
      "caveat must reference Windows 10 build 19041",
    );
  },
);

test("captureExclusionCaveat returns null or a string — never anything else", () => {
  const caveat = platform.captureExclusionCaveat();
  assert.ok(
    caveat === null || typeof caveat === "string",
    "captureExclusionCaveat must return null or a string",
  );
});

// --- formatAccelerator ---

test("formatAccelerator returns empty string for empty or nullish input", () => {
  assert.equal(platform.formatAccelerator(""), "");
  assert.equal(platform.formatAccelerator(null), "");
  assert.equal(platform.formatAccelerator(undefined), "");
});

test("formatAccelerator produces a human-readable string without raw Electron tokens", () => {
  const result = platform.formatAccelerator("CommandOrControl+Shift+N");
  assert.ok(result.length > 0, "must produce non-empty output");
  assert.ok(
    !result.includes("CommandOrControl") && !result.includes("CmdOrCtrl"),
    "result must not contain raw Electron modifier names",
  );
});

test(
  "formatAccelerator on macOS uses symbol characters",
  {
    skip: !platform.isMac ? "macOS only" : false,
  },
  () => {
    assert.equal(platform.formatAccelerator("CommandOrControl+Shift+N"), "⇧⌘N");
    assert.equal(
      platform.formatAccelerator("CommandOrControl+Alt+Shift+N"),
      "⌥⇧⌘N",
    );
    assert.equal(platform.formatAccelerator("CmdOrCtrl+Q"), "⌘Q");
  },
);

test(
  "formatAccelerator on Windows uses word labels joined with +",
  {
    skip: !platform.isWindows ? "Windows only" : false,
  },
  () => {
    assert.equal(
      platform.formatAccelerator("CommandOrControl+Shift+N"),
      "Ctrl+Shift+N",
    );
    assert.equal(platform.formatAccelerator("CmdOrCtrl+Q"), "Ctrl+Q");
  },
);

// --- isMac / isWindows are mutually exclusive ---

test("isMac and isWindows cannot both be true", () => {
  assert.ok(
    !(platform.isMac && platform.isWindows),
    "isMac and isWindows must not both be true",
  );
});
