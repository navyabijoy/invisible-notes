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
const formatBtn = document.getElementById('formatBtn');
const formatPopover = document.getElementById('formatPopover');
const pinBtn = document.getElementById('pin');

let state = { text: '', color: 'yellow', opacity: 0.85, fontSize: 15, monospace: false, ghost: false, pinned: true };

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

// --- Monospace (legacy code snippet support) ---
function applyMonospace() {
  noteEl.classList.toggle('mono', state.monospace);
}

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
  if (!e.target.closest('.format-control')) setFormatPopoverOpen(false);
});

// --- Formatting Popover ---
function setFormatPopoverOpen(open) {
  formatPopover.classList.toggle('open', open);
}

formatBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setFormatPopoverOpen(!formatPopover.classList.contains('open'));
  setColorPopoverOpen(false);
});

// --- Color Palette and Formatting ---

function applyBlockFormat(tagName) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const allLis = Array.from(textEl.querySelectorAll('li'));
  let selectedLis = [];

  if (!sel.isCollapsed) {
    selectedLis = allLis.filter(li => sel.containsNode(li, true));
  }
  
  if (selectedLis.length === 0) {
    let node = sel.anchorNode;
    while (node && node !== textEl) {
      if (node.nodeName === 'LI') {
        selectedLis.push(node);
        break;
      }
      node = node.parentNode;
    }
  }

  if (selectedLis.length > 0) {
    selectedLis.forEach(li => {
      let html = li.innerHTML;
      html = html.replace(/<\/?(h1|h2|h3|pre|div|p|blockquote)[^>]*>/gi, '');
      if (tagName.toUpperCase() !== 'DIV') {
        html = `<${tagName}>${html}</${tagName}>`;
      }
      li.innerHTML = html;
    });

    const newRange = document.createRange();
    newRange.selectNodeContents(selectedLis[selectedLis.length - 1]);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } else {
    document.execCommand('formatBlock', false, `<${tagName}>`);
  }
  cleanWebKitStyles();
}

function cleanWebKitStyles() {
  textEl.querySelectorAll('font[size]').forEach(f => f.removeAttribute('size'));
  textEl.querySelectorAll('[style]').forEach(el => {
    el.style.fontSize = '';
    el.style.fontFamily = '';
    el.style.lineHeight = '';
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  textEl.querySelectorAll('.Apple-style-span').forEach(el => {
    el.classList.remove('Apple-style-span');
    if (el.classList.length === 0) el.removeAttribute('class');
  });
  
  // WebKit bug: When creating a list on a heading, it wraps the UL in the H1!
  // We must unwrap UL/OL from any parent block tags so the list is bare.
  const lists = textEl.querySelectorAll('ul, ol');
  lists.forEach(list => {
    let parent = list.parentNode;
    while (parent && parent !== textEl) {
      if (['H1', 'H2', 'H3', 'PRE', 'BLOCKQUOTE', 'P', 'DIV'].includes(parent.nodeName)) {
        const frag = document.createDocumentFragment();
        while (parent.firstChild) frag.appendChild(parent.firstChild);
        const grandParent = parent.parentNode;
        grandParent.replaceChild(frag, parent);
        parent = grandParent; // continue checking up the tree
      } else {
        parent = parent.parentNode;
      }
    }
  });
}

formatPopover.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (swatch) {
    const color = swatch.dataset.color;
    textEl.focus();
    document.execCommand('foreColor', false, color);
    state.text = sanitizeHTML(textEl.innerHTML);
    push();
    return;
  }

  const btn = e.target.closest('.format-btn');
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  let val = btn.dataset.val || null;
  
  textEl.focus();
  
  if (cmd === 'removeFormat') {
    // TODO: migrate to Selection API (document.execCommand is deprecated)
    document.execCommand('removeFormat', false, null);
    applyBlockFormat('DIV');
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(s => {
      if (document.queryCommandState(s)) document.execCommand(s, false, null);
    });
  } else if (cmd === 'formatBlock' && val) {
    applyBlockFormat(val);
  } else if (['insertUnorderedList', 'insertOrderedList'].includes(cmd)) {
    document.execCommand(cmd, false, val);
    cleanWebKitStyles();
  } else {
    document.execCommand(cmd, false, val);
  }
  
  // Do not close the popover automatically so user can select multiple formatting options
  
  state.text = sanitizeHTML(textEl.innerHTML);
  push();
});

let isSelectionUpdatePending = false;
const cachedFormatBtns = document.querySelectorAll('.format-btn');
const cachedColorSwatches = document.querySelectorAll('.color-swatch');

document.addEventListener('selectionchange', () => {
  if (document.activeElement !== textEl) return;
  if (isSelectionUpdatePending) return;
  isSelectionUpdatePending = true;
  
  requestAnimationFrame(() => {
    isSelectionUpdatePending = false;
    
    cachedFormatBtns.forEach(btn => {
      const cmd = btn.dataset.cmd;
      if (!cmd || cmd === 'removeFormat') return;
      
      let isActive = false;
      try {
        if (['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].includes(cmd)) {
          isActive = document.queryCommandState(cmd);
        } else if (cmd === 'formatBlock') {
          const val = btn.dataset.val;
          const currentBlock = document.queryCommandValue('formatBlock');
          if (currentBlock && currentBlock.toLowerCase() === val.toLowerCase()) {
            isActive = true;
          }
        }
      } catch(e) {}
      
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    const currentForeColor = document.queryCommandValue('foreColor');
    cachedColorSwatches.forEach(sw => {
      const hex = sw.dataset.color;
      let rgb = '';
      if (hex && hex[0] === '#') {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        rgb = `rgb(${r}, ${g}, ${b})`;
      }
      if (rgb === currentForeColor) {
        sw.classList.add('active');
      } else {
        sw.classList.remove('active');
      }
    });
  });
});

function sanitizeHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const temp = doc.body;
  
    const allowedTags = ['B', 'I', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'P', 'PRE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'DIV', 'BR', 'FONT'];
  
  const walk = (node) => {
    if (node.nodeType === 1) { // Element
      if (!allowedTags.includes(node.tagName.toUpperCase())) {
        const textNode = document.createTextNode(node.textContent);
        node.parentNode.replaceChild(textNode, node);
      } else {
        const style = node.getAttribute('style') || '';
        let colorAttr = node.getAttribute('color') || '';
        
        const m = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)\s*/i);
        let colorFromStyle = m ? m[1].trim() : '';
        
        const colorRegex = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)$/;
        if (colorFromStyle && !colorRegex.test(colorFromStyle)) {
          colorFromStyle = '';
        }
        if (colorAttr && !colorRegex.test(colorAttr)) {
          colorAttr = '';
        }
        
        while(node.attributes.length > 0) {
          node.removeAttribute(node.attributes[0].name);
        }
        
        if (colorFromStyle) node.style.color = colorFromStyle;
        if (colorAttr) node.setAttribute('color', colorAttr);
        Array.from(node.childNodes).forEach(walk);
      }
    }
  };
  Array.from(temp.childNodes).forEach(walk);
  return temp.innerHTML;
}

function applyState() {
  applyColor(state.color);
  root.style.setProperty('--opacity', state.opacity);
  root.style.setProperty('--font-size', state.fontSize + 'px');
  opacityEl.value = Math.round(state.opacity * 100);
  
  let content = state.text || '';
  if (state.rich) {
    content = sanitizeHTML(content);
  } else {
    const temp = document.createElement('div');
    temp.textContent = content; // Escape legacy plain text
    content = temp.innerHTML.replace(/\n/g, '<br>');
  }
  if (textEl.innerHTML !== content) {
    textEl.innerHTML = content;
  }
  
  applyGhost();
  applyPinned();
  applyMonospace();
}

function push() {
  window.notes.update({
    id,
    text: state.text,
    rich: true,
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
textEl.addEventListener('input', () => {
  state.text = sanitizeHTML(textEl.innerHTML);
  push();
});

// Security/Paste handling
textEl.addEventListener('paste', (e) => {
  e.preventDefault();
  const html = e.clipboardData.getData('text/html');
  const plain = e.clipboardData.getData('text/plain');

  if (html) {
    document.execCommand('insertHTML', false, sanitizeHTML(html));
  } else if (plain) {
    const parsed = parseMarkdownToHTML(plain);
    document.execCommand('insertHTML', false, sanitizeHTML(parsed));
  }
  cleanWebKitStyles();
});

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
window.notes.getState(id).then((s) => {
  if (s) state = Object.assign(state, s);
  // Older records (pre-v4) may omit this; normalize missing to false
  // so the renderer always treats monospace as a boolean.
  state.monospace = !!state.monospace;
  applyState();
  textEl.focus();
});

// Markdown Parser
function parseMarkdownToHTML(text) {
  let html = text.replace(/\r\n/g, '\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const codeBlocks = [];
  const uuid = crypto.randomUUID().replace(/-/g, '');
  
  // Code Blocks
  html = html.replace(/```\w*\n([\s\S]*?)```/g, (match, p1) => {
    codeBlocks.push(p1);
    return `\n<pre>@@@CODEBLOCK_${uuid}_${codeBlocks.length - 1}@@@</pre>`;
  });
  
  html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
    codeBlocks.push(p1);
    return `\n<pre>@@@CODEBLOCK_${uuid}_${codeBlocks.length - 1}@@@</pre>`;
  });
  html = html.replace(/`([^`]+)`/g, (match, p1) => {
    codeBlocks.push(`<pre>${p1}</pre>`);
    return `@@@CODEBLOCK_${uuid}_${codeBlocks.length - 1}@@@`;
  });
  
  html = html.replace(/(?:^|\n)([\-\*]\s+[^\n]*(?:\n[\-\*]\s+[^\n]*)*)/g, (match, p1) => {
    const listItems = p1.trim().split('\n').map(line => `<li>${line.replace(/^[\-\*]\s+/, '')}</li>`).join('');
    return `\n<ul>${listItems}</ul>`;
  });
  html = html.replace(/(?:^|\n)(\d+\.\s+[^\n]*(?:\n\d+\.\s+[^\n]*)*)/g, (match, p1) => {
    const listItems = p1.trim().split('\n').map(line => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`).join('');
    return `\n<ol>${listItems}</ol>`;
  });
  html = html.replace(/(?:^|\n)###\s+([^\n]*)/g, '\n<h3>$1</h3>');
  html = html.replace(/(?:^|\n)##\s+([^\n]*)/g, '\n<h2>$1</h2>');
  html = html.replace(/(?:^|\n)#\s+([^\n]*)/g, '\n<h1>$1</h1>');
  html = html.replace(/(?:^|\n)&gt;\s+([^\n]*)/g, '\n<blockquote>$1</blockquote>');
  
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/(<br>)*<(h1|h2|h3|ul|ol|blockquote|pre)>/gi, '<$2>');
  html = html.replace(/<\/(h1|h2|h3|ul|ol|blockquote|pre)>(<br>)*/gi, '</$1>');
  
  codeBlocks.forEach((block, i) => {
    html = html.replace(`@@@CODEBLOCK_${uuid}_${i}@@@`, block);
  });
  
  return html.trim();
}
