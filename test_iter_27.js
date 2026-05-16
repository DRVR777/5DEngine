// test_iter_27.js — character customization.
const Char = require("./character.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. 8 default slots
const slots = Char.slotNames();
ok(slots.length === 8, `8 slots (got ${slots.length})`);
for (const s of ["skinTone", "hairStyle", "hairColor", "top", "bottom", "shoes", "hat", "accessory"]) {
  ok(slots.includes(s), `slot ${s} present`);
}

// 2. options + defaults
ok(Char.optionsFor("skinTone").length === 4, "4 skin tones");
ok(Char.optionsFor("hairColor").length === 6, "6 hair colors");
ok(Char.defaultFor("top") === "tshirt", "default top = tshirt");
ok(Char.defaultFor("hat") === "none", "default hat = none");
ok(Char.optionsFor("nonexistent").length === 0, "unknown slot returns empty");

// 3. makeCharacter with all defaults
const c = Char.makeCharacter();
ok(c.skinTone === "tan", "default skin");
ok(c.top === "tshirt", "default top");
ok(c.hat === "none", "default hat");

// 4. Overrides
const c2 = Char.makeCharacter({ skinTone: "dark", top: "hoodie", hat: "fedora" });
ok(c2.skinTone === "dark", "override skin = dark");
ok(c2.top === "hoodie", "override top = hoodie");
ok(c2.bottom === "jeans", "non-overridden defaults to jeans");

// 5. Invalid override falls back to default
const c3 = Char.makeCharacter({ top: "spacesuit" });
ok(c3.top === "tshirt", "invalid option falls back to default");

// 6. setSlot
const c4 = Char.makeCharacter();
const r1 = Char.setSlot(c4, "top", "suit");
ok(r1.ok === true && c4.top === "suit", "setSlot success");

const r2 = Char.setSlot(c4, "top", "ufo");
ok(r2.ok === false && r2.reason === "unknown_option", "setSlot bad option");

const r3 = Char.setSlot(c4, "wing", "left");
ok(r3.ok === false && r3.reason === "unknown_slot", "setSlot bad slot");

// 7. registerOption — extend existing slot
Char.registerOption("hat", "crown", { color: 0xffd700 });
ok(Char.optionsFor("hat").includes("crown"), "new hat option registered");
const c5 = Char.makeCharacter({ hat: "crown" });
ok(c5.hat === "crown", "can use new option");
let threw = false;
try { Char.registerOption("hat", "crown", {}); } catch (e) { threw = true; }
ok(threw, "duplicate option throws");

// 8. registerSlot — entirely new slot
Char.registerSlot("backpack", {
  default: "none",
  options: { none: {}, leather: { color: 0x442200 }, tactical: { color: 0x444444 } },
});
ok(Char.slotNames().includes("backpack"), "new slot registered");
const c6 = Char.makeCharacter();
ok(c6.backpack === "none", "new slot has default");

// 9. resolve — produce render-ready map
const c7 = Char.makeCharacter({ skinTone: "tan", top: "leather", hat: "cap" });
const resolved = Char.resolve(c7);
ok(resolved.skinTone.id === "tan", "resolved id present");
ok(resolved.skinTone.color === 0xd4a373, "resolved skin color = tan hex");
ok(resolved.top.color === 0x222222, "resolved leather color");
ok(resolved.hat.color === 0xff0000, "resolved cap color");

// 10. randomize with deterministic rng
let seed = 1;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
const r1Char = Char.randomize(rng);
seed = 1;
const r2Char = Char.randomize(rng);
ok(JSON.stringify(r1Char) === JSON.stringify(r2Char), "randomize deterministic with same seed");
ok(r1Char.skinTone !== undefined && r1Char.top !== undefined, "randomized has all slots");

// 11. Preset store
const store = (() => {
  const data = {};
  return { read: k => data[k] || null, write: (k, v) => { data[k] = v; } };
})();
const ps = Char.createPresetStore({ storage: store });
ps.save("punk", Char.makeCharacter({ hairStyle: "mohawk", hairColor: "red", top: "leather" }));
ps.save("formal", Char.makeCharacter({ top: "suit", bottom: "slacks", shoes: "dress" }));
ok(ps.list().length === 2, "2 presets saved");
ok(ps.load("punk").hairStyle === "mohawk", "loaded punk preset");

// Reload from same storage
const ps2 = Char.createPresetStore({ storage: store });
ok(ps2.list().includes("punk"), "presets persist across instances");
ps.remove("punk");
ok(ps.load("punk") === null, "removed preset gone");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
