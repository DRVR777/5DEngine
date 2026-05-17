// test_iter_44.js — mod loading via signed manifests.
const ML = require("./mod_loader.js");
const Manifest = require("./manifest.js");
const Apps = require("./app_framework.js");
const WG = require("./world_graph.js");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

Apps._clearAll();

// 1. createLoader + signer trust
const loader = ML.createLoader({ trustedSigners: ["ed25519:trusted_dev"] });
ok(loader.isTrusted("ed25519:trusted_dev") === true, "initial trust");
ok(loader.isTrusted("ed25519:random") === false, "random untrusted");
loader.trustSigner("ed25519:new_dev");
ok(loader.isTrusted("ed25519:new_dev"), "trustSigner adds");
loader.untrustSigner("ed25519:new_dev");
ok(!loader.isTrusted("ed25519:new_dev"), "untrustSigner removes");

// 2. Load a signed APP mod
function buildAppDef(id) {
  return {
    id, name: id, icon: "🧩", category: "mod",
    init: () => ({ msg: "hi" }),
    render: (s) => s.msg,
    handleInput: () => null,
    ipc: () => null,
  };
}

const goodManifest = Manifest.makeManifest({
  kind: "app",
  content: { appDef: buildAppDef("mod_app_1") },
  signer: { pubkey: "ed25519:trusted_dev" },
});
const r1 = loader.load(goodManifest, { framework: Apps });
ok(r1.ok === true, "trusted signed app mod loads");
ok(Apps.getApp("mod_app_1") !== null, "app registered in framework");
ok(loader.loadedList().includes(goodManifest.id), "tracked in loaded list");

// Duplicate load rejected
const dup = loader.load(goodManifest, { framework: Apps });
ok(dup.ok === false && dup.reason === "already_loaded", "duplicate rejected");

// 3. Untrusted signer → quarantine
const evilManifest = Manifest.makeManifest({
  kind: "app",
  content: { appDef: buildAppDef("mod_evil") },
  signer: { pubkey: "ed25519:attacker" },
});
const r2 = loader.load(evilManifest, { framework: Apps });
ok(r2.ok === false, "untrusted signer rejected");
ok(r2.reason === "untrusted_signer", "reason is untrusted_signer");
ok(Apps.getApp("mod_evil") === null, "evil mod NOT registered");
ok(loader.quarantineList().some(q => q.id === evilManifest.id), "quarantined");

// 4. Tampered manifest → quarantine
const tampered = JSON.parse(JSON.stringify(goodManifest));
tampered.content.appDef = buildAppDef("mod_app_2");  // changed content
const r3 = loader.load(tampered, { framework: Apps });
ok(r3.ok === false, "tampered manifest rejected");
ok(r3.reason.startsWith("verify_failed"), "verify failure surface");

// 5. World-part mod
const worldRef = new WorldState(1, { worldId: "modded_world" });
const wgraph = WG.createWorldGraph();
const worldManifest = Manifest.makeManifest({
  kind: "world_part",
  content: { worldId: "modded_world", worldRef, meta: { source: "mod_a" } },
  signer: { pubkey: "ed25519:trusted_dev" },
});
const r4 = loader.load(worldManifest, { worldGraph: wgraph });
ok(r4.ok === true, "world_part mod loads");
ok(wgraph._nodes.has("modded_world"), "world added to graph");

// 6. Asset mod via assetSink
let assetsApplied = 0;
const assetManifest = Manifest.makeManifest({
  kind: "asset",
  content: { type: "obj", verts: [-1, 0, 0, 1, 0, 0, 0, 1, 0] },
  signer: { pubkey: "ed25519:trusted_dev" },
});
const r5 = loader.load(assetManifest, {
  assetSink: (content) => { assetsApplied++; return "asset_id_1"; },
});
ok(r5.ok === true, "asset mod loads");
ok(assetsApplied === 1, "assetSink was called");

// 7. sandboxAppDef strips unknown fields
const malicious = {
  id: "mod_sandbox",
  name: "Sandbox",
  init: () => ({}),
  render: () => "",
  handleInput: () => null,
  ipc: () => null,
  // Hidden fields that should be stripped:
  bootRootkit: () => "pwned",
  __proto__poison: { x: 1 },
  rawHTML: "<script>alert(1)</script>",
};
const cleaned = loader.sandboxAppDef(malicious);
ok(cleaned.id === "mod_sandbox", "id preserved");
ok(typeof cleaned.init === "function", "init preserved");
ok(cleaned.bootRootkit === undefined, "rootkit stripped");
ok(cleaned.rawHTML === undefined, "rawHTML stripped");

// Non-function function-slot → stripped
const nonFn = { id: "x", init: "not a function", render: () => "" };
const cleaned2 = loader.sandboxAppDef(nonFn);
ok(cleaned2.init === undefined, "non-function init stripped");

// Missing id throws
let threw = false;
try { loader.sandboxAppDef({ name: "no_id" }); } catch (e) { threw = true; }
ok(threw, "appDef without id throws");

// 8. Unsupported kind
const otherManifest = Manifest.makeManifest({
  kind: "telemetry",
  content: { events: [] },
  signer: { pubkey: "ed25519:trusted_dev" },
});
const r6 = loader.load(otherManifest, {});
ok(r6.ok === false && r6.reason.startsWith("unsupported_kind"), "unknown kind rejected");

// 9. World part missing required fields
const badWp = Manifest.makeManifest({
  kind: "world_part",
  content: { meta: { incomplete: true } },
  signer: { pubkey: "ed25519:trusted_dev" },
});
const r7 = loader.load(badWp, { worldGraph: wgraph });
ok(r7.ok === false, "incomplete world part rejected");

// 10. Unload
ok(loader.unload(goodManifest.id) === true, "unload existing ok");
ok(!loader.loadedList().includes(goodManifest.id), "removed from list");
ok(loader.unload("ghost") === false, "unload missing returns false");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
