const { execFile } = require("child_process");

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";

function hideDockIconIfMac(app) {
  if (isMac && app.dock) app.dock.hide();
}

function isCommandOrControlPressed(input) {
  return isMac
    ? !!input.meta && !input.control
    : !!input.control && !input.meta;
}

const MAC_SYMBOLS = {
  CommandOrControl: "⌘",
  CmdOrCtrl: "⌘",
  Command: "⌘",
  Cmd: "⌘",
  Control: "⌃",
  Ctrl: "⌃",
  Alt: "⌥",
  Option: "⌥",
  Shift: "⇧",
};
const MAC_MODIFIER_ORDER = ["⌃", "⌥", "⇧", "⌘"];
const WINDOWS_NAMES = {
  CommandOrControl: "Ctrl",
  CmdOrCtrl: "Ctrl",
  Command: "Ctrl",
  Cmd: "Ctrl",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Option: "Alt",
  Shift: "Shift",
};

function displayKey(part) {
  return part.length === 1 ? part.toUpperCase() : part;
}

function formatAccelerator(accelerator) {
  const parts = String(accelerator || "")
    .split("+")
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (isMac) {
    const symbols = parts.map((part) => MAC_SYMBOLS[part] || displayKey(part));
    const modifiers = symbols
      .filter((symbol) => MAC_MODIFIER_ORDER.includes(symbol))
      .sort(
        (a, b) => MAC_MODIFIER_ORDER.indexOf(a) - MAC_MODIFIER_ORDER.indexOf(b),
      );
    const keys = symbols.filter(
      (symbol) => !MAC_MODIFIER_ORDER.includes(symbol),
    );
    return modifiers.join("") + keys.join("");
  }
  return parts.map((part) => WINDOWS_NAMES[part] || displayKey(part)).join("+");
}

function setPinned(win, pinned) {
  if (pinned) {
    if (isLinux) {
      // On Linux/X11/XWayland, 'screen-saver' level can fail to set _NET_WM_STATE_ABOVE; 'normal' works reliably.
      win.setAlwaysOnTop(true, "normal");
      win.setVisibleOnAllWorkspaces(true);
    } else if (isMac) {
      win.setAlwaysOnTop(true, "screen-saver");
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenSpaces: true });
    } else {
      win.setAlwaysOnTop(true, "screen-saver");
    }
  } else {
    win.setAlwaysOnTop(false);
    if (isMac || isLinux) win.setVisibleOnAllWorkspaces(false);
  }
}

function applyLinuxCaptureExclusion({
  env = process.env,
  exec = execFile,
  execFile: legacyExecFile,
  callback,
} = {}) {
  const runner = legacyExecFile || exec;
  const done = (error, applied) => {
    if (callback) callback(error, applied);
  };

  if (!isLinux || !env.HYPRLAND_INSTANCE_SIGNATURE) {
    done(null, false);
    return false;
  }

  try {
    runner(
      "hyprctl",
      [
        "keyword",
        "windowrule",
        "no_screen_share on, match:class ^(invisible-notes)$",
      ],
      { env, timeout: 2000 },
      (err) => {
        done(err || null, !err);
      },
    );
    return true;
  } catch (err) {
    done(err, false);
    return false;
  }
}

function captureExclusionCaveat() {
  if (isWindows) {
    return "Screen-capture exclusion requires Windows 10 (build 19041) or later. On older Windows versions, notes may be visible to screen recordings.";
  }
  if (isLinux) {
    return "On Linux, Hyprland captures show a black box where a note is while the note stays on screen. KDE Plasma 6.6 and later can leave a window out of screencasts the same way. Other desktops have no mechanism.";
  }
  return null;
}

module.exports = {
  isMac,
  isWindows,
  isLinux,
  hideDockIconIfMac,
  isCommandOrControlPressed,
  formatAccelerator,
  setPinned,
  applyLinuxCaptureExclusion,
  captureExclusionCaveat,
};
