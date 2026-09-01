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

let notes = [];
let workspaces = [];
let activeWorkspace = null;
let query = '';
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
    listEl.innerHTML = `<div class="empty">${ICONS.notes}<div>No notes in this workspace.<br/>Click "New" or press &#8984;&#8679;N (Ctrl+Shift+N) to create one.</div></div>`;
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
// against a stale workspace set.
function applySnapshot(snapshot) {
  notes = snapshot.notes || [];
  workspaces = snapshot.workspaces || [];
  activeWorkspace = snapshot.activeWorkspace || null;
  renderWorkspaces();
  render();
}

window.manager.onChanged(applySnapshot);
window.manager.list().then(applySnapshot);

window.manager.version().then((v) => {
  document.getElementById('version').textContent = 'Ghost Notes v' + v;
});
