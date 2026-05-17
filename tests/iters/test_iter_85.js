// test_iter_85.js — photo export: PNG encode, metadata stamp, clipboard recipe.
const P = require("./photo_mode.js");
const X = require("./photo_export.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkImg(w, h, r, g, b) {
  const buf = new Uint8Array(w * h * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255;
  }
  return buf;
}

// 1. encodePNG signature + IHDR
const px = mkImg(2, 2, 255, 0, 0);
const png = X.encodePNG(px, 2, 2);
ok(png[0] === 137 && png[1] === 80 && png[2] === 78 && png[3] === 71, "PNG signature");
ok(png[4] === 13 && png[5] === 10 && png[6] === 26 && png[7] === 10, "PNG signature pt 2");

// IHDR length (always 13) at bytes 8..12
const ihdrLen = (png[8] << 24) | (png[9] << 16) | (png[10] << 8) | png[11];
ok(ihdrLen === 13, "IHDR length = 13");
const typeIhdr = String.fromCharCode(png[12], png[13], png[14], png[15]);
ok(typeIhdr === "IHDR", "IHDR chunk type");

// Width/height in IHDR
const wRead = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
const hRead = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];
ok(wRead === 2 && hRead === 2, "IHDR dims");
ok(png[24] === 8, "bit depth = 8");
ok(png[25] === 6, "RGBA color type");

// 2. encodePNG ends with IEND (chunk is [len:4][type:4][data:0][crc:4] = 12 bytes)
const L = png.length;
const iendType = String.fromCharCode(png[L-8], png[L-7], png[L-6], png[L-5]);
ok(iendType === "IEND", "ends with IEND");

// 3. Bad input throws
let threw = false;
try { X.encodePNG(new Uint8Array(10), 2, 2); } catch (e) { threw = true; }
ok(threw, "bad pixel size throws");

threw = false;
try { X.encodePNG(null, 2, 2); } catch (e) { threw = true; }
ok(threw, "null pixels throws");

// 4. Round-trip tEXt
const png2 = X.encodePNG(px, 2, 2, { texts: { app: "5DEngine", world: "moon" } });
const texts = X.readTextChunks(png2);
ok(texts.app === "5DEngine", "app stamp present");
ok(texts.world === "moon", "world stamp present");

// 5. exportPhoto requires pixels
threw = false;
try { X.exportPhoto({}); } catch (e) { threw = true; }
ok(threw, "missing pixels throws");

// 6. exportPhoto with full metadata
const gallery = P.createGallery();
const cap = gallery.capture({
  pixels: mkImg(4, 4, 100, 200, 50), w: 4, h: 4,
  meta: { world: "earth", camPos: { u: 1, v: 2 }, tod: "sunset" },
  tags: ["epic", "test"],
  ts: 555,
});
const ex = X.exportPhoto(cap.photo);
ok(ex.ok === true, "export ok");
ok(ex.pngBytes.length > 0, "pngBytes nonempty");
ok(ex.dataUrl.startsWith("data:image/png;base64,"), "dataUrl prefix");
ok(ex.metadataStamp.app === "5DEngine", "app stamped");
ok(ex.metadataStamp.world === "earth", "world stamped");
ok(ex.metadataStamp.tags === "epic,test", "tags joined");
ok(ex.metadataStamp.ts === "555", "ts string");

// 7. clipboardRecipe
ok(ex.clipboardRecipe.type === "image/png", "clipboard type");
ok(ex.clipboardRecipe.bytes === ex.pngBytes.length, "clipboard bytes");

// 8. shareUrl
const ex2 = X.exportPhoto(cap.photo, { shareBase: "https://5d.dev/p" });
ok(ex2.shareUrl === "https://5d.dev/p?id=" + cap.id, "shareUrl built");

// 9. Round-trip metadata
const decoded = X.readTextChunks(ex.pngBytes);
ok(decoded.world === "earth", "round-trip world");
ok(decoded.tags === "epic,test", "round-trip tags");

// 10. exportGallery bulk
gallery.capture({ pixels: mkImg(2, 2, 0, 0, 255), w: 2, h: 2, meta: { world: "moon" } });
gallery.capture({ pixels: mkImg(2, 2, 0, 255, 0), w: 2, h: 2, meta: { world: "earth" } });
const bulk = X.exportGallery(gallery);
ok(bulk.length === 3, `3 exports (got ${bulk.length})`);
ok(bulk.every(e => e.ok), "all bulk exports ok");

// Filtered bulk
const moonOnly = X.exportGallery(gallery, { query: { world: "moon" } });
ok(moonOnly.length === 1, "filtered bulk = 1");

// 11. Larger image
const big = mkImg(64, 64, 80, 80, 80);
const bigPng = X.encodePNG(big, 64, 64);
ok(bigPng.length > 0, "64x64 png nonempty");
// Header is unchanged
ok(bigPng[0] === 137, "still valid signature");

// 12. Roundtrip several text chunks
const png3 = X.encodePNG(px, 2, 2, { texts: { a: "1", b: "two", c: "three three" } });
const t3 = X.readTextChunks(png3);
ok(t3.a === "1" && t3.b === "two" && t3.c === "three three", "multiple tEXt chunks");

// 13. Custom extraTexts
const ex3 = X.exportPhoto(cap.photo, { extraTexts: { author: "alice", license: "CC0" } });
ok(ex3.metadataStamp.author === "alice", "extraTexts author");
ok(ex3.metadataStamp.license === "CC0", "extraTexts license");

// 14. _toBase64 sanity
const b64 = X._toBase64(new Uint8Array([0, 1, 2, 3, 4, 5]));
ok(typeof b64 === "string" && b64.length > 0, "base64 nonempty");

// 15. Block boundary (image > 65535 raw bytes triggers multiple DEFLATE blocks)
// 200x200 * 4 + 200 (filter bytes) = 160200 > 65535 → exercises multi-block path
const huge = mkImg(200, 200, 10, 20, 30);
const hugePng = X.encodePNG(huge, 200, 200);
ok(hugePng.length > 0, "huge png encoded");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
