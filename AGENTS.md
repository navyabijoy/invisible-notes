# Ghost Notes — Agent Guide

Translucent sticky notes that stay **invisible to screen sharing and recording**. Each note is a frameless, transparent Electron `BrowserWindow` with `setContentProtection(true)`. The OS excludes it from screen capture while the user sees it normally.

## Architecture

```
main.js               — app entry; orchestrates windows, tray, IPC, store, shortcuts
store.js              — NoteStore class; versioned JSON persistence with optional OS-level encryption
platform.js           — ALL platform branches live here; never branch on process.platform elsewhere
displayUtils.js       — multi-monitor helpers (clamping, display-id lookup)
note/
  noteWindow.js       — BrowserWindow factory for note windows
  noteSize.js         — shared size constants
  note.html / note.js — note renderer (vanilla HTML + JS, no bundler)
  preload.js          — contextBridge for note windows
manager/
  manager.js          — Notes Manager window + IPC handlers
  manager.html / manager-renderer.js — manager UI (vanilla HTML + JS)
  manager-preload.js  — contextBridge for the manager window
  shortcuts.js        — keyboard shortcut registration
test/
  store.test.js       — Node test runner (node --test)
  shortcuts.test.js
```

**IPC conventions**

- `note:*` — events between note windows and main
- `manager:*` — events between the manager window and main
- All IPC payloads are validated in main before touching the store.

**Data flow**: renderer → IPC → `main.js` action → `store.update()` → `manager.notifyChanged()` → manager renderer re-renders.

## Coding Rules

- **No bundler, no TypeScript.** Vanilla Node.js + Electron, CommonJS `require`.
- **Platform isolation.** Keep all `process.platform` checks in `platform.js`. Call helpers from there everywhere else.
- **Minimal comments.** Explain the _why_ when it is not obvious; skip comments that just restate what the code does.
- **Input validation at IPC boundaries.** Validate type and shape of every IPC payload before acting on it.
- **`hide` ≠ `delete`.** Closing a note hides it (`visible: false`); only the Notes Manager can permanently delete a record.
- **Store version.** `STORE_VERSION` in `store.js` must be bumped and a migration branch added when the schema changes.
- **No node_modules or dist commits.** Check `.gitignore` before adding new generated files.

## Style

- 2-space indentation, LF line endings, UTF-8 (enforced by `.editorconfig`).
- Prettier with default settings formats everything — do not fight it.
- Conventional Commits: `feat(scope): short description`. Scopes: `main`, `note`, `manager`, `platform`, `store`, `shortcuts`, `preload`, `docs`, `build`, `deps`.

## Before Pushing

Run these in order; fix any failures before committing:

```bash
npm run format:check   # Prettier — must exit 0
node --test            # Node built-in test runner
```

Husky runs `lint-staged` (auto-formats staged files) on every commit via the pre-commit hook — you do not need to run `npm run format` manually before committing.

## Running Locally

```bash
npm install
npm start              # launches the tray app
```

The app has no Dock icon on macOS — look for the ghost icon in the menu bar / system tray.

## Key Invariants

- Every note window has `setContentProtection(true)` applied before it is shown and re-applied after hide/restore on Windows.
- Notes whose saved position is off-screen are clamped to a connected display via `clampToVisibleDisplay` before being shown.
- The store always has at least one workspace; `removeWorkspace` is a no-op when only one remains.
- `singleInstanceLock` prevents duplicate note windows from a second launch.
