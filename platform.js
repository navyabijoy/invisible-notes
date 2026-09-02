// Isolates macOS-vs-Windows differences so callers never branch on
// process.platform directly.
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// Hide the Dock icon on macOS (tray-only utility). No Windows equivalent
// needed — Windows apps without a main window simply don't get a taskbar
// entry when skipTaskbar is set on each window.
function hideDockIconIfMac(app) {
  if (isMac && app.dock) app.dock.hide();
}

// Electron reports Command and Control separately in before-input-event.
// Treat only the platform's primary shortcut modifier as CmdOrCtrl so an
// additional modifier does not accidentally trigger an app shortcut.
function isCommandOrControlPressed(input) {
  return isMac ? !!input.meta && !input.control : !!input.control && !input.meta;
}

// Pin/unpin a note window. Pinned = always-on-top, stays above whatever
// app you switch to. Unpinned = a normal window that other apps can cover
// when they're brought to the front, on both macOS and Windows.
//
// macOS additionally supports floating a window above fullscreen apps in
// other Spaces (visibleOnAllWorkspaces); Windows has no equivalent concept
// (no per-app virtual desktops the way macOS Spaces work), so that part is
// a no-op there — plain always-on-top is the best available behavior.
function setPinned(win, pinned) {
  if (pinned) {
    win.setAlwaysOnTop(true, 'screen-saver');
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenSpaces: true });
  } else {
    win.setAlwaysOnTop(false);
    if (isMac) win.setVisibleOnAllWorkspaces(false);
  }
}

// Screen-capture exclusion caveat differs by OS and Windows build:
// - macOS: setContentProtection -> NSWindowSharingNone. Reliable against
//   QuickTime, native screen recording, and most conferencing/OBS capture.
// - Windows: setContentProtection -> SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE),
//   only available on Windows 10 version 2004 (build 19041) and later.
//   Older Windows builds fall back to WDA_MONOCHROME or no exclusion at all,
//   and some legacy GDI-based capture tools may still be able to capture the
//   window. This is a genuine platform limitation, not a bug — surface it to
//   the user rather than pretend parity.
function captureExclusionCaveat() {
  if (isWindows) {
    return 'Screen-capture exclusion requires Windows 10 (build 19041) or later. On older Windows versions, notes may be visible to screen recordings.';
  }
  return null;
}

module.exports = {
  isMac,
  isWindows,
  hideDockIconIfMac,
  isCommandOrControlPressed,
  setPinned,
  captureExclusionCaveat
};
