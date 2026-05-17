// test_iter_76.js — photo mode: capture, filters, tag, gallery search.
const P = require("./photo_mode.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Build a 2x2 RGBA test image
function mkImg(r, g, b) {
  const buf = new Uint8Array(2 * 2 * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i]   = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255;
  }
  return buf;
}

// 1. Filters exist
const expected = ["none", "grayscale", "sepia", "invert", "high_contrast", "warm", "cool", "noir", "vibrant"];
for (const n of expected) ok(P.FILTERS[n] !== undefined, "filter exists: " + n);

// 2. applyFilters
const pic = mkImg(200, 100, 50);
P.applyFilters(pic, 2, 2, ["grayscale"]);
// gray = 0.2126*200 + 0.7152*100 + 0.0722*50 ≈ 117.99 → 117
ok(pic[0] === 117 && pic[1] === 117 && pic[2] === 117,
   `grayscale (got ${pic[0]},${pic[1]},${pic[2]})`);

// Invert
const inv = new Uint8Array([10, 20, 30, 255]);
P.applyFilters(inv, 1, 1, ["invert"]);
ok(inv[0] === 245 && inv[1] === 235 && inv[2] === 225, "invert");

// Unknown filter throws
let threw = false;
try { P.applyFilters(mkImg(0,0,0), 2, 2, ["ghost"]); } catch (e) { threw = true; }
ok(threw, "unknown filter throws");

// Custom filter
const custom = { red_only: function(p) { for (let i = 0; i < p.length; i += 4) { p[i+1] = 0; p[i+2] = 0; } } };
const cpic = mkImg(100, 100, 100);
P.applyFilters(cpic, 2, 2, ["red_only"], custom);
ok(cpic[0] === 100 && cpic[1] === 0 && cpic[2] === 0, "custom filter");

// 3. Gallery: capture
const gal = P.createGallery();
ok(gal.count() === 0, "empty gallery");

const cap1 = gal.capture({
  pixels: mkImg(0, 0, 0), w: 2, h: 2,
  meta: { world: "earth", camPos: { u: 10, v: 20 }, tod: "noon", fov: 70 },
  tags: ["scenery", "test"],
  ts: 1000,
});
ok(cap1.ok === true, "capture ok");
ok(cap1.id === "photo_1", "id = photo_1");
ok(gal.count() === 1, "count = 1");

// Buffer is copied
const orig = mkImg(50, 50, 50);
const cap2 = gal.capture({ pixels: orig, w: 2, h: 2, filters: ["invert"], ts: 2000 });
ok(orig[0] === 50, "original buffer not mutated by capture");
ok(cap2.photo.pixels[0] === 205, "captured photo has filter applied");

// Missing pixels throws
let threw2 = false;
try { gal.capture({ w: 1, h: 1 }); } catch (e) { threw2 = true; }
ok(threw2, "missing pixels throws");

// 4. get / remove
ok(gal.get(cap1.id).id === cap1.id, "get returns photo");
ok(gal.get("ghost") === null, "missing → null");

// 5. Favorite + tag
ok(gal.favorite(cap1.id).favorite === true, "favorite ok");
ok(gal.get(cap1.id).favorite === true, "favorite persisted");
ok(gal.favorite(cap1.id, false).favorite === false, "unfavorite");

ok(gal.tag(cap2.id, ["sunset", "epic"]).tags.length === 2, "tags added");
const t1 = gal.untag(cap2.id, "sunset");
ok(t1.ok && gal.get(cap2.id).tags.length === 1, "untag works");

// 6. Search
gal.capture({ pixels: mkImg(0,0,0), w: 2, h: 2,
  meta: { world: "moon" }, tags: ["space"], ts: 3000 });
gal.capture({ pixels: mkImg(0,0,0), w: 2, h: 2,
  meta: { world: "earth" }, tags: ["scenery"], ts: 4000 });

const all = gal.search();
ok(all.length === 4, "4 photos");
ok(all[0].ts === 4000, "sorted desc by ts");

const earthOnly = gal.search({ world: "earth" });
ok(earthOnly.length === 2, "world=earth filter");

const scenery = gal.search({ tag: "scenery" });
ok(scenery.length === 2, "tag=scenery");

const since = gal.search({ since: 3000 });
ok(since.length === 2, "since=3000 → 2 photos");

const limited = gal.search({ limit: 2 });
ok(limited.length === 2, "limit works");

// 7. exportSpec
const spec = gal.exportSpec(cap1.id, "png");
ok(spec.ok === true, "export ok");
ok(spec.format === "png", "format png");
ok(spec.w === 2 && spec.h === 2, "dims");
ok(spec.sizeBytes === 16, "size = 16 bytes (2*2*4)");

ok(gal.exportSpec("ghost").ok === false, "ghost export fails");

// 8. Remove
ok(gal.remove(cap1.id).ok === true, "remove ok");
ok(gal.get(cap1.id) === null, "removed");
ok(gal.count() === 3, "count = 3");
ok(gal.remove("ghost").ok === false, "remove missing fails");

// 9. Favorite-only search
gal.favorite(cap2.id);
ok(gal.search({ favorite: true }).length === 1, "favorite search");

// 10. Multiple filters stack in order
const stacked = mkImg(150, 100, 50);
P.applyFilters(stacked, 2, 2, ["grayscale", "invert"]);
// 0.2126*150 + 0.7152*100 + 0.0722*50 = 107.02 → 107, invert → 148
ok(stacked[0] === 148 && stacked[1] === 148, `stacked filters (got ${stacked[0]})`);

// 11. Events logged
const ev = gal.recentEvents();
ok(ev.length >= 4, `events logged (${ev.length})`);
ok(ev.some(e => e.kind === "capture"), "capture event");
ok(ev.some(e => e.kind === "delete"), "delete event");
ok(ev.some(e => e.kind === "favorite"), "favorite event");

// 12. Sepia preserves alpha
const sepiaPic = new Uint8Array([100, 100, 100, 128]);
P.applyFilters(sepiaPic, 1, 1, ["sepia"]);
ok(sepiaPic[3] === 128, "sepia preserves alpha");

// 13. Empty filters list = identity capture
const id = mkImg(77, 88, 99);
gal.capture({ pixels: id, w: 2, h: 2, ts: 5000 });
const last = gal.search({ limit: 1 })[0];
ok(last.pixels[0] === 77, "no-filter capture preserves color");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
