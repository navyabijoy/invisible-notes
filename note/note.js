const params = new URLSearchParams(window.location.search);
const id = params.get("id");

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
const pinBtn = document.getElementById("pin");
const monoBtn = document.getElementById("mono");

let state = {
  text: "",
  color: "yellow",
  opacity: 0.85,
  fontSize: 15,
  monospace: false,
  ghost: false,
  pinned: true,
};

const noteEl = document.querySelector(".note");
const barEl = document.querySelector(".bar");

let ignoring = false;
function setIgnore(v) {
  if (v === ignoring) return;
  ignoring = v;
  window.notes.setIgnoreMouse(id, v);
}

function applyGhost() {
  noteEl.classList.toggle("ghost", state.ghost);
  if (state.ghost) {
    setIgnore(true);
  } else {
    setIgnore(false);
  }
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
  setIgnore(!e.target.closest(".bar"));
});

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

function applyMonospace() {
  noteEl.classList.toggle("mono", state.monospace);
  monoBtn.classList.toggle("active", state.monospace);
  monoBtn.title = state.monospace
    ? "Monospace on: click to use the default font"
    : "Monospace: better for code snippets";
}

function setMonospace(on) {
  state.monospace = on;
  applyMonospace();
  push();
}

monoBtn.addEventListener("click", () => setMonospace(!state.monospace));

function applyColor(color) {
  const c = COLORS[color] || COLORS.yellow;
  root.style.setProperty("--tint", c.tint);
  body.classList.toggle("dark", c.dark);
  for (const el of swatchesEl.children) {
    el.classList.toggle("active", el.dataset.color === color);
  }
}

function setColorPopoverOpen(open) {
  colorPopover.classList.toggle("open", open);
}

colorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setColorPopoverOpen(!colorPopover.classList.contains("open"));
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-control")) setColorPopoverOpen(false);
});

function applyState() {
  applyColor(state.color);
  root.style.setProperty("--opacity", state.opacity);
  root.style.setProperty("--font-size", state.fontSize + "px");
  opacityEl.value = Math.round(state.opacity * 100);
  textEl.value = state.text;
  applyGhost();
  applyPinned();
  applyMonospace();
}

function push() {
  window.notes.update({
    id,
    text: state.text,
    color: state.color,
    opacity: state.opacity,
    fontSize: state.fontSize,
    monospace: state.monospace,
    ghost: state.ghost,
  });
}

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

textEl.addEventListener("input", () => {
  state.text = textEl.value;
  push();
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

window.notes.onToggleGhost(() => setGhost(!state.ghost));

window.notes.getState(id).then((s) => {
  if (s) state = Object.assign(state, s);
  state.monospace = !!state.monospace;
  applyState();
  textEl.focus();
});
