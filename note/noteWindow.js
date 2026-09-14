// Note BrowserWindow factory; lifecycle callbacks are supplied by the caller.
const path = require("path");
const { BrowserWindow } = require("electron");
const platform = require("../platform");
const { clampToVisibleDisplay } = require("../displayUtils");
const { MIN_NOTE_WIDTH, MIN_NOTE_HEIGHT } = require("./noteSize");

// Re-apply screen-capture exclusion on a note window.
function applyContentProtection(win) {
  if (!win || win.isDestroyed()) return;
  win.setContentProtection(true);
}

function createNoteWindow(record, { onMoved, onResized, onClosed } = {}) {
  const bounds = clampToVisibleDisplay({
    ...record,
    width: Math.max(record.width || 0, MIN_NOTE_WIDTH),
    height: Math.max(record.height || 0, MIN_NOTE_HEIGHT),
  });

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    minWidth: MIN_NOTE_WIDTH,
    minHeight: MIN_NOTE_HEIGHT,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  platform.setPinned(win, record.pinned !== false);

  if (platform.isWindows) {
    win.on("show", () => applyContentProtection(win));
    win.on("restore", () => applyContentProtection(win));
  }

  win.loadFile(path.join(__dirname, "note.html"), { query: { id: record.id } });

  win.once("ready-to-show", () => {
    applyContentProtection(win);
    if (record.visible !== false) win.showInactive();
  });

  if (onMoved) win.on("moved", () => onMoved(win));
  if (onResized) win.on("resized", () => onResized(win));
  if (onClosed) win.on("closed", () => onClosed());

  return win;
}

module.exports = { createNoteWindow, applyContentProtection };
