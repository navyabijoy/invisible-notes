const { clampToVisibleDisplay, displayIdForPoint } = require("../displayUtils");
const {
  COLLAPSED_NOTE_SIZE,
  MIN_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
} = require("./noteSize");

function createNoteCollapseController({
  store,
  noteWindows,
  screen,
  onChanged,
}) {
  const changing = new WeakSet();
  const drags = new WeakMap();

  function target(event, payload) {
    if (!payload || typeof payload.id !== "string") return null;
    const win = noteWindows.get(payload.id);
    if (!win || win.isDestroyed() || win.webContents !== event.sender)
      return null;
    const record = store.get(payload.id);
    return record ? { win, record } : null;
  }

  function visibleBounds(bounds) {
    const safe = clampToVisibleDisplay(bounds);
    const { workArea } = screen.getDisplayMatching(safe);
    return {
      x: Math.round(
        Math.max(
          workArea.x,
          Math.min(safe.x, workArea.x + workArea.width - safe.width),
        ),
      ),
      y: Math.round(
        Math.max(
          workArea.y,
          Math.min(safe.y, workArea.y + workArea.height - safe.height),
        ),
      ),
      width: safe.width,
      height: safe.height,
    };
  }

  function setCollapsed(event, payload) {
    const found = target(event, payload);
    if (!found || typeof payload.collapsed !== "boolean") return null;
    const { win, record } = found;
    const { collapsed } = payload;
    if (!!record.collapsed === collapsed) return collapsed;
    const previous = win.getBounds();
    const width = collapsed
      ? previous.width
      : Math.max(record.width, MIN_NOTE_WIDTH);
    const height = collapsed
      ? previous.height
      : Math.max(record.height, MIN_NOTE_HEIGHT);
    const size = collapsed
      ? { width: COLLAPSED_NOTE_SIZE, height: COLLAPSED_NOTE_SIZE }
      : { width, height };
    const bounds = visibleBounds({
      x: Math.round(previous.x + (previous.width - size.width) / 2),
      y: Math.round(previous.y + (previous.height - size.height) / 2),
      ...size,
    });

    changing.add(win);
    try {
      store.update(record.id, {
        collapsed,
        width,
        height,
        x: bounds.x,
        y: bounds.y,
        displayId: displayIdForPoint(bounds.x, bounds.y),
      });
      win.setIgnoreMouseEvents(false);
      win.setMinimumSize(COLLAPSED_NOTE_SIZE, COLLAPSED_NOTE_SIZE);
      win.setResizable(true);
      win.setBounds(bounds);
      win.setMinimumSize(
        collapsed ? COLLAPSED_NOTE_SIZE : MIN_NOTE_WIDTH,
        collapsed ? COLLAPSED_NOTE_SIZE : MIN_NOTE_HEIGHT,
      );
      win.setResizable(!collapsed);
      win.setContentProtection(true);
      drags.delete(win);
    } finally {
      changing.delete(win);
    }
    onChanged();
    return collapsed;
  }

  function dragBubble(event, payload) {
    const found = target(event, payload);
    if (!found || !found.record.collapsed) return;
    if (!["start", "move", "end"].includes(payload.phase)) return;
    const { win, record } = found;
    if (payload.phase === "start") {
      drags.set(win, {
        cursor: screen.getCursorScreenPoint(),
        bounds: win.getBounds(),
      });
      return;
    }
    const drag = drags.get(win);
    if (!drag) return;
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - drag.cursor.x;
    const dy = cursor.y - drag.cursor.y;
    if (Math.hypot(dx, dy) >= 4) {
      const bounds = visibleBounds({
        ...drag.bounds,
        x: drag.bounds.x + dx,
        y: drag.bounds.y + dy,
      });
      win.setBounds(bounds);
      store.update(record.id, {
        x: bounds.x,
        y: bounds.y,
        displayId: displayIdForPoint(bounds.x, bounds.y),
      });
    }
    if (payload.phase === "end") drags.delete(win);
  }

  return { setCollapsed, dragBubble, isChanging: (win) => changing.has(win) };
}

module.exports = { createNoteCollapseController };
