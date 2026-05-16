// test_iter_124.js — character customization: presets, garments, tints.
const C = require("./character_customize.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Defaults
ok(C.SLOTS.length === 8, "8 slots");
ok(C.DEFAULT_FACES.length === 4, "4 faces");
ok(C.DEFAULT_HAIRS.includes("bald"), "bald hair");
ok(C.DEFAULT_BODIES.includes("athletic"), "athletic body");

// 2. createSystem + default look
const sys = C.createSystem();
const look1 = sys.getLook("alice");
ok(look1.face === "face_a", "default face");
ok(look1.hair === "short", "default hair");
ok(look1.body === "average", "default body");
ok(look1.skinTint === "#d9b08c", "default skin");

// 3. set face/hair/body
ok(sys.setFace("alice", "face_b").ok, "face_b");
ok(sys.getLook("alice").face === "face_b", "applied");
ok(sys.setFace("alice", "ghost").ok === false, "no face");

ok(sys.setHair("alice", "ponytail").ok, "ponytail");
ok(sys.setBody("alice", "athletic").ok, "athletic");
ok(sys.setHair("alice", "weird").ok === false, "no hair");
ok(sys.setBody("alice", "weird").ok === false, "no body");

// 4. Custom presets
ok(sys.registerFace("custom_face").ok, "register face");
ok(sys.setFace("alice", "custom_face").ok, "use custom");

ok(sys.registerFace("").ok === false, "empty face");
ok(sys.registerHair("").ok === false, "empty hair");
ok(sys.registerBody("").ok === false, "empty body");

ok(sys.listFaces().includes("custom_face"), "in faces list");

// 5. Tints
ok(sys.setSkinTint("alice", "#ffeedd").ok, "skin tint");
ok(sys.getLook("alice").skinTint === "#ffeedd", "applied");
ok(sys.setSkinTint("alice", "bad").ok === false, "bad hex");
ok(sys.setSkinTint("alice", "#ggg").ok === false, "non-hex");
ok(sys.setSkinTint("alice", "#abc").ok === false, "wrong length");

ok(sys.setHairTint("alice", "#000000").ok, "hair tint");
ok(sys.setEyeTint("alice", "#00ff00").ok, "eye tint");

// 6. registerGarment
ok(sys.registerGarment({ id: "t_shirt", slot: "torso", name: "T-Shirt" }).ok, "register shirt");
ok(sys.registerGarment({}).ok === false, "missing id");
ok(sys.registerGarment({ id: "x", slot: "alien" }).ok === false, "bad slot");
ok(sys.registerGarment({ id: "t_shirt", slot: "torso" }).ok === false, "duplicate");

sys.registerGarment({ id: "jeans", slot: "legs" });
sys.registerGarment({ id: "sneakers", slot: "feet" });
sys.registerGarment({ id: "hat", slot: "head" });
sys.registerGarment({ id: "rainbow_shirt", slot: "torso", allowedTints: ["#ff0000", "#00ff00"] });

ok(sys.listGarments().length === 5, "5 garments");
ok(sys.listGarments("torso").length === 2, "2 torso garments");
ok(sys.listGarments("ghost").length === 0, "no ghost slot");

// 7. equipGarment
const eq1 = sys.equipGarment("alice", "t_shirt");
ok(eq1.ok && eq1.slot === "torso", "equip shirt");
ok(sys.getLook("alice").garments.torso.garmentId === "t_shirt", "in slot");

ok(sys.equipGarment("alice", "ghost").ok === false, "no garment");

// With tint
const eq2 = sys.equipGarment("alice", "jeans", { tint: "#0000ff" });
ok(eq2.ok && sys.getLook("alice").garments.legs.tint === "#0000ff", "blue jeans");

// Bad tint
ok(sys.equipGarment("alice", "sneakers", { tint: "bad" }).ok === false, "bad tint");

// Tint allowlist
ok(sys.equipGarment("alice", "rainbow_shirt", { tint: "#ff0000" }).ok === true, "allowed tint");
ok(sys.equipGarment("alice", "rainbow_shirt", { tint: "#0000ff" }).ok === false, "tint not allowed");

// 8. Equipping in same slot replaces
sys.equipGarment("alice", "t_shirt");
sys.equipGarment("alice", "rainbow_shirt", { tint: "#ff0000" });
ok(sys.getLook("alice").garments.torso.garmentId === "rainbow_shirt", "replaced");

// 9. setTint on equipped
ok(sys.setTint("alice", "torso", "#00ff00").ok === true, "set torso tint");
ok(sys.getLook("alice").garments.torso.tint === "#00ff00", "tint applied");

ok(sys.setTint("alice", "head", "#ffffff").ok === false, "empty slot");
ok(sys.setTint("alice", "torso", "bad").ok === false, "bad hex");

// 10. unequipSlot
ok(sys.unequipSlot("alice", "torso").ok === true, "unequip");
ok(sys.getLook("alice").garments.torso === undefined, "slot empty");
ok(sys.unequipSlot("alice", "torso").ok === false, "double unequip");

// 11. randomLook
const sys2 = C.createSystem();
const r1 = sys2.randomLook("bob", () => 0);
ok(r1.ok, "random ok");
const sp = sys2.getLook("bob");
ok(C.DEFAULT_FACES.includes(sp.face), "random face");

// 12. resetLook
sys.setFace("alice", "face_c");
sys.resetLook("alice");
ok(sys.getLook("alice").face === "face_a", "reset to defaults");

// 13. toJSON / fromJSON
sys.setFace("alice", "face_b");
sys.setBody("alice", "heavy");
const j = sys.toJSON("alice");
ok(j.face === "face_b", "json face");
ok(j.body === "heavy", "json body");

const sys3 = C.createSystem();
ok(sys3.fromJSON("alice", j).ok === true, "from json");
ok(sys3.getLook("alice").face === "face_b", "loaded face");
ok(sys3.getLook("alice").body === "heavy", "loaded body");

ok(sys3.fromJSON("x", null).ok === false, "bad json");
ok(sys3.toJSON("ghost") === null, "ghost null");

// 14. listPlayers
ok(sys.listPlayers().includes("alice"), "alice listed");

// 15. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "equip"), "equip events");

// 16. Multiple players independent
sys.setFace("alice", "face_b");
sys.setFace("bob", "face_d");
ok(sys.getLook("alice").face === "face_b", "alice unchanged");
ok(sys.getLook("bob").face === "face_d", "bob set");

// 17. Equip across all slots
const sys4 = C.createSystem();
for (const slot of C.SLOTS) {
  sys4.registerGarment({ id: slot + "_g", slot });
  sys4.equipGarment("p", slot + "_g");
}
const fullLook = sys4.getLook("p");
ok(Object.keys(fullLook.garments).length === C.SLOTS.length, "all slots equipped");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
