# Ghost Notes (macOS,Windows)

![Downloads](https://img.shields.io/github/downloads/navyabijoy/invisible-notes/total)

Translucent sticky notes that float on top of everything but stay **invisible to screen sharing and recording** (Zoom, Google Meet, Microsoft Teams, QuickTime, OBS, native screen recording).

Perfect for demoing a take-home assignment or giving a code walkthrough while sharing your screen — keep your talking points on-screen with natural eye contact, and nobody watching the recording sees them.

Private. Local. Lightweight. No account, no cloud, no telemetry on note content — your notes stay on your computer.

## How it works

Each note is a frameless, transparent Electron window with `setContentProtection(true)`. The OS excludes that window from screen capture while you still see it normally. Notes are always-on-top and stay visible even over fullscreen apps (macOS).

## Run

```bash
npm install
npm start
```

The app lives in the **menu bar / system tray** (no Dock icon on macOS). A note appears near your cursor on first launch.

## Usage

- **New note:** `Cmd/Ctrl+Shift+N` (or tray icon → New Note, or the ＋ on a note)
- **Notes Manager:** `Cmd/Ctrl+Shift+M` (or tray icon → Notes Manager…) — see every note you've ever created, open/hide/rename/delete it
- **Hide / show all notes:** `Cmd/Ctrl+Shift+H`
- **Toggle click-through (all notes):** `Cmd/Ctrl+Shift+G`
- **Move a note:** hover to reveal the top bar, then drag it
- **Resize:** drag any edge/corner
- **Color:** click the color dot in the hover bar to open a small palette
- **Opacity / text size:** controls in the hover bar
- **Code / monospace:** the `{}` icon in the hover bar switches that note to a monospace font (saved per note)
- **Pin / unpin:** the 📌 icon in the hover bar. Pinned (default) keeps the note always-on-top, even when you switch to another app. Unpinned makes it a normal window that gets covered when another app is focused.
- **Click-through mode:** the ghost icon (👻) in the hover bar — clicks pass through to whatever is behind the note; hover the bar to interact again
- **Close a note:** ✕ in the hover bar — this **hides** the note, it does not delete it. The note stays in the Notes Manager and can be reopened any time.
- **Delete a note permanently:** only from the Notes Manager, with a confirmation prompt.
- **Quit:** tray icon → Quit

If a global shortcut above doesn't register (another app already uses it), Ghost Notes logs a warning and keeps running — that shortcut just won't fire; everything is still reachable from the tray menu and Notes Manager.

Notes (text, position, size, color, opacity, open/hidden state) auto-save and reappear on next launch. Data lives in a single local JSON file in the OS app-data folder — never uploaded anywhere.

## Multi-monitor

Each note remembers which display it was on. If a monitor is disconnected, or a note's saved position ends up off-screen (resolution/DPI change, etc.), it's automatically repositioned back onto a connected display the next time you see it — notes never become permanently unreachable.

## Verify the invisibility

1. Start a screen recording (QuickTime → File → New Screen Recording, or Windows' built-in screen recorder) or a Zoom/Meet/Teams call with screen share.
2. The note stays visible on your screen but does **not** appear in the recording / to viewers.

> First time only on macOS: the OS may ask you to grant the app **Screen Recording** permission in System Settings → Privacy & Security. Content protection works regardless, but granting it avoids the OS prompt.

## Platform support & known limitations

Ghost Notes is built to work on both macOS and Windows, but a couple of OS-level behaviors are genuinely not identical — documented here rather than silently assumed:

| Behavior | macOS | Windows |
|---|---|---|
| Screen-capture exclusion | Reliable across QuickTime, native recording, Zoom/Meet/Teams, OBS | Requires Windows 10 build 19041 (May 2020 Update) or later. On older Windows builds, notes may be visible to screen recordings — this is an OS limitation, not a bug. |
| Visible over fullscreen apps you're sharing | Yes (`visibleOnFullScreenSpaces`) | No native equivalent — Windows has no per-app virtual-desktop concept like macOS Spaces. Always-on-top still applies otherwise. |
| Tray icon | Adaptive light/dark menu bar icon | Standard system tray icon |
| Click-through, drag, resize, multi-monitor, DPI scaling | Cross-platform via Electron APIs | Same |

If you hit different behavior on Windows than described here, please open an issue with your Windows build number.

## Privacy

- No login, no account, no cloud sync.
- All note data is stored in a single local JSON file under the OS user-data directory.
- No analytics capture note content, ever. If telemetry is ever added, it will never include note text.
- The app works fully offline after install.

## Build a standalone app

```bash
npm run dist:mac    # macOS .dmg / .zip
npm run dist:win    # Windows installer (.exe via NSIS)
```

Windows builds are currently unsigned — Windows SmartScreen may warn on first run until code-signing is set up.
