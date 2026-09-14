const ALL_SCOPE = "__all__";

const COLOR_TINTS = {
  yellow: "#f0e27f",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
  purple: "#ddd6fe",
  dark: "#28292e",
};

const WS_TINTS = [
  { bg: "#eab308", icon: "home" },
  { bg: "#3b82f6", icon: "briefcase" },
  { bg: "#f97316", icon: "bulb" },
  { bg: "#a855f7", icon: "folder" },
  { bg: "#64748b", icon: "archive" },
  { bg: "#22c55e", icon: "home" },
];

const ICONS = {
  notes:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>',
  open: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/></svg>',
  pencil:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  move: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6"/><path d="m17 15 3 3-3 3"/><path d="M13 18h7"/></svg>',
  trash:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  keys: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h4M16 10h.01M8 14h8"/></svg>',
  download:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  upload:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  check:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>',
  all: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="16" rx="2"/><path d="M21 8v10a2 2 0 0 1-2 2H9"/></svg>',
  home: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
  briefcase:
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  bulb: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
  folder:
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
  archive:
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/></svg>',
};

const ACCENTS = {
  violet: {
    base: "#5b4bff",
    dk: "#4a3ae8",
    lt: "#f0edff",
    ltDark: "#2b2666",
    label: "Violet",
  },
  blue: {
    base: "#2563eb",
    dk: "#1d4ed8",
    lt: "#e0eaff",
    ltDark: "#233063",
    label: "Blue",
  },
  green: {
    base: "#15803d",
    dk: "#166534",
    lt: "#dcf5e3",
    ltDark: "#1e3a2a",
    label: "Green",
  },
  orange: {
    base: "#c2410c",
    dk: "#9a3412",
    lt: "#ffe9d6",
    ltDark: "#4a2a1a",
    label: "Orange",
  },
  pink: {
    base: "#be185d",
    dk: "#9d174d",
    lt: "#fce0ec",
    ltDark: "#47223c",
    label: "Pink",
  },
};

const SETTING_TITLES = {
  appearance: "Appearance",
  shortcuts: "Shortcuts",
  storage: "Storage",
  about: "About",
};

const SCOPE_SECTIONS = [
  {
    scope: "app",
    title: "In Ghost Notes",
    note: "Active while a note or this window has focus, so the same keys stay free in your browser and editor.",
  },
  {
    scope: "global",
    title: "Anywhere",
    note: "Registered system-wide, so you can always reach a new note even when every Ghost Notes window is hidden.",
  },
];

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

const appEl = document.getElementById("app");
const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const workspaceNavEl = document.getElementById("workspaceNav");
const pageSubEl = document.getElementById("pageSub");
const wsChipEl = document.getElementById("wsChip");
const wsChipDotEl = document.getElementById("wsChipDot");
const wsChipLabelEl = document.getElementById("wsChipLabel");
const wsModalEl = document.getElementById("wsModal");
const wsFormEl = document.getElementById("wsForm");
const wsNameInputEl = document.getElementById("wsNameInput");
const wsModalTitleEl = document.getElementById("wsModalTitle");
const moreMenuEl = document.getElementById("moreMenu");
const wsMenuEl = document.getElementById("wsMenu");
const noteMenuEl = document.getElementById("noteMenu");
const moreBtnEl = document.getElementById("moreBtn");
const settingsEl = document.getElementById("settings");
const settingsBodyEl = document.getElementById("settingsBody");
const settingsTitleEl = document.getElementById("settingsTitle");
const settingsCloseEl = document.getElementById("settingsClose");

let notes = [];
let workspaces = [];
let activeWorkspace = null;
let listScope = null;
let sidebarOpen = false;
let appearance = { theme: "system", accent: "violet", effectiveDark: false };
let query = "";
let shortcuts = [];
let appVersion = "";
let formMode = null;
let renamingId = null;
let settingsPane = "appearance";
let menuNoteId = null;
let noteMenuMode = "root";
let noteMenuAnchor = null;
let focusBeforeSettings = null;

document.getElementById("searchHint").textContent = isMac ? "⌘K" : "Ctrl+K";

function label(note) {
  return (note.title || "").trim();
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let out = "";
  const walk = (node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === "BR") {
      out += "\n";
      return;
    }
    if (tag === "LI") {
      const list = node.parentElement;
      if (list && list.tagName === "OL") {
        out += `${Array.prototype.indexOf.call(list.children, node) + 1}. `;
      } else {
        out += "• ";
      }
      Array.from(node.childNodes).forEach(walk);
      out += "\n";
      return;
    }
    const block = /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|TR)$/.test(tag);
    if (block && out && !out.endsWith("\n")) out += "\n";
    Array.from(node.childNodes).forEach(walk);
    if (block && out && !out.endsWith("\n")) out += "\n";
  };
  Array.from(doc.body.childNodes).forEach(walk);
  return out;
}

function snippet(note) {
  const raw = note.text || "";
  const plain = note.rich ? htmlToText(raw) : raw;
  return plain.replace(/\s+/g, " ").trim();
}

function plural(n, word) {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

function relativeTime(ts) {
  if (!ts) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return "just now";
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
  const hay = (label(note) + " " + snippet(note)).toLowerCase();
  return hay.includes(q.toLowerCase());
}

function workspaceTint(index) {
  return WS_TINTS[index % WS_TINTS.length];
}

function countIn(workspaceId) {
  return notes.filter((n) => n.workspaceId === workspaceId).length;
}

function notesForList() {
  if (listScope === ALL_SCOPE) return notes.slice();
  return notes.filter((n) => n.workspaceId === listScope);
}

function currentWorkspace() {
  return workspaces.find((w) => w.id === activeWorkspace) || workspaces[0];
}

function scopeTitle() {
  if (listScope === ALL_SCOPE) return "All notes";
  const ws = workspaces.find((w) => w.id === listScope);
  return ws ? ws.name : "Notes";
}

function shortcutDisplay(id) {
  const match = shortcuts.find((s) => s.id === id);
  return match ? match.display : "";
}

function applyChrome() {
  appEl.classList.toggle("sidebar-open", !!sidebarOpen);
  const count =
    listScope === ALL_SCOPE
      ? notes.length
      : countIn(listScope || activeWorkspace);
  pageSubEl.textContent = `${scopeTitle()} · ${plural(count, "note")}`;
  const current = currentWorkspace();
  if (current) {
    const idx = workspaces.findIndex((w) => w.id === current.id);
    wsChipDotEl.style.background = workspaceTint(Math.max(0, idx)).bg;
    wsChipDotEl.hidden = false;
    wsChipLabelEl.textContent = `${current.name} · ${plural(countIn(current.id), "note")}`;
  }
}

function wsIconButton({ id, name, count, tint, iconHtml, active }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ws-item" + (active ? " is-active" : "");
  btn.dataset.workspaceId = id;

  const ico = document.createElement("span");
  ico.className = "ws-ico";
  ico.style.background = tint;
  ico.innerHTML = iconHtml;

  const labelEl = document.createElement("span");
  labelEl.className = "name";
  labelEl.textContent = name;

  const countEl = document.createElement("span");
  countEl.className = "count";
  countEl.textContent = String(count);

  btn.appendChild(ico);
  btn.appendChild(labelEl);
  btn.appendChild(countEl);
  btn.addEventListener("click", () => selectScope(id));
  return btn;
}

function renderWorkspaces() {
  workspaceNavEl.innerHTML = "";
  if (workspaces.length > 1) {
    workspaceNavEl.appendChild(
      wsIconButton({
        id: ALL_SCOPE,
        name: "All notes",
        count: notes.length,
        tint: "#334155",
        iconHtml: ICONS.all,
        active: listScope === ALL_SCOPE,
      }),
    );
  }
  workspaces.forEach((workspace, i) => {
    const tint = workspaceTint(i);
    workspaceNavEl.appendChild(
      wsIconButton({
        id: workspace.id,
        name: workspace.name,
        count: countIn(workspace.id),
        tint: tint.bg,
        iconHtml: ICONS[tint.icon],
        active: listScope === workspace.id,
      }),
    );
  });
}

function selectScope(id) {
  closeMenus();
  listScope = id;
  if (id === ALL_SCOPE) window.manager.setListScope(ALL_SCOPE);
  else window.manager.setWorkspace(id);
  renderWorkspaces();
  applyChrome();
  render();
}

function render() {
  const inScope = notesForList();
  const filtered = inScope
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((n) => matches(n, query));

  listEl.innerHTML = "";

  if (inScope.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = ICONS.notes;
    const message = document.createElement("div");
    const newNoteKeys = shortcutDisplay("newNote");
    message.textContent =
      listScope === ALL_SCOPE ? "No notes yet." : "No notes in this workspace.";
    message.appendChild(document.createElement("br"));
    message.appendChild(
      document.createTextNode(
        newNoteKeys
          ? `Click "New" or press ${newNoteKeys} to create one.`
          : 'Click "New" to create one.',
      ),
    );
    empty.appendChild(message);
    listEl.appendChild(empty);
    return;
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = ICONS.notes;
    const message = document.createElement("div");
    message.textContent = "No notes match your search.";
    empty.appendChild(message);
    listEl.appendChild(empty);
    return;
  }

  for (const note of filtered) {
    const card = document.createElement("div");
    card.className = "card" + (note.visible ? " is-open" : "");

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = COLOR_TINTS[note.color] || COLOR_TINTS.yellow;

    const info = document.createElement("div");
    info.className = "info";

    if (renamingId === note.id) {
      const titleInput = document.createElement("input");
      titleInput.className = "title";
      titleInput.value = label(note);
      titleInput.placeholder = snippet(note).slice(0, 40) || "Untitled note";
      const commit = () => {
        window.manager.rename(note.id, titleInput.value);
        renamingId = null;
      };
      titleInput.addEventListener("change", commit);
      titleInput.addEventListener("blur", () => {
        renamingId = null;
        render();
      });
      titleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          titleInput.blur();
        }
        if (e.key === "Escape") {
          renamingId = null;
          render();
        }
      });
      titleInput.addEventListener("click", (e) => e.stopPropagation());
      info.appendChild(titleInput);
      queueMicrotask(() => {
        titleInput.focus();
        titleInput.select();
      });
    } else {
      const titleEl = document.createElement("div");
      titleEl.className = "title";
      titleEl.textContent = label(note) || "Untitled note";
      info.appendChild(titleEl);
    }

    const snippetEl = document.createElement("div");
    snippetEl.className = "snippet";
    snippetEl.textContent = snippet(note) || "Empty note";
    info.appendChild(snippetEl);

    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    metaEl.textContent = relativeTime(note.updatedAt);

    const more = document.createElement("button");
    more.type = "button";
    more.className = "icon-btn card-more";
    more.title = "Note actions";
    more.setAttribute("aria-label", "Note actions");
    more.setAttribute("aria-haspopup", "menu");
    more.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>';
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      openNoteMenu(note, more);
    });

    card.appendChild(swatch);
    card.appendChild(info);
    card.appendChild(metaEl);
    card.appendChild(more);
    card.addEventListener("click", () => {
      if (renamingId === note.id) return;
      window.manager.open(note.id);
    });
    listEl.appendChild(card);
  }
}

function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = appearance.effectiveDark ? "dark" : "light";
  const accent = ACCENTS[appearance.accent] || ACCENTS.violet;
  root.style.setProperty("--accent", accent.base);
  root.style.setProperty("--accent-dk", accent.dk);
  root.style.setProperty(
    "--accent-lt",
    appearance.effectiveDark ? accent.ltDark : accent.lt,
  );
  document.querySelectorAll("[data-theme-opt]").forEach((btn) => {
    btn.setAttribute(
      "aria-pressed",
      String(btn.dataset.themeOpt === appearance.theme),
    );
  });
  document.querySelectorAll(".accent-dot").forEach((dot) => {
    dot.setAttribute(
      "aria-pressed",
      String(dot.dataset.accent === appearance.accent),
    );
  });
}

function applySnapshot(snapshot) {
  notes = snapshot.notes || [];
  workspaces = snapshot.workspaces || [];
  activeWorkspace = snapshot.activeWorkspace || null;
  sidebarOpen = !!snapshot.sidebarOpen;
  appearance = {
    theme: ["light", "dark", "system"].includes(snapshot.theme)
      ? snapshot.theme
      : "system",
    accent: ACCENTS[snapshot.accent] ? snapshot.accent : "violet",
    effectiveDark: !!snapshot.effectiveDark,
  };
  const savedScope = snapshot.listScope;
  if (savedScope === ALL_SCOPE && workspaces.length > 1) {
    listScope = ALL_SCOPE;
  } else if (workspaces.some((w) => w.id === savedScope)) {
    listScope = savedScope;
  } else {
    listScope = activeWorkspace;
  }
  if (listScope === ALL_SCOPE && !sidebarOpen) {
    listScope = activeWorkspace;
  }
  applyAppearance();
  renderWorkspaces();
  applyChrome();
  render();
  if (!settingsEl.hidden) renderSettingsBody();
}

function setSidebar(open) {
  sidebarOpen = !!open;
  if (!open && listScope === ALL_SCOPE && activeWorkspace) {
    listScope = activeWorkspace;
    window.manager.setWorkspace(activeWorkspace);
  }
  applyChrome();
  renderWorkspaces();
  render();
  window.manager.setSidebarOpen(sidebarOpen);
}

function placePopover(el, anchor) {
  el.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const menu = el.getBoundingClientRect();
  let top = rect.bottom + 6;
  let left = rect.right - menu.width;
  if (left < 8) left = 8;
  if (left + menu.width > window.innerWidth - 8) {
    left = window.innerWidth - menu.width - 8;
  }
  if (top + menu.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menu.height - 6);
  }
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function closeMenus() {
  moreMenuEl.hidden = true;
  wsMenuEl.hidden = true;
  noteMenuEl.hidden = true;
  moreBtnEl.setAttribute("aria-expanded", "false");
  wsChipEl.setAttribute("aria-expanded", "false");
  menuNoteId = null;
  noteMenuMode = "root";
  noteMenuAnchor = null;
}

function menuButton(opts) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("role", "menuitem");
  if (opts.danger) btn.className = "danger";
  if (opts.dot) {
    const dot = document.createElement("span");
    dot.className = "menu-dot";
    dot.style.background = opts.dot;
    btn.appendChild(dot);
  }
  if (opts.icon) {
    const ico = document.createElement("span");
    ico.setAttribute("aria-hidden", "true");
    ico.innerHTML = opts.icon;
    btn.appendChild(ico);
  }
  const text = document.createElement("span");
  text.textContent = opts.label;
  btn.appendChild(text);
  if (opts.hint) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = opts.hint;
    btn.appendChild(hint);
  }
  if (opts.checked) {
    const check = document.createElement("span");
    check.className = "check";
    check.innerHTML = ICONS.check;
    btn.appendChild(check);
  }
  if (opts.disabled) btn.disabled = true;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    opts.onClick();
  });
  return btn;
}

function openMoreMenu() {
  closeMenus();
  moreMenuEl.innerHTML = "";
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.sun,
      label: "Appearance",
      onClick: () => {
        closeMenus();
        openSettings("appearance");
      },
    }),
  );
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.keys,
      label: "Keyboard shortcuts",
      onClick: () => {
        closeMenus();
        openSettings("shortcuts");
      },
    }),
  );
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.download,
      label: "Export notes",
      onClick: () => {
        closeMenus();
        exportNotes();
      },
    }),
  );
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.upload,
      label: "Import notes",
      onClick: () => {
        closeMenus();
        importNotes();
      },
    }),
  );
  const sep = document.createElement("div");
  sep.className = "sep";
  moreMenuEl.appendChild(sep);
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.pencil,
      label: "Rename workspace",
      disabled: listScope === ALL_SCOPE || !currentWorkspace(),
      onClick: () => {
        closeMenus();
        openWorkspaceForm("rename");
      },
    }),
  );
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.trash,
      label: "Delete workspace",
      danger: true,
      disabled: workspaces.length <= 1 || listScope === ALL_SCOPE,
      onClick: () => {
        closeMenus();
        if (listScope && listScope !== ALL_SCOPE) {
          window.manager.deleteWorkspace(listScope);
        }
      },
    }),
  );
  moreMenuEl.appendChild(sep.cloneNode());
  moreMenuEl.appendChild(
    menuButton({
      icon: ICONS.info,
      label: "About Ghost Notes",
      onClick: () => {
        closeMenus();
        openSettings("about");
      },
    }),
  );
  moreBtnEl.setAttribute("aria-expanded", "true");
  placePopover(moreMenuEl, moreBtnEl);
}

function openWsMenu() {
  closeMenus();
  wsMenuEl.innerHTML = "";
  workspaces.forEach((workspace, i) => {
    const count = countIn(workspace.id);
    wsMenuEl.appendChild(
      menuButton({
        dot: workspaceTint(i).bg,
        label: `${workspace.name} · ${plural(count, "note")}`,
        checked: workspace.id === activeWorkspace,
        onClick: () => {
          closeMenus();
          selectScope(workspace.id);
        },
      }),
    );
  });
  const sep = document.createElement("div");
  sep.className = "sep";
  wsMenuEl.appendChild(sep);
  wsMenuEl.appendChild(
    menuButton({
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      label: "New workspace",
      onClick: () => {
        closeMenus();
        openWorkspaceForm("create");
      },
    }),
  );
  wsChipEl.setAttribute("aria-expanded", "true");
  placePopover(wsMenuEl, wsChipEl);
}

function fillNoteMenu(note) {
  noteMenuEl.innerHTML = "";
  if (noteMenuMode === "move") {
    workspaces.forEach((workspace, i) => {
      noteMenuEl.appendChild(
        menuButton({
          dot: workspaceTint(i).bg,
          label: workspace.name,
          checked: workspace.id === note.workspaceId,
          onClick: () => {
            closeMenus();
            if (workspace.id !== note.workspaceId) {
              window.manager.moveNote(note.id, workspace.id);
            }
          },
        }),
      );
    });
    if (noteMenuAnchor) placePopover(noteMenuEl, noteMenuAnchor);
    return;
  }

  noteMenuEl.appendChild(
    menuButton({
      icon: ICONS.open,
      label: "Open",
      onClick: () => {
        closeMenus();
        window.manager.open(note.id);
      },
    }),
  );
  if (note.visible) {
    noteMenuEl.appendChild(
      menuButton({
        icon: ICONS.eyeOff,
        label: "Hide",
        onClick: () => {
          closeMenus();
          window.manager.hide(note.id);
        },
      }),
    );
  }
  noteMenuEl.appendChild(
    menuButton({
      icon: ICONS.pencil,
      label: "Rename",
      onClick: () => {
        closeMenus();
        renamingId = note.id;
        render();
      },
    }),
  );
  if (workspaces.length > 1) {
    noteMenuEl.appendChild(
      menuButton({
        icon: ICONS.move,
        label: "Move to workspace",
        hint: "›",
        onClick: () => {
          noteMenuMode = "move";
          fillNoteMenu(note);
          if (noteMenuAnchor) placePopover(noteMenuEl, noteMenuAnchor);
        },
      }),
    );
  }
  const sep = document.createElement("div");
  sep.className = "sep";
  noteMenuEl.appendChild(sep);
  noteMenuEl.appendChild(
    menuButton({
      icon: ICONS.trash,
      label: "Delete",
      danger: true,
      onClick: () => {
        closeMenus();
        window.manager.delete(note.id);
      },
    }),
  );
}

function openNoteMenu(note, anchor) {
  const already =
    !noteMenuEl.hidden && menuNoteId === note.id && noteMenuMode === "root";
  if (already) {
    closeMenus();
    return;
  }
  closeMenus();
  menuNoteId = note.id;
  noteMenuMode = "root";
  noteMenuAnchor = anchor;
  fillNoteMenu(note);
  placePopover(noteMenuEl, anchor);
}

function openWorkspaceForm(mode) {
  closeMenus();
  formMode = mode;
  const target =
    listScope && listScope !== ALL_SCOPE
      ? workspaces.find((w) => w.id === listScope)
      : currentWorkspace();
  wsModalTitleEl.textContent =
    mode === "rename" ? "Rename workspace" : "New workspace";
  wsNameInputEl.value = mode === "rename" && target ? target.name : "";
  wsModalEl.hidden = false;
  wsNameInputEl.focus();
  wsNameInputEl.select();
}

function closeWorkspaceForm() {
  formMode = null;
  wsModalEl.hidden = true;
  wsNameInputEl.value = "";
}

let recordingShortcutId = null;
let recordingCleanup = null;

function refreshShortcutsUi() {
  render();
  if (!settingsEl.hidden && settingsPane === "shortcuts") renderSettingsBody();
}

function cancelRecording() {
  if (recordingCleanup) {
    recordingCleanup();
    recordingCleanup = null;
  }
  if (recordingShortcutId === null) return;
  recordingShortcutId = null;
  refreshShortcutsUi();
}

function electronKeyFromEvent(e) {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;

  let key = e.key;
  if (e.code && e.code.startsWith("Key")) {
    key = e.code.slice(3).toUpperCase();
  } else if (e.code && e.code.startsWith("Digit")) {
    key = e.code.slice(5);
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  return key;
}

function startRecording(shortcut) {
  if (recordingShortcutId === shortcut.id) {
    cancelRecording();
    return;
  }
  if (recordingCleanup) {
    recordingCleanup();
    recordingCleanup = null;
  }

  recordingShortcutId = shortcut.id;
  refreshShortcutsUi();

  const onKeyDown = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      cancelRecording();
      return;
    }

    const key = electronKeyFromEvent(e);
    if (!key) return;

    const parts = [];
    if (e.ctrlKey || e.metaKey) {
      parts.push("CommandOrControl");
    }
    if (shortcut.scope === "global") {
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (!parts.includes("CommandOrControl") && !parts.includes("Alt")) {
        parts.unshift("CommandOrControl");
      }
    } else {
      if (!parts.includes("CommandOrControl")) parts.push("CommandOrControl");
      if (!parts.includes("Shift")) parts.push("Shift");
    }

    parts.push(key);
    const newAccelerator = parts.join("+");

    document.removeEventListener("keydown", onKeyDown, { capture: true });
    recordingCleanup = null;

    const updated = await window.manager.setShortcut(
      shortcut.id,
      newAccelerator,
    );

    recordingShortcutId = null;
    if (Array.isArray(updated)) {
      shortcuts = updated;
    }
    refreshShortcutsUi();
  };

  document.addEventListener("keydown", onKeyDown, { capture: true });
  recordingCleanup = () => {
    document.removeEventListener("keydown", onKeyDown, { capture: true });
  };
}

function shortcutRow(shortcut) {
  const row = document.createElement("div");
  row.className = "sc-row";
  const text = document.createElement("div");
  text.className = "sc-text";
  const labelEl = document.createElement("div");
  labelEl.className = "sc-label";
  labelEl.textContent = shortcut.label;
  const descEl = document.createElement("div");
  descEl.className = "sc-desc";
  descEl.textContent = shortcut.description;
  text.appendChild(labelEl);
  text.appendChild(descEl);
  const keys = document.createElement("kbd");
  keys.className = "sc-keys";
  if (recordingShortcutId === shortcut.id) {
    keys.classList.add("kbd-recording");
    keys.textContent = "Press keys…";
  } else {
    keys.textContent = shortcut.display;
  }

  const actionsEl = document.createElement("div");
  actionsEl.className = "sc-actions";

  if (shortcut.isCustom) {
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "sc-reset-btn";
    resetBtn.textContent = "Reset";
    resetBtn.title = "Reset to default";
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      cancelRecording();
      const updated = await window.manager.resetShortcut(shortcut.id);
      if (Array.isArray(updated)) {
        shortcuts = updated;
        refreshShortcutsUi();
      }
    });
    actionsEl.appendChild(resetBtn);
  }

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn sc-edit-btn";
  editBtn.title =
    recordingShortcutId === shortcut.id
      ? "Cancel recording"
      : "Change shortcut";
  editBtn.setAttribute("aria-label", `Change shortcut for ${shortcut.label}`);
  editBtn.innerHTML = ICONS.pencil;
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startRecording(shortcut);
  });
  actionsEl.appendChild(editBtn);

  row.appendChild(text);
  row.appendChild(keys);
  row.appendChild(actionsEl);
  return row;
}

function renderShortcutsInto(target) {
  target.innerHTML = "";
  for (const section of SCOPE_SECTIONS) {
    const items = shortcuts.filter((s) => s.scope === section.scope);
    if (items.length === 0) continue;
    const group = document.createElement("div");
    group.className = "sc-group";
    const titleEl = document.createElement("div");
    titleEl.className = "sc-group-title";
    titleEl.textContent = section.title;
    const noteEl = document.createElement("div");
    noteEl.className = "sc-group-note";
    noteEl.textContent = section.note;
    group.appendChild(titleEl);
    group.appendChild(noteEl);
    for (const shortcut of items) group.appendChild(shortcutRow(shortcut));
    target.appendChild(group);
  }
}

function renderSettingsBody() {
  settingsTitleEl.textContent = SETTING_TITLES[settingsPane] || "Settings";
  document.querySelectorAll("[data-set-pane]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.setPane === settingsPane);
  });
  settingsBodyEl.innerHTML = "";

  if (settingsPane === "appearance") {
    const themeField = document.createElement("div");
    themeField.className = "field";
    themeField.innerHTML = '<div class="field-label">Theme</div>';
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Theme mode");
    for (const opt of ["light", "dark", "system"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.themeOpt = opt;
      btn.textContent = opt[0].toUpperCase() + opt.slice(1);
      btn.setAttribute("aria-pressed", String(opt === appearance.theme));
      btn.addEventListener("click", () => window.manager.setTheme(opt));
      seg.appendChild(btn);
    }
    themeField.appendChild(seg);
    settingsBodyEl.appendChild(themeField);

    const accentField = document.createElement("div");
    accentField.className = "field";
    accentField.innerHTML = '<div class="field-label">Accent color</div>';
    const wrap = document.createElement("div");
    wrap.className = "accents";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Accent color");
    for (const [id, def] of Object.entries(ACCENTS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "accent-dot";
      btn.dataset.accent = id;
      btn.title = def.label;
      btn.setAttribute("aria-label", def.label + " accent");
      btn.setAttribute("aria-pressed", String(id === appearance.accent));
      btn.style.background = def.base;
      btn.addEventListener("click", () => window.manager.setAccent(id));
      wrap.appendChild(btn);
    }
    accentField.appendChild(wrap);
    settingsBodyEl.appendChild(accentField);
    return;
  }

  if (settingsPane === "shortcuts") {
    renderShortcutsInto(settingsBodyEl);
    return;
  }

  if (settingsPane === "storage") {
    const note = document.createElement("p");
    note.className = "field-note";
    note.textContent =
      "Notes stay on this computer. Export writes a plain JSON backup (not encrypted). Import can merge with your current notes or replace them.";
    settingsBodyEl.appendChild(note);

    const exp = document.createElement("button");
    exp.type = "button";
    exp.className = "stack-btn";
    exp.innerHTML = `${ICONS.download}<div><strong>Export all notes</strong><span>Save a backup file you can keep somewhere safe.</span></div>`;
    exp.addEventListener("click", exportNotes);
    settingsBodyEl.appendChild(exp);

    const imp = document.createElement("button");
    imp.type = "button";
    imp.className = "stack-btn";
    imp.innerHTML = `${ICONS.upload}<div><strong>Import notes</strong><span>Restore from a Ghost Notes backup file.</span></div>`;
    imp.addEventListener("click", importNotes);
    settingsBodyEl.appendChild(imp);
    return;
  }

  const kicker = document.createElement("div");
  kicker.className = "about-kicker";
  kicker.textContent = appVersion
    ? `Ghost Notes v${appVersion}`
    : "Ghost Notes";
  const title = document.createElement("div");
  title.className = "about-title";
  title.textContent = "Sticky notes that stay off the recording.";
  const note = document.createElement("p");
  note.className = "field-note";
  note.textContent =
    "Private, local, and offline. Note text is never uploaded. Theme and accent only change this window — each note still keeps its own color.";
  settingsBodyEl.appendChild(kicker);
  settingsBodyEl.appendChild(title);
  settingsBodyEl.appendChild(note);
}

function openSettings(pane) {
  closeMenus();
  closeWorkspaceForm();
  if ((pane || "appearance") !== "shortcuts") cancelRecording();
  settingsPane = pane || "appearance";
  if (settingsEl.hidden) {
    focusBeforeSettings = document.activeElement;
    settingsEl.hidden = false;
    appEl.inert = true;
  }
  renderSettingsBody();
  settingsCloseEl.focus();
}

function closeSettings() {
  cancelRecording();
  if (settingsEl.hidden) return;
  settingsEl.hidden = true;
  appEl.inert = false;
  if (focusBeforeSettings && focusBeforeSettings.isConnected) {
    focusBeforeSettings.focus();
  }
  focusBeforeSettings = null;
}

async function exportNotes() {
  const res = await window.manager.exportAll();
  if (res && res.ok)
    flashStatus(`Exported ${res.count} note${res.count === 1 ? "" : "s"}`);
}

async function importNotes() {
  const res = await window.manager.importNotes();
  if (res && res.ok) {
    const dupes = res.skipped
      ? `, skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`
      : "";
    flashStatus(
      `Imported ${res.added} note${res.added === 1 ? "" : "s"}${dupes}`,
    );
  }
}

let statusTimer = null;
function flashStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.classList.add("is-on");
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = "";
    el.classList.remove("is-on");
  }, 4000);
}

searchEl.addEventListener("input", () => {
  query = searchEl.value;
  render();
});

document.getElementById("newNote").addEventListener("click", () => {
  window.manager.newNote();
});
document.getElementById("moreBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!moreMenuEl.hidden) closeMenus();
  else openMoreMenu();
});
document.getElementById("wsChip").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!wsMenuEl.hidden) closeMenus();
  else openWsMenu();
});
document
  .getElementById("wsNew")
  .addEventListener("click", () => openWorkspaceForm("create"));
document
  .getElementById("sidebarOpen")
  .addEventListener("click", () => setSidebar(true));
document
  .getElementById("sidebarClose")
  .addEventListener("click", () => setSidebar(false));
document
  .getElementById("settingsBtn")
  .addEventListener("click", () => openSettings("appearance"));
document
  .getElementById("helpBtn")
  .addEventListener("click", () => window.manager.openHelp());
document
  .getElementById("settingsClose")
  .addEventListener("click", closeSettings);
document.querySelectorAll("[data-set-pane]").forEach((btn) => {
  btn.addEventListener("click", () => openSettings(btn.dataset.setPane));
});

document
  .getElementById("wsCancel")
  .addEventListener("click", closeWorkspaceForm);
wsFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = wsNameInputEl.value.trim();
  if (!name) {
    closeWorkspaceForm();
    return;
  }
  if (formMode === "create") window.manager.createWorkspace(name);
  else if (formMode === "rename") {
    const id =
      listScope && listScope !== ALL_SCOPE ? listScope : activeWorkspace;
    window.manager.renameWorkspace(id, name);
  }
  closeWorkspaceForm();
});
wsNameInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeWorkspaceForm();
});
wsModalEl.addEventListener("click", (e) => {
  if (e.target === wsModalEl) closeWorkspaceForm();
});

document.addEventListener("click", (e) => {
  if (
    !moreMenuEl.hidden &&
    !moreMenuEl.contains(e.target) &&
    e.target !== moreBtnEl
  ) {
    closeMenus();
  } else if (
    !wsMenuEl.hidden &&
    !wsMenuEl.contains(e.target) &&
    e.target !== wsChipEl &&
    !wsChipEl.contains(e.target)
  ) {
    closeMenus();
  } else if (!noteMenuEl.hidden && !noteMenuEl.contains(e.target)) {
    closeMenus();
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    if (settingsEl.hidden && wsModalEl.hidden) {
      e.preventDefault();
      searchEl.focus();
    }
  }
  if (e.key !== "Escape") return;
  if (!moreMenuEl.hidden || !wsMenuEl.hidden || !noteMenuEl.hidden) {
    closeMenus();
    return;
  }
  if (!wsModalEl.hidden) {
    closeWorkspaceForm();
    return;
  }
  if (!settingsEl.hidden) closeSettings();
});

window.manager.onChanged(applySnapshot);
window.manager.list().then(applySnapshot);
window.manager.version().then((v) => {
  appVersion = v;
  if (!settingsEl.hidden && settingsPane === "about") renderSettingsBody();
});

const shortcutsReady = window.manager.shortcuts().then((list) => {
  shortcuts = list;
  render();
  if (!settingsEl.hidden && settingsPane === "shortcuts") renderSettingsBody();
});

async function openShortcutsFromTray() {
  await shortcutsReady;
  openSettings("shortcuts");
}

window.manager.onShowShortcuts(openShortcutsFromTray);
