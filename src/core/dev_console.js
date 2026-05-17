// src/core/dev_console.js — holographic developer console overlay
// Toggle with ` (backtick) or F1. Executes Engine.runCommand().
// History: up/down arrows. Autocomplete: Tab.
// Also renders a live FPS sparkline + subsystem status badge strip.
//
// API (window.DevConsole):
//   init()          — build DOM, bind keys
//   print(msg, type)— programmatic log (type: "info"|"warn"|"error"|"success")
//   toggle()

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DevConsole = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_LINES  = 200;
  const HISTORY_LEN = 50;

  let _el       = null;   // root overlay div
  let _log      = null;   // log pane
  let _input    = null;   // text input
  let _fpsEl    = null;   // fps sparkline canvas
  let _visible  = false;
  let _history  = [];     // command history
  let _histIdx  = -1;
  let _lines    = [];     // log line strings

  const COLOR = {
    info:    "#b8e8ff",
    warn:    "#ffd166",
    error:   "#ff4466",
    success: "#00ffaa",
    cmd:     "#00ccff",
    echo:    "#556677",
  };

  function _ts() {
    const d = new Date();
    return `${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
  }

  function print(msg, type = "info") {
    if (!_log) { _lines.push({ msg, type }); return; }
    // Flush any buffered lines first
    while (_lines.length) { const l = _lines.shift(); _appendLine(l.msg, l.type); }
    _appendLine(msg, type);
  }

  function _appendLine(msg, type) {
    const line = document.createElement("div");
    line.style.color = COLOR[type] || COLOR.info;
    line.style.padding = "1px 0";
    line.style.borderBottom = "1px solid rgba(0,200,255,0.04)";
    line.textContent = `[${_ts()}] ${msg}`;
    _log.appendChild(line);
    // Trim old lines
    while (_log.childNodes.length > MAX_LINES) _log.removeChild(_log.firstChild);
    _log.scrollTop = _log.scrollHeight;
  }

  function toggle() {
    if (!_el) init();
    _visible = !_visible;
    _el.style.display = _visible ? "flex" : "none";
    if (_visible) {
      _input.focus();
      print("5DEngine Developer Console — type 'help' for commands", "echo");
    }
    if (typeof Engine !== "undefined") Engine.debug.enabled = _visible;
  }

  function _submit() {
    const raw = _input.value.trim();
    if (!raw) return;
    _input.value = "";
    // History
    if (_history[0] !== raw) _history.unshift(raw);
    if (_history.length > HISTORY_LEN) _history.pop();
    _histIdx = -1;
    print(`> ${raw}`, "cmd");
    // Run
    if (typeof Engine !== "undefined") {
      const result = Engine.runCommand(raw);
      if (result) print(result, "info");
    } else {
      print("Engine not loaded yet.", "warn");
    }
  }

  function _autocomplete() {
    const val = _input.value.trim().toLowerCase();
    if (!val || typeof Engine === "undefined") return;
    const cmds = Engine.listCommands().map(([n]) => n);
    const match = cmds.find(n => n.startsWith(val));
    if (match) _input.value = match;
  }

  function init() {
    if (_el) return;

    _el = document.createElement("div");
    _el.id = "_devConsole";
    _el.style.cssText =
      "display:none;position:fixed;bottom:0;left:0;right:0;height:38vh;z-index:99999;"+
      "flex-direction:column;"+
      "background:rgba(2,5,14,0.96);border-top:1px solid rgba(0,200,255,0.4);"+
      "font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:11px;"+
      "box-shadow:0 -4px 30px rgba(0,200,255,0.15);";

    // Title bar
    const titleBar = document.createElement("div");
    titleBar.style.cssText =
      "display:flex;align-items:center;gap:12px;padding:4px 10px;"+
      "border-bottom:1px solid rgba(0,200,255,0.2);background:rgba(0,200,255,0.05);flex-shrink:0;";
    titleBar.innerHTML =
      `<span style="color:#00ccff;letter-spacing:0.12em;font-size:10px">⬡ 5DENGINE CONSOLE</span>`+
      `<span id="_consoleFpsBadge" style="color:#00ffaa;font-size:10px;margin-left:auto">-- FPS</span>`+
      `<span style="color:#445566;font-size:9px">\` to toggle</span>`;
    _el.appendChild(titleBar);

    // Log pane
    _log = document.createElement("div");
    _log.style.cssText =
      "flex:1;overflow-y:auto;padding:6px 10px;color:#b8e8ff;line-height:1.5;"+
      "scrollbar-width:thin;scrollbar-color:rgba(0,200,255,0.3) transparent;";
    _el.appendChild(_log);

    // Flush buffered lines now that _log exists
    while (_lines.length) { const l = _lines.shift(); _appendLine(l.msg, l.type); }

    // Input row
    const inputRow = document.createElement("div");
    inputRow.style.cssText =
      "display:flex;align-items:center;gap:6px;padding:5px 10px;"+
      "border-top:1px solid rgba(0,200,255,0.15);flex-shrink:0;";
    const prompt = document.createElement("span");
    prompt.style.cssText = "color:#00ccff;font-size:12px;";
    prompt.textContent = "❯";
    _input = document.createElement("input");
    _input.type = "text";
    _input.placeholder = "command…";
    _input.style.cssText =
      "flex:1;background:transparent;border:none;outline:none;color:#b8e8ff;font-size:11px;"+
      "font-family:inherit;caret-color:#00ccff;";
    _input.addEventListener("keydown", (e) => {
      if (e.code === "Enter")  { _submit(); e.stopPropagation(); }
      if (e.code === "Tab")    { _autocomplete(); e.preventDefault(); }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        _histIdx = Math.min(_histIdx + 1, _history.length - 1);
        _input.value = _history[_histIdx] || "";
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        _histIdx = Math.max(_histIdx - 1, -1);
        _input.value = _histIdx >= 0 ? _history[_histIdx] : "";
      }
      if (e.code === "Escape") { toggle(); e.stopPropagation(); }
      e.stopPropagation();   // prevent game keydown from firing
    });
    inputRow.appendChild(prompt);
    inputRow.appendChild(_input);
    _el.appendChild(inputRow);

    document.body.appendChild(_el);

    // Global keydown to open/close with backtick or F1
    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote" || e.code === "F1") {
        e.preventDefault();
        toggle();
      }
    }, true);  // capture phase so game doesn't eat it

    // FPS badge update from Engine.debug.fpsHistory
    setInterval(() => {
      const badge = document.getElementById("_consoleFpsBadge");
      if (!badge || typeof Engine === "undefined") return;
      const hist = Engine.debug.fpsHistory;
      if (!hist.length) return;
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      const color = avg >= 55 ? "#00ffaa" : avg >= 30 ? "#ffd166" : "#ff4466";
      badge.style.color = color;
      badge.textContent = `${avg.toFixed(0)} FPS`;
    }, 500);
  }

  return { init, print, toggle };
});
