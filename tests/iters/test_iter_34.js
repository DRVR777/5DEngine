// test_iter_34.js — manifest signing + verify + dep resolution + store.
const M = require("./manifest.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. canonical stringify is order-independent
const a = canonical_demo({ b: 2, a: 1, c: { y: 4, x: 3 } });
const b = canonical_demo({ a: 1, c: { x: 3, y: 4 }, b: 2 });
function canonical_demo(o) { return M.canonical(o); }
ok(a === b, "canonical: key-order independent");
ok(M.canonical(null) === "null", "canonical: null");
ok(M.canonical([3, 1, 2]) === "[3,1,2]", "canonical: array order preserved");

// 2. contentId produces stable blake3:* string
const id1 = M.contentId({ x: 1, y: 2 });
const id2 = M.contentId({ y: 2, x: 1 });
ok(id1 === id2, "contentId stable across key order");
ok(id1.startsWith("blake3:"), "contentId has blake3 prefix");

// 3. makeManifest produces a valid envelope
const sig1 = M.makeManifest({
  kind: "world",
  content: { worldId: "park", entities: [] },
  signer: { pubkey: "ed25519:alice" },
  version: "1.0.0",
});
ok(sig1.$schema === M.SCHEMA, "schema set");
ok(sig1.kind === "world", "kind set");
ok(sig1.id === M.contentId(sig1.content), "id matches contentId");
ok(sig1.signature.startsWith("ed25519:"), "signature has ed25519 prefix");
ok(sig1.signer.pubkey === "ed25519:alice", "signer preserved");

// 4. verify a valid manifest
ok(M.verify(sig1).ok === true, "valid manifest verifies");

// 5. Tampering with content breaks verification
const tampered = JSON.parse(JSON.stringify(sig1));
tampered.content.entities = [{ id: "evil" }];
const t1 = M.verify(tampered);
ok(t1.ok === false, "tampered content fails verify");
ok(t1.reason === "content_mismatch", `reason = content_mismatch (got ${t1.reason})`);

// 6. Tampering with signature alone breaks verification
const tampered2 = JSON.parse(JSON.stringify(sig1));
tampered2.signature = "ed25519:badbad";
ok(M.verify(tampered2).ok === false, "bad signature fails verify");

// 7. Bad schema rejected
ok(M.verify({ $schema: "wrong" }).ok === false, "wrong schema rejected");
ok(M.verify(null).ok === false, "null rejected");

// 8. Different signers produce different signatures over same content
const sigA = M.makeManifest({ kind: "app", content: { name: "x" }, signer: { pubkey: "ed25519:alice" } });
const sigB = M.makeManifest({ kind: "app", content: { name: "x" }, signer: { pubkey: "ed25519:bob" } });
ok(sigA.id === sigB.id, "same content → same id");
ok(sigA.signature !== sigB.signature, "different signers → different sigs");

// 9. Required fields enforced
let threw = false;
try { M.makeManifest({}); } catch (e) { threw = true; }
ok(threw, "missing kind/content throws");

// 10. Store: put/get/has/list
const store = M.createStore();
ok(store.put(sig1).ok === true, "store put ok");
ok(store.has(sig1.id) === true, "store has");
ok(store.get(sig1.id).id === sig1.id, "store get returns manifest");
ok(store.size() === 1, "store size = 1");
ok(store.list()[0] === sig1.id, "store list");

// Store rejects invalid
const bad = JSON.parse(JSON.stringify(sig1));
bad.signature = "garbage";
ok(store.put(bad).ok === false, "store rejects unverifiable manifest");

// 11. Dependency resolution
const childA = M.makeManifest({ kind: "asset", content: { name: "a" }, signer: { pubkey: "ed25519:s" } });
const childB = M.makeManifest({ kind: "asset", content: { name: "b" }, signer: { pubkey: "ed25519:s" } });
const parent = M.makeManifest({
  kind: "world",
  content: { name: "world_with_deps" },
  deps: [childA.id, childB.id],
  signer: { pubkey: "ed25519:s" },
});
const store2 = M.createStore();
store2.put(childA); store2.put(childB); store2.put(parent);
const order = M.resolveDeps(parent, store2);
ok(order.length === 3, "dep resolve returns 3 manifests");
ok(order.indexOf(childA.id) < order.indexOf(parent.id), "childA before parent");
ok(order.indexOf(childB.id) < order.indexOf(parent.id), "childB before parent");
ok(order[order.length - 1] === parent.id, "parent last");

// 12. Diamond dependency — no double-walk
const grand = M.makeManifest({ kind: "asset", content: { name: "g" }, signer: { pubkey: "ed25519:s" } });
const left  = M.makeManifest({ kind: "asset", content: { name: "L" }, deps: [grand.id], signer: { pubkey: "ed25519:s" } });
const right = M.makeManifest({ kind: "asset", content: { name: "R" }, deps: [grand.id], signer: { pubkey: "ed25519:s" } });
const top   = M.makeManifest({ kind: "world", content: { name: "T" }, deps: [left.id, right.id], signer: { pubkey: "ed25519:s" } });
const s3 = M.createStore();
s3.put(grand); s3.put(left); s3.put(right); s3.put(top);
const ord = M.resolveDeps(top, s3);
ok(ord.length === 4, "diamond resolves to 4 unique");
ok(ord[0] === grand.id, "grand first (deepest)");

// 13. Missing dep: store doesn't have it → resolveDeps just skips
const orphan = M.makeManifest({
  kind: "world", content: { name: "orphan" }, deps: ["blake3:nonexistent"],
  signer: { pubkey: "ed25519:s" },
});
const store3 = M.createStore();
store3.put(orphan);
const orphanOrder = M.resolveDeps(orphan, store3);
ok(orphanOrder.length === 1 && orphanOrder[0] === orphan.id, "missing dep silently skipped");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
