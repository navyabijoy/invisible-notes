const COLOR_TINTS = {
  yellow: '#f0e27f',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#ddd6fe',
  dark: '#28292e'
};

const ICONS = {
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  notes: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>',
  move: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6"/><path d="m17 15 3 3-3 3"/><path d="M13 18h7"/></svg>'
};

const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const workspaceSelectEl = document.getElementById('workspaceSelect');
const wsFormEl = document.getElementById('wsForm');
const wsNameInputEl = document.getElementById('wsNameInput');
const wsDeleteEl = document.getElementById('wsDelete');

// Curated accent palette (Manager-only). Base + pre-tested hover/light
// variants so no runtime color math is needed. `ltDark` is the dark-mode
// counterpart of `lt` — inline styles beat the [data-theme="dark"] block,
// so a single CSS fallback can't serve all five accents. Ids must match
// ACCENT_IDS in store.js; unknown ids fall back to violet.
const ACCENTS = {
  violet: { base: '#5b4bff', dk: '#4a3ae8', lt: '#f0edff', ltDark: '#2b2666', label: 'Violet' },
  blue: { base: '#2563eb', dk: '#1d4ed8', lt: '#e0eaff', ltDark: '#233063', label: 'Blue' },
  green: { base: '#15803d', dk: '#166534', lt: '#dcf5e3', ltDark: '#1e3a2a', label: 'Green' },
  orange: { base: '#c2410c', dk: '#9a3412', lt: '#ffe9d6', ltDark: '#4a2a1a', label: 'Orange' },
  pink: { base: '#be185d', dk: '#9d174d', lt: '#fce0ec', ltDark: '#47223c', label: 'Pink' }
};

let notes = [];
let workspaces = [];
let activeWorkspace = null;
let appearance = { theme: 'system', accent: 'violet', effectiveDark: false };
let query = '';
let shortcuts = [];
// null when the inline name row is closed, otherwise 'create' | 'rename'.
let formMode = null;

function label(note) {
  return (note.title || '').trim();
}

function snippet(note) {
  return (note.text || '').replace(/\s+/g, ' ').trim();
}

function relativeTime(ts) {
  if (!ts) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString();
}

function matches(note, q) {
  if (!q) return true;
  const hay = (label(note) + ' ' + snippet(note)).toLowerCase();
  return hay.includes(q.toLowerCase());
}

function render() {
  // The list only ever shows the active workspace, since switching workspace is
  // what changes which notes are on screen, so the manager mirrors that.
  const inWorkspace = notes.filter((n) => n.workspaceId === activeWorkspace);
  const filtered = inWorkspace
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((n) => matches(n, query));

  listEl.innerHTML = '';

  if (inWorkspace.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = ICONS.notes;

    const message = document.createElement('div');
    message.textContent = 'No notes in this workspace.';
    message.appendChild(document.createElement('br'));
    const newNoteKeys = shortcutDisplay('newNote');
    message.appendChild(
      document.createTextNode(
        newNoteKeys ? `Click "New" or press ${newNoteKeys} to create one.` : 'Click "New" to create one.'
      )
    );

    empty.appendChild(message);
    listEl.appendChild(empty);
    return;
  }
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty">${ICONS.notes}<div>No notes match your search.</div></div>`;
    return;
  }

  for (const note of filtered) {
    const card = document.createElement('div');
    card.className = 'card';

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = COLOR_TINTS[note.color] || COLOR_TINTS.yellow;

    const info = document.createElement('div');
    info.className = 'info';

    const titleInput = document.createElement('input');
    titleInput.className = 'title';
    titleInput.value = label(note);
    titleInput.placeholder = snippet(note).slice(0, 40) || 'Untitled note';
    titleInput.addEventListener('change', () => {
      window.manager.rename(note.id, titleInput.value);
    });
    titleInput.addEventListener('click', (e) => e.stopPropagation());

    const snippetEl = document.createElement('div');
    snippetEl.className = 'snippet';
    snippetEl.textContent = snippet(note) || 'Empty note';

    const metaEl = document.createElement('div');
    metaEl.className = 'meta';
    metaEl.textContent = 'Edited ' + relativeTime(note.updatedAt);

    info.appendChild(titleInput);
    info.appendChild(snippetEl);
    info.appendChild(metaEl);

    const actions = document.createElement('div');
    actions.className = 'actions';

    // Move-to-workspace. Pointless with only one workspace, so it isn't
    // rendered until a second one exists.
    if (workspaces.length > 1) {
      // The icon is what the user sees; the select is transparent on top of
      // it so clicking anywhere on the icon opens the native workspace list.
      const moveWrap = document.createElement('span');
      moveWrap.className = 'move-wrap';
      moveWrap.title = 'Move to workspace';
      moveWrap.innerHTML = ICONS.move;

      const moveSelect = document.createElement('select');
      moveSelect.className = 'move-select';
      moveSelect.setAttribute('aria-label', 'Move note to workspace');
      for (const workspace of workspaces) {
        const opt = document.createElement('option');
        opt.value = workspace.id;
        opt.textContent = workspace.name;
        opt.selected = workspace.id === note.workspaceId;
        moveSelect.appendChild(opt);
      }
      moveSelect.addEventListener('change', () => {
        window.manager.moveNote(note.id, moveSelect.value);
      });
      // The card opens the note on double-click; don't let clicks in the
      // dropdown bubble up to that handler.
      moveSelect.addEventListener('dblclick', (e) => e.stopPropagation());

      moveWrap.appendChild(moveSelect);
      actions.appendChild(moveWrap);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.title = 'Delete permanently';
    deleteBtn.innerHTML = ICONS.trash;
    deleteBtn.addEventListener('click', () => window.manager.delete(note.id));

    actions.appendChild(deleteBtn);

    card.appendChild(swatch);
    card.appendChild(info);
    card.appendChild(actions);

    // Double-click to open/show the note
    card.addEventListener('dblclick', () => {
      window.manager.open(note.id);
    });

    listEl.appendChild(card);
  }
}

// ─── Workspaces (issue #8) ──────────────────────────────────────
function renderWorkspaces() {
  workspaceSelectEl.innerHTML = '';
  for (const workspace of workspaces) {
    const count = notes.filter((n) => n.workspaceId === workspace.id).length;
    const opt = document.createElement('option');
    opt.value = workspace.id;
    opt.textContent = `${workspace.name} (${count})`;
    opt.selected = workspace.id === activeWorkspace;
    workspaceSelectEl.appendChild(opt);
  }
  // The last workspace can't be deleted. The store refuses, so don't
  // offer it either.
  wsDeleteEl.disabled = workspaces.length <= 1;
}

// Electron disables window.prompt(), so create/rename share this inline row
// rather than a native text dialog.
function openWorkspaceForm(mode) {
  formMode = mode;
  const current = workspaces.find((w) => w.id === activeWorkspace);
  wsNameInputEl.value = mode === 'rename' && current ? current.name : '';
  wsFormEl.hidden = false;
  wsNameInputEl.focus();
  wsNameInputEl.select();
}

function closeWorkspaceForm() {
  formMode = null;
  wsFormEl.hidden = true;
  wsNameInputEl.value = '';
}

workspaceSelectEl.addEventListener('change', () => {
  closeWorkspaceForm();
  window.manager.setWorkspace(workspaceSelectEl.value);
});

document.getElementById('wsNew').addEventListener('click', () => openWorkspaceForm('create'));
document.getElementById('wsRename').addEventListener('click', () => openWorkspaceForm('rename'));
wsDeleteEl.addEventListener('click', () => window.manager.deleteWorkspace(activeWorkspace));
document.getElementById('wsCancel').addEventListener('click', () => closeWorkspaceForm());

wsFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = wsNameInputEl.value.trim();
  if (!name) {
    closeWorkspaceForm();
    return;
  }
  if (formMode === 'create') window.manager.createWorkspace(name);
  else if (formMode === 'rename') window.manager.renameWorkspace(activeWorkspace, name);
  closeWorkspaceForm();
});

wsNameInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeWorkspaceForm();
});

// ─── Notes ──────────────────────────────────────────────────────
searchEl.addEventListener('input', () => {
  query = searchEl.value;
  render();
});

document.getElementById('newNote').addEventListener('click', () => window.manager.newNote());

// Notes and workspaces always arrive together so the list can never render
// against a stale workspace set. Theme/accent ride the same snapshot so the
// list never paints with a stale theme.
function applySnapshot(snapshot) {
  notes = snapshot.notes || [];
  workspaces = snapshot.workspaces || [];
  activeWorkspace = snapshot.activeWorkspace || null;
  appearance = {
    theme: ['light', 'dark', 'system'].includes(snapshot.theme) ? snapshot.theme : 'system',
    accent: ACCENTS[snapshot.accent] ? snapshot.accent : 'violet',
    effectiveDark: !!snapshot.effectiveDark
  };
  applyAppearance();
  renderWorkspaces();
  render();
}

// ─── Appearance (Manager-only theme + accent) ──────────────
function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = appearance.effectiveDark ? 'dark' : 'light';
  const accent = ACCENTS[appearance.accent] || ACCENTS.violet;
  root.style.setProperty('--accent', accent.base);
  root.style.setProperty('--accent-dk', accent.dk);
  root.style.setProperty('--accent-lt', appearance.effectiveDark ? accent.ltDark : accent.lt);
  document.querySelectorAll('[data-theme-opt]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.themeOpt === appearance.theme));
  });
  document.querySelectorAll('#accents .accent-dot').forEach((dot) => {
    dot.setAttribute('aria-pressed', String(dot.dataset.accent === appearance.accent));
  });
}

function buildAccentDots() {
  const wrap = document.getElementById('accents');
  wrap.innerHTML = '';
  for (const [id, def] of Object.entries(ACCENTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'accent-dot';
    btn.dataset.accent = id;
    btn.title = def.label;
    btn.setAttribute('aria-label', def.label + ' accent');
    btn.setAttribute('aria-pressed', 'false');
    btn.style.background = def.base;
    btn.addEventListener('click', () => window.manager.setAccent(id));
    wrap.appendChild(btn);
  }
}

document.querySelectorAll('[data-theme-opt]').forEach((btn) => {
  btn.addEventListener('click', () => window.manager.setTheme(btn.dataset.themeOpt));
});
buildAccentDots();

document.getElementById('exportNotes').addEventListener('click', async () => {
  const res = await window.manager.exportAll();
  if (res && res.ok) flashStatus(`Exported ${res.count} note${plural(res.count)}`);
});

document.getElementById('importNotes').addEventListener('click', async () => {
  const res = await window.manager.importNotes();
  if (res && res.ok) {
    const dupes = res.skipped ? `, skipped ${res.skipped} duplicate${plural(res.skipped)}` : '';
    flashStatus(`Imported ${res.added} note${plural(res.added)}${dupes}`);
  }
});

function plural(n) {
  return n === 1 ? '' : 's';
}

// Brief, non-modal feedback in the footer; errors already surface as native
// dialogs from the main process.
let statusTimer = null;
function flashStatus(text) {
  const el = document.getElementById('status');
  el.textContent = text;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = '';
  }, 4000);
}

window.manager.onChanged(applySnapshot);
window.manager.list().then(applySnapshot);

window.manager.version().then((v) => {
  document.getElementById('version').textContent = 'Ghost Notes v' + v;
});

// ─── Shortcut legend ──────────────────────────────────────
// Read-only for now (issue #20). The rows come from the shortcut definitions
// in the main process, already formatted for this platform, so nothing here
// needs to know how an accelerator is spelled — when issue #5 lands custom
// bindings, this list reflects them without changes.
const shortcutsEl = document.getElementById('shortcuts');
const shortcutsBodyEl = document.getElementById('shortcutsBody');

const SCOPE_SECTIONS = [
  {
    scope: 'app',
    title: 'In Ghost Notes',
    note: 'Active while a note or this window has focus, so the same keys stay free in your browser and editor.'
  },
  {
    scope: 'global',
    title: 'Anywhere',
    note: 'Registered system-wide, so you can always reach a new note even when every Ghost Notes window is hidden.'
  }
];

function shortcutDisplay(id) {
  const match = shortcuts.find((s) => s.id === id);
  return match ? match.display : '';
}

function shortcutRow(shortcut) {
  const row = document.createElement('div');
  row.className = 'sc-row';

  const text = document.createElement('div');
  text.className = 'sc-text';

  const labelEl = document.createElement('div');
  labelEl.className = 'sc-label';
  labelEl.textContent = shortcut.label;

  const descEl = document.createElement('div');
  descEl.className = 'sc-desc';
  descEl.textContent = shortcut.description;

  text.appendChild(labelEl);
  text.appendChild(descEl);

  const keys = document.createElement('kbd');
  keys.className = 'sc-keys';
  keys.textContent = shortcut.display;

  row.appendChild(text);
  row.appendChild(keys);
  return row;
}

function renderShortcuts(shortcuts) {
  shortcutsBodyEl.innerHTML = '';
  for (const section of SCOPE_SECTIONS) {
    const items = shortcuts.filter((s) => s.scope === section.scope);
    if (items.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'sc-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'sc-group-title';
    titleEl.textContent = section.title;

    const noteEl = document.createElement('div');
    noteEl.className = 'sc-group-note';
    noteEl.textContent = section.note;

    group.appendChild(titleEl);
    group.appendChild(noteEl);
    for (const shortcut of items) group.appendChild(shortcutRow(shortcut));

    shortcutsBodyEl.appendChild(group);
  }
}

// Loaded once at startup: the legend needs it, and so does the empty state's
// "or press …" hint. Re-renders the list because that hint can only be filled
// in once the bindings have arrived.
const shortcutsReady = window.manager.shortcuts().then((list) => {
  shortcuts = list;
  renderShortcuts(shortcuts);
  render();
});

// The legend covers the whole window, so it behaves as a modal. aria-modal
// tells assistive tech to ignore what is behind it but does nothing about the
// tab order, so the rest of the UI is marked inert while the panel is open.
// Focus moves into the panel and returns to wherever it came from on close —
// without the restore, Escape would leave focus on a now-hidden button.
const shortcutsCloseEl = document.getElementById('shortcutsClose');
// Everything the sheet covers, derived rather than listed: the workspace bar
// arrived after this was written, and an enumerated list would have silently
// left it tabbable behind the panel.
const behindTheSheet = [...document.body.children].filter(
  (el) => el !== shortcutsEl && el.tagName !== 'SCRIPT'
);
let focusBeforeShortcuts = null;

async function openShortcuts() {
  await shortcutsReady;
  if (!shortcutsEl.hidden) return;
  focusBeforeShortcuts = document.activeElement;
  shortcutsEl.hidden = false;
  for (const el of behindTheSheet) el.inert = true;
  shortcutsCloseEl.focus();
}

function closeShortcuts() {
  if (shortcutsEl.hidden) return;
  for (const el of behindTheSheet) el.inert = false;
  shortcutsEl.hidden = true;
  if (focusBeforeShortcuts && focusBeforeShortcuts.isConnected) focusBeforeShortcuts.focus();
  focusBeforeShortcuts = null;
}

document.getElementById('shortcutsBtn').addEventListener('click', openShortcuts);
shortcutsCloseEl.addEventListener('click', closeShortcuts);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !shortcutsEl.hidden) closeShortcuts();
});

// Opened straight onto the legend from the tray's "Keyboard Shortcuts…" item.
window.manager.onShowShortcuts(openShortcuts);
