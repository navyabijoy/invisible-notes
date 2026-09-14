const params = new URLSearchParams(window.location.search);
const id = params.get("id");

// Pasted images are files under userData/note-images; the renderer stores only
// the filename in a `data-name` attribute and rebuilds the file:// src here.
const SAFE_IMAGE_NAME = /^[\w-]+\.[a-z0-9]+$/;
let imagesDir = null;

const COLORS = {
  yellow: { tint: "255, 224, 130", dark: false },
  green: { tint: "178, 235, 178", dark: false },
  blue: { tint: "170, 214, 255", dark: false },
  pink: { tint: "255, 190, 214", dark: false },
  purple: { tint: "212, 190, 255", dark: false },
  dark: { tint: "40, 42, 48", dark: true },
};

const root = document.documentElement;
const body = document.body;
const textEl = document.getElementById("text");
const opacityEl = document.getElementById("opacity");
const swatchesEl = document.getElementById("swatches");
const colorBtn = document.getElementById("colorBtn");
const colorPopover = document.getElementById("colorPopover");
const formatBtn = document.getElementById("formatBtn");
const formatPopover = document.getElementById("formatPopover");
const monoBtn = document.getElementById("mono");
const pinBtn = document.getElementById("pin");

let state = {
  text: "",
  color: "yellow",
  opacity: 0.85,
  fontSize: 15,
  monospace: false,
  ghost: false,
  pinned: true,
  images: [],
};

const noteEl = document.querySelector(".note");
const barEl = document.querySelector(".bar");

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
  noteEl.classList.toggle("ghost", state.ghost);
  if (state.ghost) {
    setIgnore(true); // pass clicks through by default; the toolbar re-enables
  } else {
    setIgnore(false); // fully interactive again
  }
  // While ghosted, the note is always forced on top (main process) so it
  // stays reachable — the pin toggle has no effect until ghost ends.
  pinBtn.disabled = state.ghost;
  pinBtn.style.opacity = state.ghost ? "0.25" : "";
}

function setGhost(on) {
  state.ghost = on;
  applyGhost();
  push();
}

window.addEventListener("mousemove", (e) => {
  if (!state.ghost) return;
  // Re-enable interaction only while hovering the toolbar.
  setIgnore(!e.target.closest(".bar"));
});

// --- Pin (always-on-top) toggle ---
// Pinned notes stay above whatever app you switch to, on both macOS and
// Windows. Unpinned notes behave like a normal window and get covered by
// whatever's currently focused. The main process owns the actual
// setAlwaysOnTop call; this just reflects/requests the state.
function applyPinned() {
  pinBtn.classList.toggle("active", state.pinned);
  pinBtn.title = state.pinned
    ? "Pinned: stays on top when you switch apps"
    : "Not pinned: can be covered by other windows";
}

function setPinned(on) {
  state.pinned = on;
  applyPinned();
  window.notes.setPinned(id, on);
}

pinBtn.addEventListener("click", () => setPinned(!state.pinned));

// --- Monospace (legacy code snippet support) ---
function applyMonospace() {
  noteEl.classList.toggle("mono", state.monospace);
  monoBtn.classList.toggle("active", state.monospace);
  monoBtn.title = state.monospace
    ? "Normal font"
    : "Monospace: better for code snippets";
}

function setMonospace(on) {
  state.monospace = on;
  applyMonospace();
  push();
}

monoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setMonospace(!state.monospace);
});

function applyColor(color) {
  const c = COLORS[color] || COLORS.yellow;
  root.style.setProperty("--tint", c.tint);
  body.classList.toggle("dark", c.dark);
  for (const el of swatchesEl.children) {
    el.classList.toggle("active", el.dataset.color === color);
  }
}

// --- Compact color popover ---
// Keep header minimal: one dot button opens a small palette instead of
// showing every swatch inline. Lives inside .bar so it inherits the same
// drag/no-drag and ghost-mode hover-to-interact rules as the rest of the toolbar.
function setColorPopoverOpen(open) {
  colorPopover.classList.toggle("open", open);
}

colorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setColorPopoverOpen(!colorPopover.classList.contains("open"));
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-control")) setColorPopoverOpen(false);
  if (!e.target.closest(".format-control")) setFormatPopoverOpen(false);
});

// --- Formatting Popover ---
function setFormatPopoverOpen(open) {
  formatPopover.classList.toggle("open", open);
}

formatBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setFormatPopoverOpen(!formatPopover.classList.contains("open"));
  setColorPopoverOpen(false);
});

// --- Color Palette and Formatting ---

function applyBlockFormat(tagName) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const allLis = Array.from(textEl.querySelectorAll("li"));
  let selectedLis = [];

  if (!sel.isCollapsed) {
    selectedLis = allLis.filter((li) => sel.containsNode(li, true));
  }

  if (selectedLis.length === 0) {
    let node = sel.anchorNode;
    while (node && node !== textEl) {
      if (node.nodeName === "LI") {
        selectedLis.push(node);
        break;
      }
      node = node.parentNode;
    }
  }

  if (selectedLis.length > 0) {
    selectedLis.forEach((li) => {
      let html = li.innerHTML;
      html = html.replace(/<\/?(h1|h2|h3|pre|div|p|blockquote)[^>]*>/gi, "");
      if (tagName.toUpperCase() !== "DIV") {
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
    document.execCommand("formatBlock", false, `<${tagName}>`);
  }
  cleanWebKitStyles();
}

function selectedListItems() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return [];

  const allLis = Array.from(textEl.querySelectorAll("li"));
  let items = [];
  if (!sel.isCollapsed) {
    items = allLis.filter((li) => sel.containsNode(li, true));
  }

  if (items.length === 0) {
    let node = sel.anchorNode;
    while (node && node !== textEl) {
      if (node.nodeName === "LI") {
        items.push(node);
        break;
      }
      node = node.parentNode;
    }
  }
  return items;
}

function toggleChecklist() {
  let items = selectedListItems();
  if (items.length === 0) {
    document.execCommand("insertUnorderedList", false, null);
    items = selectedListItems();
  }

  items.forEach((li) => {
    li.dataset.checked = li.dataset.checked === "true" ? "true" : "false";
    const list = li.closest("ul, ol");
    if (!list) return;

    let target = list;
    if (list.nodeName !== "UL") {
      target = document.createElement("ul");
      while (list.firstChild) target.appendChild(list.firstChild);
      list.replaceWith(target);
    }
    target.dataset.type = "checklist";
  });

  cleanWebKitStyles();
}

function cleanWebKitStyles() {
  textEl
    .querySelectorAll("font[size]")
    .forEach((f) => f.removeAttribute("size"));
  textEl.querySelectorAll("[style]").forEach((el) => {
    el.style.fontSize = "";
    el.style.fontFamily = "";
    el.style.lineHeight = "";
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });
  textEl.querySelectorAll(".Apple-style-span").forEach((el) => {
    el.classList.remove("Apple-style-span");
    if (el.classList.length === 0) el.removeAttribute("class");
  });

  // WebKit bug: When creating a list on a heading, it wraps the UL in the H1!
  // We must unwrap UL/OL from any parent block tags so the list is bare.
  const lists = textEl.querySelectorAll("ul, ol");
  lists.forEach((list) => {
    let parent = list.parentNode;
    while (parent && parent !== textEl) {
      if (
        ["H1", "H2", "H3", "PRE", "BLOCKQUOTE", "P", "DIV"].includes(
          parent.nodeName,
        )
      ) {
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

function normalizeChecklistMarkup() {
  textEl.querySelectorAll('ul[data-type="checklist"] > li').forEach((li) => {
    if (li.dataset.checked !== "true") li.dataset.checked = "false";
  });
}

formatPopover.addEventListener("click", (e) => {
  const swatch = e.target.closest(".color-swatch");
  if (swatch) {
    const color = swatch.dataset.color;
    textEl.focus();
    document.execCommand("foreColor", false, color);
    syncStateFromDom();
    push();
    return;
  }

  const btn = e.target.closest(".format-btn");
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  let val = btn.dataset.val || null;

  textEl.focus();

  if (cmd === "removeFormat") {
    // TODO: migrate to Selection API (document.execCommand is deprecated)
    document.execCommand("removeFormat", false, null);
    applyBlockFormat("DIV");
    ["bold", "italic", "underline", "strikeThrough"].forEach((s) => {
      if (document.queryCommandState(s)) document.execCommand(s, false, null);
    });
  } else if (cmd === "toggleMonospace") {
    setMonospace(!state.monospace);
  } else if (cmd === "toggleChecklist") {
    toggleChecklist();
  } else if (cmd === "formatBlock" && val) {
    applyBlockFormat(val);
  } else if (["insertUnorderedList", "insertOrderedList"].includes(cmd)) {
    document.execCommand(cmd, false, val);
    cleanWebKitStyles();
  } else {
    document.execCommand(cmd, false, val);
  }

  // Do not close the popover automatically so user can select multiple formatting options

  syncStateFromDom();
  push();
});

textEl.addEventListener("click", (e) => {
  const li = e.target.closest('ul[data-type="checklist"] > li');
  if (!li || !textEl.contains(li)) return;

  const rect = li.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  if (clickX > 24) return;

  li.dataset.checked = li.dataset.checked === "true" ? "false" : "true";
  state.text = sanitizeHTML(textEl.innerHTML);
  push();
});

let isSelectionUpdatePending = false;
const cachedFormatBtns = document.querySelectorAll(".format-btn");
const cachedColorSwatches = document.querySelectorAll(".color-swatch");

document.addEventListener("selectionchange", () => {
  if (document.activeElement !== textEl) return;
  if (isSelectionUpdatePending) return;
  isSelectionUpdatePending = true;

  requestAnimationFrame(() => {
    isSelectionUpdatePending = false;

    cachedFormatBtns.forEach((btn) => {
      const cmd = btn.dataset.cmd;
      if (!cmd || cmd === "removeFormat") return;

      let isActive = false;
      try {
        if (cmd === "toggleMonospace") {
          isActive = state.monospace;
        } else if (cmd === "toggleChecklist") {
          isActive = selectedListItems().some(
            (li) => li.parentElement?.dataset.type === "checklist",
          );
        } else if (
          [
            "bold",
            "italic",
            "underline",
            "strikeThrough",
            "insertUnorderedList",
            "insertOrderedList",
          ].includes(cmd)
        ) {
          isActive = document.queryCommandState(cmd);
        } else if (cmd === "formatBlock") {
          const val = btn.dataset.val;
          const currentBlock = document.queryCommandValue("formatBlock");
          if (
            currentBlock &&
            currentBlock.toLowerCase() === val.toLowerCase()
          ) {
            isActive = true;
          }
        }
      } catch (e) {}

      if (isActive) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    const currentForeColor = document.queryCommandValue("foreColor");
    cachedColorSwatches.forEach((sw) => {
      const hex = sw.dataset.color;
      let rgb = "";
      if (hex && hex[0] === "#") {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        rgb = `rgb(${r}, ${g}, ${b})`;
      }
      if (rgb === currentForeColor) {
        sw.classList.add("active");
      } else {
        sw.classList.remove("active");
      }
    });
  });
});

// --- Inline images (pasted from the system clipboard) ---
function imageUrl(name) {
  const base = imagesDir.replace(/\\/g, "/");
  const prefix = base.startsWith("/") ? "file://" : "file:///";
  // Encode each segment so reserved characters like # or ? in the userData path
  // cannot be read as a URL fragment/query; the Windows drive colon stays.
  const encodedBase = base
    .split("/")
    .map((seg) => (/^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join("/");
  return `${prefix}${encodedBase}/${encodeURIComponent(name)}`;
}

function hydrateImage(img) {
  const name = img.dataset.name;
  if (!imagesDir || !SAFE_IMAGE_NAME.test(name)) return;
  img.src = imageUrl(name);
  img.draggable = false;
}

function hydrateImages() {
  if (!imagesDir) return;
  textEl.querySelectorAll("img[data-name]").forEach((img) => hydrateImage(img));
}

// Insert a node at the caret, falling back to the end of the editor when the
// selection is elsewhere (e.g. the toolbar button still has focus).
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

// Persist the editor HTML plus the list of referenced image files.
function syncStateFromDom() {
  state.text = sanitizeHTML(textEl.innerHTML);
  state.images = [
    ...new Set(
      [...textEl.querySelectorAll("img[data-name]")]
        .map((img) => img.dataset.name)
        .filter((name) => SAFE_IMAGE_NAME.test(name)),
    ),
  ];
}

async function saveAndInsertImage(file) {
  // Show the clipboard bytes instantly; swap the src to the persisted file
  // once main has written it, then revoke the blob so it leaves memory.
  const objectUrl = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.src = objectUrl;
  img.draggable = false;
  insertAtCaret(img);
  img.scrollIntoView({ block: "nearest" });
  try {
    const type =
      file.type && file.type.startsWith("image/") ? file.type : "image/png";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = await window.notes.saveImage(id, type, bytes);
    if (!name) {
      img.remove();
      return;
    }
    img.dataset.name = name;
    hydrateImage(img);
  } catch (_) {
    img.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Notion-style deletion: backspace/delete adjacent to an image first selects
// it so a diagram is not destroyed by an accidental keypress; a second press
// removes it.
function adjacentImage(container, offset, dir) {
  let node;
  if (container.nodeType === Node.TEXT_NODE) {
    if (dir < 0 && offset > 0) return null;
    if (dir > 0 && offset < container.length) return null;
    node = container;
  } else {
    const child = container.childNodes[dir < 0 ? offset - 1 : offset];
    if (child) {
      if (child.tagName === "IMG") return child;
      if (child.tagName === "DIV") {
        const edge = dir < 0 ? child.lastChild : child.firstChild;
        return edge && edge.tagName === "IMG" ? edge : null;
      }
      return null;
    }
    node = container;
    if (node === textEl) return null;
  }
  while (node && node !== textEl) {
    const sib = dir < 0 ? node.previousSibling : node.nextSibling;
    if (sib) {
      if (sib.tagName === "IMG") return sib;
      if (sib.tagName === "DIV") {
        const edge = dir < 0 ? sib.lastChild : sib.firstChild;
        return edge && edge.tagName === "IMG" ? edge : null;
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

textEl.addEventListener("keydown", (e) => {
  if (e.key !== "Backspace" && e.key !== "Delete") return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  const img = adjacentImage(
    range.startContainer,
    range.startOffset,
    e.key === "Backspace" ? -1 : 1,
  );
  if (img) {
    e.preventDefault();
    selectNode(img);
  }
});

// Reflect "image is inside the current selection" so CSS can draw a clear
// selected outline (Chromium's tint on <img> selection is too subtle).
document.addEventListener("selectionchange", () => {
  if (!textEl.querySelector("img")) return;
  const sel = window.getSelection();
  textEl.querySelectorAll("img").forEach((img) => {
    img.classList.toggle(
      "selected",
      !sel.isCollapsed && sel.rangeCount > 0 && sel.containsNode(img, false),
    );
  });
});

textEl.addEventListener("click", (e) => {
  if (e.target.tagName === "IMG") selectNode(e.target);
});

// Rich content dropped from other apps would inject markup — block it.
textEl.addEventListener("drop", (e) => e.preventDefault());

function sanitizeHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const temp = doc.body;

  const allowedTags = [
    "B",
    "I",
    "U",
    "S",
    "STRIKE",
    "H1",
    "H2",
    "H3",
    "P",
    "PRE",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "SPAN",
    "DIV",
    "BR",
    "FONT",
    "IMG",
  ];

  const walk = (node) => {
    if (node.nodeType === 1) {
      // Element
      const tag = node.tagName.toUpperCase();
      if (tag === "IMG") {
        // Pasted images are identified by a generated filename; anything else
        // (remote srcs, scripts, bad names) is dropped rather than kept.
        const name = node.getAttribute("data-name") || "";
        if (SAFE_IMAGE_NAME.test(name)) {
          while (node.attributes.length > 0) {
            node.removeAttribute(node.attributes[0].name);
          }
          node.setAttribute("data-name", name);
        } else {
          node.parentNode.removeChild(node);
        }
      } else if (!allowedTags.includes(tag)) {
        const textNode = document.createTextNode(node.textContent);
        node.parentNode.replaceChild(textNode, node);
      } else {
        const style = node.getAttribute("style") || "";
        let colorAttr = node.getAttribute("color") || "";

        const m = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)\s*/i);
        let colorFromStyle = m ? m[1].trim() : "";

        const colorRegex =
          /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)$/;
        if (colorFromStyle && !colorRegex.test(colorFromStyle)) {
          colorFromStyle = "";
        }
        if (colorAttr && !colorRegex.test(colorAttr)) {
          colorAttr = "";
        }

        const isChecklist =
          node.tagName.toUpperCase() === "UL" &&
          node.getAttribute("data-type") === "checklist";
        const checked =
          node.tagName.toUpperCase() === "LI" &&
          node.getAttribute("data-checked") === "true";

        while (node.attributes.length > 0) {
          node.removeAttribute(node.attributes[0].name);
        }

        if (colorFromStyle) node.style.color = colorFromStyle;
        if (colorAttr) node.setAttribute("color", colorAttr);
        if (isChecklist) node.setAttribute("data-type", "checklist");
        if (node.tagName.toUpperCase() === "LI" && node.parentElement) {
          const parentIsChecklist =
            node.parentElement.getAttribute("data-type") === "checklist";
          if (parentIsChecklist) {
            node.setAttribute("data-checked", checked ? "true" : "false");
          }
        }
        Array.from(node.childNodes).forEach(walk);
      }
    }
  };
  Array.from(temp.childNodes).forEach(walk);
  return temp.innerHTML;
}

function applyState() {
  applyColor(state.color);
  root.style.setProperty("--opacity", state.opacity);
  root.style.setProperty("--font-size", state.fontSize + "px");
  opacityEl.value = Math.round(state.opacity * 100);

  let content = state.text || "";
  if (state.rich) {
    content = sanitizeHTML(content);
  } else {
    const temp = document.createElement("div");
    temp.textContent = content; // Escape legacy plain text
    content = temp.innerHTML.replace(/\n/g, "<br>");
  }
  if (textEl.innerHTML !== content) {
    textEl.innerHTML = content;
  }
  normalizeChecklistMarkup();
  hydrateImages();

  applyGhost();
  applyPinned();
  applyMonospace();
}

function push() {
  state.rich = true;
  window.notes.update({
    id,
    text: state.text,
    rich: state.rich,
    images: state.images,
    color: state.color,
    opacity: state.opacity,
    fontSize: state.fontSize,
    monospace: state.monospace,
    ghost: state.ghost,
  });
}

// Build swatches
for (const name of Object.keys(COLORS)) {
  const s = document.createElement("div");
  s.className = "swatch";
  s.dataset.color = name;
  s.style.background = `rgb(${COLORS[name].tint})`;
  s.title = name;
  s.addEventListener("click", () => {
    state.color = name;
    applyColor(name);
    setColorPopoverOpen(false);
    push();
  });
  swatchesEl.appendChild(s);
}

// Events
let inputTimeout;
textEl.addEventListener("input", () => {
  clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    syncStateFromDom();
    push();
  }, 500);
});

// Security/Paste handling
textEl.addEventListener("paste", async (e) => {
  if (!e.clipboardData) return;
  const imageItems = [...e.clipboardData.items].filter((i) =>
    i.type.startsWith("image/"),
  );
  if (imageItems.length > 0) {
    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) await saveAndInsertImage(file);
    }
    syncStateFromDom();
    push();
    return;
  }

  e.preventDefault();
  const html = e.clipboardData.getData("text/html");
  const plain = e.clipboardData.getData("text/plain");

  if (html) {
    document.execCommand("insertHTML", false, sanitizeHTML(html));
  } else if (plain) {
    const parsed = parseMarkdownToHTML(plain);
    document.execCommand("insertHTML", false, sanitizeHTML(parsed));
  }
  cleanWebKitStyles();
  normalizeChecklistMarkup();
});

opacityEl.addEventListener("input", () => {
  state.opacity = Math.max(0.3, Math.min(1, opacityEl.value / 100));
  root.style.setProperty("--opacity", state.opacity);
  push();
});

document.getElementById("fontUp").addEventListener("click", () => {
  state.fontSize = Math.min(32, state.fontSize + 1);
  root.style.setProperty("--font-size", state.fontSize + "px");
  push();
});
document.getElementById("fontDown").addEventListener("click", () => {
  state.fontSize = Math.max(10, state.fontSize - 1);
  root.style.setProperty("--font-size", state.fontSize + "px");
  push();
});
document
  .getElementById("ghost")
  .addEventListener("click", () => setGhost(!state.ghost));
document
  .getElementById("new")
  .addEventListener("click", () => window.notes.newNote());
document
  .getElementById("close")
  .addEventListener("click", () => window.notes.close(id));

// Global hotkey / tray toggles this note from the main process.
window.notes.onToggleGhost(() => setGhost(!state.ghost));

// Load persisted state
Promise.all([window.notes.getState(id), window.notes.imagesDir()]).then(
  ([s, dir]) => {
    if (s) state = Object.assign(state, s);
    // Older records (pre-v4) may omit this; normalize missing to false
    // so the renderer always treats monospace as a boolean.
    state.monospace = !!state.monospace;
    state.images = Array.isArray(state.images) ? state.images : [];
    imagesDir = dir;
    // Any referenced image means the body is markup; treat it as rich so the
    // <img> tags are parsed instead of being escaped into visible text.
    if (state.images.some((name) => SAFE_IMAGE_NAME.test(name))) {
      state.rich = true;
    }
    // Records from the pre-rich era kept images outside the text; fold any
    // unreferenced ones into the body so they stay visible.
    const missing = state.images.filter(
      (name) => SAFE_IMAGE_NAME.test(name) && !state.text.includes(name),
    );
    if (missing.length > 0) {
      const markup = missing
        .map((name) => `<img data-name="${name}">`)
        .join("");
      state.text = `${state.text}${state.text ? "<br>" : ""}${markup}`;
    }
    applyState();
    textEl.focus();
  },
);

// Markdown Parser
function parseMarkdownToHTML(text) {
  let html = text
    .replace(/\r\n/g, "\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const codeBlocks = [];
  const uuid = crypto.randomUUID().replace(/-/g, "");

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

  html = html.replace(
    /(?:^|\n)((?:[\-\*]\s+\[[ xX]\]\s+[^\n]*)(?:\n[\-\*]\s+\[[ xX]\]\s+[^\n]*)*)/g,
    (match, p1) => {
      const listItems = p1
        .trim()
        .split("\n")
        .map((line) => {
          const checked = /^[\-\*]\s+\[[xX]\]/.test(line);
          const text = line.replace(/^[\-\*]\s+\[[ xX]\]\s+/, "");
          return `<li data-checked="${checked ? "true" : "false"}">${text}</li>`;
        })
        .join("");
      return `\n<ul data-type="checklist">${listItems}</ul>`;
    },
  );
  html = html.replace(
    /(?:^|\n)([\-\*]\s+(?!\[[ xX]\]\s)[^\n]*(?:\n[\-\*]\s+(?!\[[ xX]\]\s)[^\n]*)*)/g,
    (match, p1) => {
      const listItems = p1
        .trim()
        .split("\n")
        .map((line) => `<li>${line.replace(/^[\-\*]\s+/, "")}</li>`)
        .join("");
      return `\n<ul>${listItems}</ul>`;
    },
  );
  html = html.replace(
    /(?:^|\n)(\d+\.\s+[^\n]*(?:\n\d+\.\s+[^\n]*)*)/g,
    (match, p1) => {
      const listItems = p1
        .trim()
        .split("\n")
        .map((line) => `<li>${line.replace(/^\d+\.\s+/, "")}</li>`)
        .join("");
      return `\n<ol>${listItems}</ol>`;
    },
  );
  html = html.replace(/(?:^|\n)###\s+([^\n]*)/g, "\n<h3>$1</h3>");
  html = html.replace(/(?:^|\n)##\s+([^\n]*)/g, "\n<h2>$1</h2>");
  html = html.replace(/(?:^|\n)#\s+([^\n]*)/g, "\n<h1>$1</h1>");
  html = html.replace(
    /(?:^|\n)&gt;\s+([^\n]*)/g,
    "\n<blockquote>$1</blockquote>",
  );

  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");
  html = html.replace(/_([^_]+)_/g, "<i>$1</i>");
  html = html.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  html = html.replace(/\n/g, "<br>");
  html = html.replace(/(<br>)*<(h1|h2|h3|ul|ol|blockquote|pre)>/gi, "<$2>");
  html = html.replace(/<\/(h1|h2|h3|ul|ol|blockquote|pre)>(<br>)*/gi, "</$1>");

  codeBlocks.forEach((block, i) => {
    html = html.replace(`@@@CODEBLOCK_${uuid}_${i}@@@`, block);
  });

  return html.trim();
}
