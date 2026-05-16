// crafting.js — recipes + workbench. Recipes are data: list of inputs + 1 output.
// craft(inv, recipeName) consumes inputs and adds output if available.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACrafting = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RECIPES = {
    medkit_basic: {
      inputs: [{ type: "coin", qty: 5 }],
      output: { type: "medkit", qty: 1 },
      requires: null,                    // workbench tier (null = anywhere)
      description: "Basic medkit from 5 coins",
    },
    pistol_ammo_box: {
      inputs: [{ type: "coin", qty: 10 }],
      output: { type: "pistol_9mm", qty: 30 },
      requires: "workbench_basic",
      description: "30 rounds of 9mm at the workbench",
    },
    rifle_ammo_box: {
      inputs: [{ type: "coin", qty: 20 }],
      output: { type: "rifle_556", qty: 30 },
      requires: "workbench_basic",
      description: "30 rounds of 5.56 at the workbench",
    },
    rocket_round: {
      inputs: [{ type: "coin", qty: 100 }, { type: "energy_cell", qty: 5 }],
      output: { type: "rocket", qty: 1 },
      requires: "workbench_advanced",
      description: "1 rocket — needs advanced workbench",
    },
    car_assemble_sedan: {
      inputs: [
        { type: "part_body", qty: 1 },
        { type: "part_engine", qty: 1 },
        { type: "part_wheel", qty: 4 },
      ],
      output: { type: "vehicle_blueprint_sedan", qty: 1 },
      requires: "workbench_advanced",
      description: "Assemble a sedan blueprint at the advanced workbench",
    },
  };

  function registerRecipe(name, recipe) {
    if (RECIPES[name]) throw new Error(`recipe ${name} already registered`);
    RECIPES[name] = recipe;
  }
  function getRecipe(name) { return RECIPES[name] || null; }
  function recipeNames() { return Object.keys(RECIPES); }

  // Find recipes whose inputs the inventory currently satisfies.
  function availableRecipes(inv, workbenchTier, countItem) {
    const out = [];
    for (const [name, r] of Object.entries(RECIPES)) {
      if (r.requires && r.requires !== workbenchTier &&
          !(workbenchTier === "workbench_advanced" && r.requires === "workbench_basic")) {
        continue;
      }
      let canCraft = true;
      for (const inp of r.inputs) {
        if (countItem(inv, inp.type) < inp.qty) { canCraft = false; break; }
      }
      if (canCraft) out.push(name);
    }
    return out;
  }

  // Attempt the craft. Returns { ok, reason?, output? }.
  // inv: inventory; workbenchTier: null|"workbench_basic"|"workbench_advanced";
  // invOps: { countItem, removeItem, addItem }.
  function craft(inv, recipeName, workbenchTier, invOps) {
    const r = RECIPES[recipeName];
    if (!r) return { ok: false, reason: "no_such_recipe" };
    if (r.requires && r.requires !== workbenchTier &&
        !(workbenchTier === "workbench_advanced" && r.requires === "workbench_basic")) {
      return { ok: false, reason: "wrong_workbench" };
    }
    for (const inp of r.inputs) {
      if (invOps.countItem(inv, inp.type) < inp.qty) {
        return { ok: false, reason: `missing_${inp.type}` };
      }
    }
    for (const inp of r.inputs) invOps.removeItem(inv, inp.type, inp.qty);
    const left = invOps.addItem(inv, r.output.type, r.output.qty);
    if (left > 0) {
      // Refund inputs if output didn't fit
      for (const inp of r.inputs) invOps.addItem(inv, inp.type, inp.qty);
      return { ok: false, reason: "inventory_full" };
    }
    return { ok: true, output: r.output };
  }

  return { RECIPES, getRecipe, recipeNames, registerRecipe, availableRecipes, craft };
});
