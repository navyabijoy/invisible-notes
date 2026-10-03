<p align="center">
  <img src="docs/favicon.svg" alt="Ghost Notes logo" width="96" height="96" />
</p>

<h1 align="center">Ghost Notes</h1>

<p align="center">
  <b>Translucent sticky notes that float above everything — and stay invisible to screen sharing and recording.</b>
</p>

<p align="center">
  <a href="https://github.com/navyabijoy/invisible-notes/releases"><img src="https://img.shields.io/github/downloads/navyabijoy/invisible-notes/total" alt="Downloads" /></a>
  <a href="https://github.com/navyabijoy/invisible-notes/releases"><img src="https://img.shields.io/github/v/release/navyabijoy/invisible-notes" alt="Latest release" /></a>
  <a href="https://github.com/navyabijoy/invisible-notes/actions/workflows/ci.yml"><img src="https://github.com/navyabijoy/invisible-notes/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-33-blue?logo=electron&logoColor=white" alt="Electron" /></a>
  <a href="https://ghostnotes.navyabijoy.tech"><img src="https://img.shields.io/badge/website-ghostnotes.navyabijoy.tech-8a63d2" alt="Website" /></a>
</p>

Works with **Zoom, Google Meet, Microsoft Teams, QuickTime, OBS** and native screen recording on **macOS** and **Windows**.

Demoing a take-home assignment? Giving a code walkthrough while sharing your screen? Keep your talking points on-screen with natural eye contact — nobody watching the call or the recording ever sees them.

**Private. Local. Lightweight.** No account, no cloud, no telemetry on note content. Your notes never leave your computer.

<p align="center">
  <img src="docs/assets/notes-manager.png" alt="Ghost Notes — Notes Manager" width="760" />
</p>

<p align="center"><sub>The Notes Manager — every note you've ever written, searchable, with workspaces, backup and shortcuts.</sub></p>

---

## Table of contents

- [Features](#features)
- [Install](#install)
- [How it works](#how-it-works)
- [Usage](#usage)
  - [Note controls](#note-controls)
  - [Keyboard shortcuts](#keyboard-shortcuts)
  - [Notes Manager](#notes-manager)
  - [Workspaces](#workspaces)
  - [Backup & restore](#backup--restore)
  - [Settings](#settings)
- [Verify the invisibility](#verify-the-invisibility)
- [Storage & privacy](#storage--privacy)
- [Multi-monitor](#multi-monitor)
- [Platform support & known limitations](#platform-support--known-limitations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Building a standalone app](#building-a-standalone-app)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Screen-capture exclusion** — notes are visible to you, invisible to recordings and screen shares.
- **Always on top** — pinned notes stay above your other apps, including fullscreen apps on macOS.
- **Rich text notes** — bold, italic, underline, strikethrough, headings, quotes, bulleted/numbered lists, **checklists**, text colors, monospace/code mode, adjustable font size and opacity.
- **Paste images** — screenshots and images from the clipboard are embedded straight into a note.
- **Notes Manager** — every note you've ever created in one searchable list: open, hide, rename, move, delete.
- **Workspaces** — group notes (e.g. "Interview", "Personal") and switch between them from the tray or the manager sidebar.
- **Customizable shortcuts** — every shortcut can be rebound in-app, or reset to defaults.
- **Click-through mode** — let clicks pass straight through a note while you keep reading it.
- **Multi-monitor aware** — each note remembers its display; off-screen notes are recovered automatically.
- **Local & offline** — one JSON file in your OS app-data folder, optionally encrypted with the OS keychain.

## Install

<img src="build/icon.png" alt="Ghost Notes app icon" width="72" height="72" align="right" />

Grab the latest build from the **[Releases page](https://github.com/navyabijoy/invisible-notes/releases)**:

| Platform | Artifact                                               |
| -------- | ------------------------------------------------------ |
| macOS    | `Ghost Notes-*.dmg` (universal, Intel + Apple Silicon) |
| Windows  | `Ghost Notes Setup *.exe` (NSIS installer)             |

> [!NOTE]
> Builds are currently **unsigned**. On macOS you may need to right-click → **Open** the first time (or `xattr -cr /Applications/Ghost\ Notes.app`); on Windows choose **More info → Run anyway** in SmartScreen. This is expected until code-signing is configured — see [RELEASE.md](RELEASE.md).

Prefer to run from source:

```bash
git clone https://github.com/navyabijoy/invisible-notes.git
cd invisible-notes
npm install
npm start
```

The app lives in the **menu bar / system tray** (no Dock icon on macOS) — look for the ghost icon:

<img src="build/tray-icon.png" alt="Ghost Notes tray icon" width="20" height="20" />

A note appears near your cursor on first launch.

## How it works

Each note is a frameless, transparent Electron `BrowserWindow` with `setContentProtection(true)`. The operating system excludes that window from screen capture while you still see it normally. Notes are always-on-top (`screen-saver` level) and, on macOS, visible on every Space including fullscreen apps.

Content protection is applied before a note is first shown and re-applied after every hide/restore on Windows. If a saved position falls outside every connected display, the note is clamped back onto a visible screen before it appears.

## Usage

### Note Controls

Hover a note to reveal its top bar:

| Control             | What it does                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ⠿ (drag handle)     | Drag to move the note. Drag any edge or corner to resize.                                                             |
| Color dot           | Opens the palette — pick the note's color.                                                                            |
| Opacity slider      | Fades the note from 30% to 100%.                                                                                      |
| **Aa** (Formatting) | Bold / italic / underline / strikethrough, headings, quote, bullet/numbered/check lists, text colors, `{}` monospace. |
| `A−` / `A+`         | Smaller / larger text.                                                                                                |
| 📌 Pin              | **Pinned (default):** always on top, even when you switch apps. **Unpinned:** behaves like a normal window.           |
| 👻 Ghost            | Click-through mode — clicks pass to whatever is behind the note. Hover the bar to interact again.                     |
| ＋                  | Creates a new note.                                                                                                   |
| ✕                   | **Hides** the note — it does _not_ delete it. It stays in the Notes Manager and can be reopened any time.             |

Permanently deleting a note is only possible from the **Notes Manager** (with a confirmation prompt).

### Keyboard shortcuts

| Action                     | macOS  | Windows            | Scope      |
| -------------------------- | ------ | ------------------ | ---------- |
| New note                   | `⌘⇧N`  | `Ctrl+Shift+N`     | App        |
| New note from anywhere     | `⌘⌥⇧N` | `Ctrl+Alt+Shift+N` | **Global** |
| Notes Manager              | `⌘⇧M`  | `Ctrl+Shift+M`     | App        |
| Hide / show all notes      | `⌘⇧H`  | `Ctrl+Shift+H`     | App        |
| Toggle click-through (all) | `⌘⇧G`  | `Ctrl+Shift+G`     | App        |
| Search notes (in Manager)  | `⌘K`   | `Ctrl+K`           | Manager    |
| Close dialog / cancel      | `Esc`  | `Esc`              | Manager    |

**Scope** matters: app-scoped shortcuts only fire while a Ghost Notes window has focus, so the same keys stay free for your browser, IDE and OS. The three-modifier **global** new-note shortcut is the only exception — it's your way back in when every Ghost Notes window is hidden.

You never have to come back here to look any of this up: **tray icon → Keyboard Shortcuts…**, or the **?** button in the Notes Manager, shows the live list, lets you rebind any row, and reset to defaults.

### Notes Manager

Open it with `Cmd/Ctrl+Shift+M`, the tray menu, or the **?** button.

- **Search** all notes instantly (`Cmd/Ctrl+K` to focus).
- **Open / hide** a note, **rename** it inline, **move** it to another workspace, or **delete** it permanently.
- **Workspaces** sidebar with per-workspace note counts.
- Toolbar buttons for **New note**, **Export** and **Import**.
- **Settings** (gear icon in the sidebar): Appearance, Shortcuts, Storage, About.

### Workspaces

Workspaces let you keep separate piles of notes (client work, interviews, shopping lists…).

- Create, rename and delete them from the manager sidebar (the last remaining workspace can't be deleted).
- Move a note between workspaces via its **⋯** menu in the list.
- Switch the active workspace from the tray menu (**Switch Workspace**) or the workspace chip in the manager.
- Notes always belong to a workspace; deleting a workspace moves its notes to another one instead of losing them.

### Backup & restore

In the Notes Manager toolbar (or **Settings → Storage**):

- **Export all notes** writes every note to a plain JSON backup file. The file itself is **not** encrypted — keep it somewhere safe.
- **Import notes** restores a backup, either **merging** it with your current notes (duplicates skipped) or **replacing** them.

### Settings

**Settings → Appearance** changes the manager's own look — light/dark/system theme and accent color. It only affects the manager window; every note keeps its own color.

## Verify the invisibility

1. Start a screen recording (QuickTime → File → New Screen Recording on macOS, `Win+Shift+R` on Windows 11, or OBS), **or** join a Zoom/Meet/Teams call and share your screen.
2. The note stays visible on your screen but does **not** appear in the recording or for viewers.

> First time only on macOS: the OS may ask you to grant the app **Screen Recording** permission in System Settings → Privacy & Security. Content protection works regardless, but granting it avoids the OS prompt.

## Storage & privacy

- **No login, no account, no cloud sync, no analytics.** The app works fully offline after install.
- All note data (text, position, size, color, opacity, formatting, open/hidden state, settings, shortcut overrides) is stored in **one JSON file**: `notes.json` inside the Electron `userData` folder — `%APPDATA%\invisible-notes\` on Windows, `~/Library/Application Support/invisible-notes/` on macOS.
- **Encrypted at rest** with the OS keychain (`safeStorage`: DPAPI on Windows, Keychain on macOS) whenever the platform supports it. If it doesn't, notes are stored in plaintext and a warning is logged. Exports are always plain JSON.
- Pasted images live as files under `userData/note-images/`; the JSON only references their filenames.
- If `notes.json` is ever corrupted, it's backed up and reset rather than deleted — you're told where the backup is.

## Multi-monitor

Each note remembers which display it was on. If a monitor is disconnected, or a note's saved position ends up off-screen (resolution/DPI change, etc.), it's automatically repositioned back onto a connected display the next time you see it — notes never become permanently unreachable.

## Platform support & known limitations

Ghost Notes is built to work on both macOS and Windows, but a couple of OS-level behaviors are genuinely not identical — documented here rather than silently assumed:

| Behavior                                                | macOS                                                             | Windows                                                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen-capture exclusion                                | Reliable across QuickTime, native recording, Zoom/Meet/Teams, OBS | Requires Windows 10 build 19041 (May 2020 Update) or later. On older Windows builds, notes may be visible to screen recordings — this is an OS limitation, not a bug. |
| Visible over fullscreen apps you're sharing             | Yes (`visibleOnFullScreenSpaces`)                                 | No native equivalent — Windows has no per-app virtual-desktop concept like macOS Spaces. Always-on-top still applies otherwise.                                       |
| Tray icon                                               | Adaptive light/dark menu bar icon                                 | Standard system tray icon                                                                                                                                             |
| Storage encryption (`safeStorage`)                      | Keychain                                                          | DPAPI (available on all supported builds)                                                                                                                             |
| Click-through, drag, resize, multi-monitor, DPI scaling | Cross-platform via Electron APIs                                  | Same                                                                                                                                                                  |

If you hit different behavior on Windows than described here, please [open an issue](https://github.com/navyabijoy/invisible-notes/issues) with your Windows build number.

## Troubleshooting

<details>
<summary><b>I can't find the app / no window opens</b></summary>

Ghost Notes is tray-only. Look for the ghost icon in the menu bar (macOS) or the system tray overflow (`^` arrow, Windows). Click it → **New Note**, or press the global shortcut `Cmd/Ctrl+Alt+Shift+N`.
</details>

<details>
<summary><b>A shortcut does nothing</b></summary>

App-scoped shortcuts only work while a Ghost Notes window is focused — that's intentional so they don't shadow your other apps. If the _global_ shortcut is silent, another app already owns that keybinding; rebind it under **Keyboard Shortcuts…**.
</details>

<details>
<summary><b>Windows SmartScreen / macOS Gatekeeper blocks the app</b></summary>

Builds are unsigned (see [RELEASE.md](RELEASE.md)). Windows: **More info → Run anyway**. macOS: right-click → **Open**, or `xattr -cr /Applications/Ghost\ Notes.app`.
</details>

<details>
<summary><b>Notes appear in the recording (Windows)</b></summary>

Screen-capture exclusion needs Windows 10 build 19041 or newer. Check with `winver`. On older builds this is an OS limitation, not a bug.
</details>

<details>
<summary><b>A note vanished</b></summary>

Notes are hidden, not deleted (unless you deleted them in the Manager). Press `Cmd/Ctrl+Shift+H` to show all, or open the **Notes Manager** — everything you've ever created is listed there.
</details>

## Development

**Requirements:** Node.js 20+ and npm.

```bash
npm install       # install dependencies
npm start         # launch the tray app (Electron)
npm test          # Node's built-in test runner (node --test)
npm run format    # Prettier, write
npm run format:check  # Prettier, verify (CI runs this)
```

CI (`.github/workflows/ci.yml`) runs formatting checks and tests on Ubuntu and Windows across Node 20 and 22.

**Architecture** (full details in [AGENTS.md](AGENTS.md)):

```text
main.js          app entry — windows, tray, IPC, store, shortcuts
store.js         NoteStore — versioned JSON persistence + optional OS encryption
platform.js      every platform branch lives here (never check process.platform elsewhere)
displayUtils.js  multi-monitor helpers (clamping, display-id lookup)
note/            note window: factory, renderer, preload
manager/         Notes Manager window, shortcuts, renderer, preload
test/            store + shortcut tests (node --test)
docs/            marketing site (GitHub Pages)
```

There is **no bundler and no TypeScript** — plain Node.js + Electron with CommonJS `require`. IPC payloads are validated in the main process before touching the store, and all platform-specific behavior is isolated in `platform.js`.

## Building a standalone app

```bash
npm run dist:mac    # macOS .dmg / .zip (universal)
npm run dist:win    # Windows installer (.exe via NSIS)
```

Pushing a `v*` tag triggers the release workflow (`.github/workflows/release.yml`), which builds both platforms and attaches them to a GitHub Release. See [RELEASE.md](RELEASE.md) for signing/notarization setup and the full release checklist.

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) first. In short:

1. Comment on the issue you want before writing code; wait to be assigned.
2. Branch from `develop` as `feat/issue-N-…` or `fix/issue-N-…`.
3. Open a PR **against `develop`**, reference the issue (`Closes #N`).
4. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat(note): …`, `fix(platform): …`).
5. `npm run format:check` and `node --test` must pass.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
