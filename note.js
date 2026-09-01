const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const COLORS = {
  yellow: { tint: '255, 224, 130', dark: false },
  green:  { tint: '178, 235, 178', dark: false },
  blue:   { tint: '170, 214, 255', dark: false },
  pink:   { tint: '255, 190, 214', dark: false },
  purple: { tint: '212, 190, 255', dark: false },
  dark:   { tint: '40, 42, 48',   dark: true }
};

const root = document.documentElement;
const body = document.body;
const textEl = document.getElementById('text');
const opacityEl = document.getElementById('opacity');
const swatchesEl = document.getElementById('swatches');
const colorBtn = document.getElementById('colorBtn');
const colorPopover = document.getElementById('colorPopover');
const pinBtn = document.getElementById('pin');
const monoBtn = document.getElementById('mono');

let state = { text: '', color: 'yellow', opacity: 0.85, fontSize: 15, monospace: false, ghost: false, pinned: true, images: [] };

const noteEl = document.querySelector('.note');
const barEl = document.querySelector('.bar');

// --- Click-through ("ghost") mode ---
// When on, the note ignores mouse events (clicks reach whatever is behind it),
// EXCEPT while the cursor is over the toolbar — so you can still toggle it off,
// drag, or recolor. `forward:true` in the main process keeps mousemove events
// flowing to us even while clicks are being ignored, which powers this.
let ignoring = false;
function setIgnore(v) {
  if (v === ignoring) return;
  ignoring = v;
  window.notes.setIgnoreMouse(id, v);
}

function applyGhost() {
  noteEl.classList.toggle('ghost', state.ghost);
  if (state.ghost) {
    setIgnore(true); // pass clicks through by default; the toolbar re-enables
  } else {
    setIgnore(false); // fully interactive again
  }
  // While ghosted, the note is always forced on top (main process) so it
  // stays reachable — the pin toggle has no effect until ghost ends.
  pinBtn.disabled = state.ghost;
  pinBtn.style.opacity = state.ghost ? '0.25' : '';
}

function setGhost(on) {
  state.ghost = on;
  applyGhost();
  push();
}

window.addEventListener('mousemove', (e) => {
  if (!state.ghost) return;
  // Re-enable interaction only while hovering the toolbar.
  setIgnore(!e.target.closest('.bar'));
});

// --- Pin (always-on-top) toggle ---
// Pinned notes stay above whatever app you switch to, on both macOS and
// Windows. Unpinned notes behave like a normal window and get covered by
// whatever's currently focused. The main process owns the actual
// setAlwaysOnTop call; this just reflects/requests the state.
function applyPinned() {
  pinBtn.classList.toggle('active', state.pinned);
  pinBtn.title = state.pinned
    ? 'Pinned: stays on top when you switch apps'
    : 'Not pinned: can be covered by other windows';
}

function setPinned(on) {
  state.pinned = on;
  applyPinned();
  window.notes.setPinned(id, on);
}

pinBtn.addEventListener('click', () => setPinned(!state.pinned));

// --- Monospace (code snippet) toggle ---
// Proportional system UI font is the default; {} switches the textarea to
// a stacked monospace family so code walkthrough notes stay aligned.
function applyMonospace() {
  noteEl.classList.toggle('mono', state.monospace);
  monoBtn.classList.toggle('active', state.monospace);
  monoBtn.title = state.monospace
    ? 'Monospace on: click to use the default font'
    : 'Monospace: better for code snippets';
}

function setMonospace(on) {
  state.monospace = on;
  applyMonospace();
  push();
}

monoBtn.addEventListener('click', () => setMonospace(!state.monospace));

function applyColor(color) {
  const c = COLORS[color] || COLORS.yellow;
  root.style.setProperty('--tint', c.tint);
  body.classList.toggle('dark', c.dark);
  for (const el of swatchesEl.children) {
    el.classList.toggle('active', el.dataset.color === color);
  }
}

// --- Compact color popover ---
// Keep header minimal: one dot button opens a small palette instead of
// showing every swatch inline. Lives inside .bar so it inherits the same
// drag/no-drag and ghost-mode hover-to-interact rules as the rest of the toolbar.
function setColorPopoverOpen(open) {
  colorPopover.classList.toggle('open', open);
}

colorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setColorPopoverOpen(!colorPopover.classList.contains('open'));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.color-control')) setColorPopoverOpen(false);
});

// --- Notion-style inline images ---
// The note body is contenteditable: pasted images are saved as files in
// userData (main process owns disk I/O) and inserted as <img> at the caret,
// living inside the text flow. They're selected by click and deleted by
// backspace natively, like any other content. Persisted as ![img:name]
// tokens inside state.text; state.images mirrors the referenced filenames
// so main can clean up orphaned files.
let imagesDir = null; // absolute path, fetched once before first render
const IMG_TOKEN = /(!\[img:[^\]\s]+\])/;

function makeImg(name) {
  const img = document.createElement('img');
  if (!imagesDir) return img;
  const base = imagesDir.replace(/\\/g, '/');
  const prefix = base.startsWith('/') ? 'file://' : 'file:///';
  img.src = `${prefix}${encodeURI(base)}/${encodeURIComponent(name)}`;
  img.dataset.name = name;
  img.draggable = false;
  return img;
}

// DOM -> stored text. Chromium wraps lines in <div> and uses <br> for blank
// lines; flatten those back to \n and images to tokens.
function serialize(node = textEl) {
  let s = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) s += child.data;
    else if (child.tagName === 'BR') s += '\n';
    else if (child.tagName === 'IMG') { if (child.dataset.name) s += `![img:${child.dataset.name}]`; }
    else {
      if (s && !s.endsWith('\n')) s += '\n';
      s += serialize(child);
    }
  }
  return s;
}

// Stored text -> DOM.
function renderContent() {
  textEl.replaceChildren();
  for (const part of state.text.split(IMG_TOKEN)) {
    const m = part.match(/^!\[img:(.+)\]$/);
    if (m) textEl.appendChild(makeImg(m[1]));
    else if (part) textEl.appendChild(document.createTextNode(part));
  }
}

function syncFromDom() {
  state.text = serialize();
  state.images = [...new Set([...textEl.querySelectorAll('img')].map((i) => i.dataset.name).filter(Boolean))];
  push();
}

function insertAtCaret(node) {
  const sel = window.getSelection();
  let range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || !textEl.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(textEl);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

textEl.addEventListener('paste', async (e) => {
  e.preventDefault();
  if (!e.clipboardData) return;
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (!item) {
    // Plain text only — never let pasted HTML markup into the editor.
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      insertAtCaret(document.createTextNode(text));
      syncFromDom();
    }
    return;
  }
  const file = item.getAsFile();
  if (!file) return;
  // Show the image instantly from the clipboard bytes; the disk save runs
  // behind it, then the src is swapped to the persisted file and the blob
  // URL revoked so large pastes don't stay pinned in memory.
  const objectUrl = URL.createObjectURL(file);
  const img = document.createElement('img');
  img.src = objectUrl;
  img.draggable = false;
  insertAtCaret(img);
  img.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = await window.notes.saveImage(id, file.type, bytes);
  if (!name) {
    URL.revokeObjectURL(objectUrl);
    img.remove();
    syncFromDom();
    return;
  }
  img.dataset.name = name;
  img.src = makeImg(name).src;
  URL.revokeObjectURL(objectUrl);
  syncFromDom();
});

// Notion-style deletion: backspace with the caret right after an image (or
// delete right before one) first selects it — a second press actually
// removes it. Prevents nuking a diagram you can't retype by accident.
function adjacentImage(container, offset, dir) {
  let node;
  if (container.nodeType === Node.TEXT_NODE) {
    if (dir < 0 && offset > 0) return null; // caret inside text
    if (dir > 0 && offset < container.length) return null;
    node = container;
  } else {
    const child = container.childNodes[dir < 0 ? offset - 1 : offset];
    if (child) return child.tagName === 'IMG' ? child : null;
    node = container;
    if (node === textEl) return null;
  }
  // At the edge of a node: step to its sibling, hopping up through the
  // line wrapper <div>s Chromium creates (and into the neighbor line's edge).
  while (node && node !== textEl) {
    const sib = dir < 0 ? node.previousSibling : node.nextSibling;
    if (sib) {
      if (sib.tagName === 'IMG') return sib;
      if (sib.tagName === 'DIV') {
        const edge = dir < 0 ? sib.lastChild : sib.firstChild;
        return edge && edge.tagName === 'IMG' ? edge : null;
      }
      return null;
    }
    node = node.parentNode;
  }
  return null;
}

function selectNode(node) {
  const range = document.createRange();
  range.selectNode(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

textEl.addEventListener('keydown', (e) => {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  if (e.key === 'Escape' && !sel.isCollapsed) {
    sel.collapseToEnd();
    return;
  }
  if (e.key !== 'Backspace' && e.key !== 'Delete') return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return; // something's selected: let native delete run
  const img = adjacentImage(range.startContainer, range.startOffset, e.key === 'Backspace' ? -1 : 1);
  if (img) {
    e.preventDefault();
    selectNode(img);
  }
});

// Reflect "image is inside the current selection" as a class so CSS can
// draw a clear Notion-like selected outline.
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  for (const img of textEl.querySelectorAll('img')) {
    img.classList.toggle('selected', !sel.isCollapsed && sel.rangeCount > 0 && sel.containsNode(img, false));
  }
});

// Click an image to select it as a block (Notion-style); backspace/delete
// then removes it via the browser's own editing behavior.
textEl.addEventListener('click', (e) => {
  if (e.target.tagName !== 'IMG') return;
  const range = document.createRange();
  range.selectNode(e.target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});

// Rich content dropped from other apps would inject markup — block it.
textEl.addEventListener('drop', (e) => e.preventDefault());

function applyState() {
  applyColor(state.color);
  root.style.setProperty('--opacity', state.opacity);
  root.style.setProperty('--font-size', state.fontSize + 'px');
  opacityEl.value = Math.round(state.opacity * 100);
  renderContent();
  applyGhost();
  applyPinned();
  applyMonospace();
}

function push() {
  window.notes.update({
    id,
    text: state.text,
    images: state.images,
    color: state.color,
    opacity: state.opacity,
    fontSize: state.fontSize,
    monospace: state.monospace,
    ghost: state.ghost
  });
}

// Build swatches
for (const name of Object.keys(COLORS)) {
  const s = document.createElement('div');
  s.className = 'swatch';
  s.dataset.color = name;
  s.style.background = `rgb(${COLORS[name].tint})`;
  s.title = name;
  s.addEventListener('click', () => {
    state.color = name;
    applyColor(name);
    setColorPopoverOpen(false);
    push();
  });
  swatchesEl.appendChild(s);
}

// Events
textEl.addEventListener('input', () => syncFromDom());

opacityEl.addEventListener('input', () => {
  state.opacity = Math.max(0.3, Math.min(1, opacityEl.value / 100));
  root.style.setProperty('--opacity', state.opacity);
  push();
});

document.getElementById('fontUp').addEventListener('click', () => {
  state.fontSize = Math.min(32, state.fontSize + 1);
  root.style.setProperty('--font-size', state.fontSize + 'px');
  push();
});
document.getElementById('fontDown').addEventListener('click', () => {
  state.fontSize = Math.max(10, state.fontSize - 1);
  root.style.setProperty('--font-size', state.fontSize + 'px');
  push();
});
document.getElementById('ghost').addEventListener('click', () => setGhost(!state.ghost));
document.getElementById('new').addEventListener('click', () => window.notes.newNote());
document.getElementById('close').addEventListener('click', () => window.notes.close(id));

// Global hotkey / tray toggles this note from the main process.
window.notes.onToggleGhost(() => setGhost(!state.ghost));

// Load persisted state
Promise.all([window.notes.getState(id), window.notes.imagesDir()]).then(([s, dir]) => {
  if (s) state = Object.assign(state, s);
  // Older records (pre-v4) may omit this; normalize missing to false
  // so the renderer always treats monospace as a boolean.
  state.monospace = !!state.monospace;
  state.images = Array.isArray(state.images) ? state.images : [];
  imagesDir = dir;
  // Records from the pre-inline era kept images outside the text; fold any
  // unreferenced ones into the text as tokens so they stay visible.
  for (const name of state.images) {
    if (!state.text.includes(`![img:${name}]`)) state.text += `\n![img:${name}]`;
  }
  applyState();
  textEl.focus();
});
