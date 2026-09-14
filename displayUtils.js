// Keep notes on a connected display after monitor or work-area changes.
const { screen } = require("electron");
const { DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT } = require("./note/noteSize");

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clampToVisibleDisplay({ x, y, width, height }) {
  const w = width || DEFAULT_NOTE_WIDTH;
  const h = height || DEFAULT_NOTE_HEIGHT;
  const displays = screen.getAllDisplays();

  if (typeof x === "number" && typeof y === "number") {
    const bounds = { x, y, width: w, height: h };
    const onScreen = displays.find((d) => rectsIntersect(bounds, d.workArea));
    if (onScreen) return { x, y, width: w, height: h, displayId: onScreen.id };
  }

  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;
  return {
    x: wa.x + 40,
    y: wa.y + 40,
    width: w,
    height: h,
    displayId: primary.id,
  };
}

function displayIdForPoint(x, y) {
  return screen.getDisplayNearestPoint({ x, y }).id;
}

module.exports = { clampToVisibleDisplay, displayIdForPoint };
