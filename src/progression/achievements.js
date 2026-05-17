// achievements.js — 5DEngine achievement/trophy system
// Holographic unlock toasts, localStorage persistence, EventBus integration.
//
// API (window.Achievements):
//   define(id, opts)          — register a custom achievement
//   unlock(id)                — manually unlock
//   isUnlocked(id)            → bool
//   getAll()                  → [{id, title, desc, icon, unlocked, unlockedAt}, ...]
//   reset()                   — clear all progress
//   showPanel(bool)           — toggle achievement panel (Tab+A or game keybind)
//   tick(dt)                  — call every frame for time-based achievements
//   wireEventBus(bus)         — auto-unlock from engine events

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Achievements = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STORAGE_KEY = "5DEngine_ach_v2";
  const _defs  = new Map();
  let   _state = {};
  let   _panelEl = null;
  let   _stats = { kills: 0, deaths: 0, score: 0, time: 0, questsCompleted: 0 };

  function _load() { try { _state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) { _state = {}; } }
  function _persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch (_) {} }
  _load();

  const _builtins = [
    { id:"first_blood",    title:"First Blood",    desc:"Kill your first enemy",        icon:"⚔",  trigger:"kills>=1"  },
    { id:"kill_5",         title:"Combat Veteran", desc:"Kill 5 enemies",                icon:"🔫", trigger:"kills>=5"  },
    { id:"kill_10",        title:"Warmonger",      desc:"Kill 10 enemies",               icon:"💀", trigger:"kills>=10" },
    { id:"die_once",       title:"First Fall",     desc:"Die for the first time",        icon:"💀", trigger:"deaths>=1" },
    { id:"score_500",      title:"Scorer",         desc:"Reach score 500",               icon:"⬡",  trigger:"score>=500" },
    { id:"score_2000",     title:"High Roller",    desc:"Reach score 2000",              icon:"🏆", trigger:"score>=2000"},
    { id:"build_mode",     title:"Architect",      desc:"Enter build mode",              icon:"🔧", trigger:null },
    { id:"quest_complete", title:"Quest Done",     desc:"Complete your first quest",     icon:"⭐", trigger:null },
    { id:"survivor",       title:"Survivor",       desc:"Survive 5 minutes",             icon:"⏱",  trigger:"time>=300" },
    { id:"explorer",       title:"Explorer",       desc:"Walk more than 200m from spawn",icon:"🗺",  trigger:null },
  ];
  for (const b of _builtins) define(b.id, b);

  function define(id, opts) {
    _defs.set(id, { id, title: opts.title||id, desc: opts.desc||"", icon: opts.icon||"⬡", trigger: opts.trigger||null });
  }

  function isUnlocked(id) { return !!(_state[id] && _state[id].unlocked); }

  function unlock(id) {
    if (isUnlocked(id)) return false;
    const def = _defs.get(id);
    if (!def) return false;
    _state[id] = { unlocked: true, unlockedAt: Date.now() };
    _persist();
    _toast(def);
    if (_panelEl && _panelEl.style.display !== "none") _renderPanel();
    return true;
  }

  function _toast(def) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:80px;right:20px;z-index:9999;"+
      "background:rgba(2,8,22,0.97);border:1px solid rgba(255,209,102,0.6);"+
      "border-radius:8px;padding:12px 18px;"+
      "font-family:ui-monospace,'Cascadia Code',Consolas,monospace;"+
      "font-size:12px;color:#ffd166;"+
      "box-shadow:0 0 24px rgba(255,209,102,0.3);"+
      "animation:toastIn 0.3s ease-out forwards;min-width:220px;";
    el.innerHTML =
      `<div style="font-size:9px;letter-spacing:0.18em;color:#00ccff;margin-bottom:4px">⬡ ACHIEVEMENT UNLOCKED</div>`+
      `<div style="display:flex;gap:10px;align-items:center">`+
        `<span style="font-size:22px">${def.icon}</span>`+
        `<span><div style="font-weight:bold">${def.title}</div>`+
        `<div style="font-size:10px;color:#778899;margin-top:1px">${def.desc}</div></span>`+
      `</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.transition="opacity 0.4s"; el.style.opacity="0"; setTimeout(()=>el.remove(), 420); }, 4500);
    if (typeof playSfx === "function") playSfx("tone:880:80:sine", 0.3);
  }

  function _checkTriggers() {
    for (const [id, def] of _defs) {
      if (!def.trigger || isUnlocked(id)) continue;
      const m = def.trigger.match(/^(\w+)>=(\d+)$/);
      if (m && _stats[m[1]] !== undefined && _stats[m[1]] >= +m[2]) unlock(id);
    }
  }

  function wireEventBus(bus) {
    if (!bus) return;
    bus.on(bus.EVENTS.ENEMY_KILLED, ({ kills }) => { _stats.kills = kills; _checkTriggers(); });
    bus.on(bus.EVENTS.HERO_DIED,    ()            => { _stats.deaths++; _checkTriggers(); });
    bus.on(bus.EVENTS.SCORE_CHANGED,({ score })   => { _stats.score = score; _checkTriggers(); });
    bus.on(bus.EVENTS.QUEST_COMPLETE, ()           => { _stats.questsCompleted++; unlock("quest_complete"); });
    bus.on(bus.EVENTS.BUILD_MODE_ON,  ()           => unlock("build_mode"));
  }

  function tick(dt) {
    _stats.time += dt;
    if (Math.floor(_stats.time) % 10 === 0) _checkTriggers();
  }

  function getAll() {
    return [..._defs.values()].map(d => ({
      ...d, unlocked: isUnlocked(d.id), unlockedAt: (_state[d.id]||{}).unlockedAt||null,
    }));
  }

  function reset() { _state = {}; _persist(); if (_panelEl) _renderPanel(); }

  function _ensurePanel() {
    if (_panelEl) return;
    _panelEl = document.createElement("div");
    _panelEl.id = "_achPanel";
    _panelEl.style.cssText =
      "display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);"+
      "width:360px;max-height:72vh;overflow-y:auto;z-index:9900;"+
      "background:rgba(2,8,22,0.97);border:1px solid rgba(0,200,255,0.4);"+
      "border-radius:10px;padding:18px;"+
      "font-family:ui-monospace,'Cascadia Code',Consolas,monospace;"+
      "font-size:11px;color:#b8e8ff;"+
      "box-shadow:0 0 40px rgba(0,200,255,0.25);";
    document.body.appendChild(_panelEl);
    _renderPanel();
  }

  function _renderPanel() {
    if (!_panelEl) return;
    const all = getAll();
    const n = all.filter(a => a.unlocked).length;
    _panelEl.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">`+
        `<span style="color:#00ccff;font-weight:bold;letter-spacing:0.14em">⬡ ACHIEVEMENTS</span>`+
        `<span style="color:#778899;font-size:10px">${n}/${all.length}</span>`+
      `</div>`+
      all.map(a =>
        `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;padding:7px 10px;border-radius:5px;`+
          `background:${a.unlocked?"rgba(0,200,255,0.07)":"rgba(0,0,0,0.2)"};`+
          `border:1px solid ${a.unlocked?"rgba(0,200,255,0.22)":"rgba(255,255,255,0.04)"}">`+
          `<span style="font-size:18px;opacity:${a.unlocked?1:0.25}">${a.icon}</span>`+
          `<span><div style="color:${a.unlocked?"#ffd166":"#445566"}">${a.title}</div>`+
          `<div style="font-size:9px;color:#445566;margin-top:1px">${a.desc}</div></span>`+
          `<span style="margin-left:auto;color:#00ffaa;font-size:10px">${a.unlocked?"✓":""}</span>`+
        `</div>`).join("")+
      `<div style="margin-top:10px;text-align:center;display:flex;gap:8px;justify-content:center">`+
        `<button onclick="Achievements.reset()" style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:#ff4466;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:10px">Reset</button>`+
        `<button onclick="Achievements.showPanel(false)" style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);color:#00ccff;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:10px">Close</button>`+
      `</div>`;
  }

  function showPanel(on) {
    _ensurePanel();
    _panelEl.style.display = on ? "block" : "none";
    if (on) _renderPanel();
  }

  return { define, unlock, isUnlocked, getAll, reset, showPanel, tick, wireEventBus };
});
