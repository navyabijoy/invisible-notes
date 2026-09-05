// Note geometry, kept apart from persistence and window code so the store,
// the window builder and the placement helpers all agree on one set of
// numbers without depending on each other.

// Size a brand new note is created at.
const DEFAULT_NOTE_WIDTH = 360;
const DEFAULT_NOTE_HEIGHT = 220;

// Smallest a note window may be. Enforced as BrowserWindow minWidth/minHeight
// and used to raise undersized sizes coming from disk or an import. The floor
// is set by the hover toolbar: below it, the trailing controls get clipped.
const MIN_NOTE_WIDTH = 280;
const MIN_NOTE_HEIGHT = 120;

module.exports = {
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  MIN_NOTE_HEIGHT
};
