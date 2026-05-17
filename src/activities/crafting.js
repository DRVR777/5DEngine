// crafting.js — 5DEngine recipe-based crafting system
// Holographic crafting panel (C key). Supports bench requirements, stacks,
// multi-output recipes. Integrates with window.Inv if present.
//
// API (window.Crafting):
//   define(id, recipe)               — register/override a recipe
//   canCraft(inv, recipeId)           → bool
//   craft(inv, recipeId)              → { ok, result, missing }
//   getAll()                          → [{id, ...recipe}, ...]
//   showPanel(bool, inv)              — toggle crafting UI (also C key)
//   setCraftingBenches(ids)           — ids of benches currently nearby
//
// Recipe shape:
//   { label, icon, desc, inputs:[{id,qty}], outputs:[{id,qty}], bench?:string }

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Crafting = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _recipes = new Map();
  let   _panelEl  = null;
  let   _currentInv = null;
  let   _nearBenches = new Set();

  // ---- Built-in recipes ----
  const _builtins = [
    { id:"bandage",        label:"Bandage",         icon:"🩹", desc:"Restore 25 HP",
      inputs:[{id:"cloth",qty:2}], outputs:[{id:"bandage",qty:1}] },
    { id:"molotov",        label:"Molotov",          icon:"🔥", desc:"Throwable incendiary",
      inputs:[{id:"bottle",qty:1},{id:"cloth",qty:1},{id:"gasoline",qty:1}], outputs:[{id:"molotov",qty:1}] },
    { id:"pistol_9mm_x30", label:"9mm Ammo ×30",    icon:"🔫", desc:"30 rounds",
      inputs:[{id:"brass_casing",qty:3},{id:"gunpowder",qty:1}], outputs:[{id:"pistol_9mm",qty:30}], bench:"workbench" },
    { id:"medkit",         label:"Medkit",           icon:"💊", desc:"Full HP restore",
      inputs:[{id:"bandage",qty:3},{id:"antiseptic",qty:1}], outputs:[{id:"medkit",qty:1}], bench:"workbench" },
    { id:"flashbang",      label:"Flashbang",        icon:"💥", desc:"Stuns nearby enemies",
      inputs:[{id:"bottle",qty:1},{id:"gunpowder",qty:2}], outputs:[{id:"flashbang",qty:1}], bench:"workbench" },
    { id:"chest_armor",    label:"Chest Armor",      icon:"🦺", desc:"Reduces damage taken",
      inputs:[{id:"metal_scrap",qty:4},{id:"cloth",qty:2}], outputs:[{id:"chest_armor",qty:1}], bench:"workbench" },
    { id:"medkit_basic",   label:"Basic Medkit",     icon:"🩺", desc:"25 HP from coins",
      inputs:[{id:"coin",qty:5}], outputs:[{id:"bandage",qty:1}] },
    { id:"pistol_ammo_box",label:"Pistol Ammo Box",  icon:"📦", desc:"30 rounds from coins",
      inputs:[{id:"coin",qty:10}], outputs:[{id:"pistol_9mm",qty:30}], bench:"workbench_basic" },
    { id:"rifle_ammo_box", label:"Rifle Ammo Box",   icon:"📦", desc:"30 rounds 5.56",
      inputs:[{id:"coin",qty:20}], outputs:[{id:"rifle_556",qty:30}], bench:"workbench_basic" },
    { id:"energy_shield",  label:"Energy Shield",    icon:"🛡", desc:"Temporary shield item",
      inputs:[{id:"energy_cell",qty:2},{id:"metal_scrap",qty:1}], outputs:[{id:"energy_shield",qty:1}], bench:"workbench_advanced" },
  ];
  for (const r of _builtins) define(r.id, r);

  function define(id, recipe) {
    _recipes.set(id, {
      id,
      label:   recipe.label   || id,
      icon:    recipe.icon    || "⬡",
      desc:    recipe.desc    || "",
      inputs:  recipe.inputs  || [],
      outputs: recipe.outputs || [],
      bench:   recipe.bench   || null,
    });
  }

  function setCraftingBenches(ids) { _nearBenches = new Set(ids || []); }

  function _countInInv(inv, itemId) {
    if (!inv || !inv.slots) return 0;
    let n = 0;
    for (const sl of inv.slots) if (sl && sl.id === itemId) n += (sl.qty || 1);
    return n;
  }

  function _benchOk(r) {
    if (!r.bench) return true;
    // workbench_advanced satisfies workbench_basic
    if (_nearBenches.has(r.bench)) return true;
    if (r.bench === "workbench_basic" && _nearBenches.has("workbench_advanced")) return true;
    // plain "workbench" matches any workbench_ prefix
    if (r.bench === "workbench") {
      for (const b of _nearBenches) if (b.startsWith("workbench")) return true;
    }
    return false;
  }

  function canCraft(inv, recipeId) {
    const r = _recipes.get(recipeId);
    if (!r) return false;
    if (!_benchOk(r)) return false;
    for (const inp of r.inputs) if (_countInInv(inv, inp.id) < inp.qty) return false;
    return true;
  }

  function craft(inv, recipeId) {
    const r = _recipes.get(recipeId);
    if (!r) return { ok: false, missing: [], result: [] };
    if (!_benchOk(r)) return { ok: false, missing: [r.bench || "bench"], result: [] };
    const missing = [];
    for (const inp of r.inputs) {
      const have = _countInInv(inv, inp.id);
      if (have < inp.qty) missing.push({ id: inp.id, need: inp.qty, have });
    }
    if (missing.length) return { ok: false, missing, result: [] };

    if (typeof window !== "undefined" && window.Inv) {
      for (const inp of r.inputs) window.Inv.removeItem(inv, inp.id, inp.qty);
      for (const out of r.outputs) window.Inv.addItem(inv, out.id, out.qty);
    }
    if (_panelEl && _panelEl.style.display !== "none") _renderPanel();
    return { ok: true, missing: [], result: r.outputs };
  }

  function getAll() { return [..._recipes.values()]; }

  // ---- Holographic panel ----
  function _ensurePanel() {
    if (_panelEl) return;
    _panelEl = document.createElement("div");
    _panelEl.id = "_craftPanel";
    _panelEl.style.cssText =
      "display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);"+
      "width:420px;max-height:80vh;overflow-y:auto;z-index:9900;"+
      "background:rgba(2,8,22,0.97);border:1px solid rgba(0,200,255,0.4);"+
      "border-radius:10px;padding:18px;"+
      "font-family:ui-monospace,'Cascadia Code',Consolas,monospace;"+
      "font-size:11px;color:#b8e8ff;"+
      "box-shadow:0 0 40px rgba(0,200,255,0.25);";
    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    if (!_panelEl) return;
    const all = getAll();
    _panelEl.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">`+
        `<span style="color:#00ccff;font-weight:bold;letter-spacing:0.14em">⬡ CRAFTING</span>`+
        `<button onclick="Crafting.showPanel(false)" `+
          `style="background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);`+
          `color:#00ccff;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:10px">✕ Close</button>`+
      `</div>`+
      all.map(r => {
        const ok = canCraft(_currentInv, r.id);
        const needsBench = r.bench && !_benchOk(r);
        const statusColor = ok ? "0,255,170" : "255,68,102";
        const btnLabel = ok ? "⬡ CRAFT" : (needsBench ? `⚒ need ${r.bench}` : "✗ missing");
        return `<div style="margin-bottom:8px;padding:9px 11px;border-radius:6px;`+
          `background:rgba(0,200,255,0.04);border:1px solid rgba(0,200,255,0.14);">`+
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">`+
            `<span style="font-size:18px">${r.icon}</span>`+
            `<span style="color:#ffd166;font-weight:bold">${r.label}</span>`+
            `<span style="margin-left:auto;font-size:9px;color:#445566">${r.desc}</span>`+
          `</div>`+
          `<div style="font-size:9px;color:#556677;margin-bottom:5px">`+
            `IN: ${r.inputs.map(i=>`${i.qty}× ${i.id}`).join(" + ")}`+
            ` → OUT: ${r.outputs.map(o=>`${o.qty}× ${o.id}`).join(", ")}`+
          `</div>`+
          `<button onclick="window._craftClick('${r.id}')" `+
            `style="background:rgba(${statusColor},0.12);border:1px solid rgba(${statusColor},0.4);`+
            `color:#${ok?"00ffaa":"ff4466"};border-radius:3px;padding:3px 10px;`+
            `cursor:${ok?"pointer":"default"};font-size:10px">${btnLabel}</button>`+
        `</div>`;
      }).join("");
  }

  window._craftClick = function(id) {
    const res = craft(_currentInv, id);
    if (res.ok) {
      const r = _recipes.get(id);
      if (typeof showToast === "function") showToast(`Crafted: ${r ? r.label : id}`, "success");
      if (typeof playSfx === "function") playSfx("blip", 0.4);
    }
    _renderPanel();
  };

  function showPanel(on, inv) {
    _ensurePanel();
    if (inv !== undefined) _currentInv = inv;
    _panelEl.style.display = on ? "block" : "none";
    if (on) _renderPanel();
  }

  // Backwards compat alias for old GTACrafting usage
  function availableRecipes(inv, bench) {
    return getAll().filter(r => canCraft(inv, r.id)).map(r => r.id);
  }

  return { define, canCraft, craft, getAll, showPanel, setCraftingBenches,
           availableRecipes,
           // Old GTACrafting-compatible API
           RECIPES: _recipes,
           registerRecipe: define,
           recipeNames: () => [..._recipes.keys()],
         };
});
