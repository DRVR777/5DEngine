// photo_export.js — encode photo_mode.js gallery photos to PNG and
// produce shareable export bundles (clipboard recipe + metadata stamp +
// data URL). Pure JS PNG encoder using DEFLATE-stored blocks (no zlib),
// which produces a valid but uncompressed PNG; good enough for sharing
// and in-game galleries.
//
// Bundles:
//   { dataUrl, pngBytes, metadataStamp, clipboardRecipe, shareUrl? }
//
// metadataStamp is a tEXt PNG chunk readable by every viewer; includes
// world, camera pos, time-of-day, filters, tags, app:"5DEngine".
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPhotoExport = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // CRC32 table (PNG-standard polynomial)
  const _crcTable = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function _crc32(bytes, start, end) {
    let c = 0xFFFFFFFF;
    for (let i = start; i < end; i++) c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // Adler-32 (zlib checksum)
  function _adler32(bytes, start, end) {
    let a = 1, b = 0;
    for (let i = start; i < end; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function _u32be(view, off, v) {
    view[off] = (v >>> 24) & 0xFF;
    view[off+1] = (v >>> 16) & 0xFF;
    view[off+2] = (v >>> 8) & 0xFF;
    view[off+3] = v & 0xFF;
  }

  // Write a PNG chunk into out at offset. Returns new offset.
  function _writeChunk(out, off, type, data) {
    const len = data.length;
    _u32be(out, off, len);
    out[off+4] = type.charCodeAt(0);
    out[off+5] = type.charCodeAt(1);
    out[off+6] = type.charCodeAt(2);
    out[off+7] = type.charCodeAt(3);
    out.set(data, off + 8);
    const crc = _crc32(out, off + 4, off + 8 + len);
    _u32be(out, off + 8 + len, crc);
    return off + 12 + len;
  }

  // Build IDAT contents: raw zlib stream of [filter=0, scanline pixels...]
  // Use stored DEFLATE blocks (BTYPE=00) — uncompressed.
  function _buildIDAT(pixels, w, h) {
    const stride = w * 4;
    const raw = new Uint8Array((stride + 1) * h);    // filter byte per row
    let off = 0;
    for (let y = 0; y < h; y++) {
      raw[off++] = 0;     // filter: None
      raw.set(pixels.subarray(y * stride, (y + 1) * stride), off);
      off += stride;
    }
    // Wrap in stored DEFLATE blocks
    const MAX_BLOCK = 65535;
    let written = 0;
    const blocks = [];
    while (written < raw.length) {
      const len = Math.min(MAX_BLOCK, raw.length - written);
      const isLast = (written + len) >= raw.length;
      const hdr = new Uint8Array(5);
      hdr[0] = isLast ? 1 : 0;     // BFINAL + BTYPE=00
      hdr[1] = len & 0xFF;
      hdr[2] = (len >>> 8) & 0xFF;
      hdr[3] = (~len) & 0xFF;
      hdr[4] = (~len >>> 8) & 0xFF;
      blocks.push(hdr);
      blocks.push(raw.subarray(written, written + len));
      written += len;
    }
    // zlib wrapper
    const zlibHeader = new Uint8Array([0x78, 0x01]);
    const adler = _adler32(raw, 0, raw.length);
    const adlerBytes = new Uint8Array(4);
    adlerBytes[0] = (adler >>> 24) & 0xFF;
    adlerBytes[1] = (adler >>> 16) & 0xFF;
    adlerBytes[2] = (adler >>> 8) & 0xFF;
    adlerBytes[3] = adler & 0xFF;
    // concat
    let totalLen = zlibHeader.length + adlerBytes.length;
    for (const b of blocks) totalLen += b.length;
    const out = new Uint8Array(totalLen);
    let p = 0;
    out.set(zlibHeader, p); p += zlibHeader.length;
    for (const b of blocks) { out.set(b, p); p += b.length; }
    out.set(adlerBytes, p);
    return out;
  }

  function encodePNG(pixels, w, h, opts) {
    if (!pixels || pixels.length !== w * h * 4) {
      throw new Error("pixels size mismatch (expected " + (w * h * 4) + ", got " + (pixels && pixels.length) + ")");
    }
    opts = opts || {};
    // SIGNATURE + IHDR + (zero or more tEXt) + IDAT + IEND
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    _u32be(ihdr, 0, w); _u32be(ihdr, 4, h);
    ihdr[8]  = 8;    // bit depth
    ihdr[9]  = 6;    // color type: RGBA
    ihdr[10] = 0;    // compression
    ihdr[11] = 0;    // filter
    ihdr[12] = 0;    // interlace

    const textChunks = [];
    if (opts.texts) {
      for (const [k, v] of Object.entries(opts.texts)) {
        const kBytes = _strToBytes(k);
        const vBytes = _strToBytes(String(v));
        const c = new Uint8Array(kBytes.length + 1 + vBytes.length);
        c.set(kBytes, 0); c[kBytes.length] = 0;
        c.set(vBytes, kBytes.length + 1);
        textChunks.push(c);
      }
    }

    const idatData = _buildIDAT(pixels, w, h);

    // Compute total size
    let total = sig.length;
    total += 12 + ihdr.length;
    for (const t of textChunks) total += 12 + t.length;
    total += 12 + idatData.length;
    total += 12; // IEND

    const out = new Uint8Array(total);
    let off = 0;
    out.set(sig, off); off += sig.length;
    off = _writeChunk(out, off, "IHDR", ihdr);
    for (const t of textChunks) off = _writeChunk(out, off, "tEXt", t);
    off = _writeChunk(out, off, "IDAT", idatData);
    off = _writeChunk(out, off, "IEND", new Uint8Array(0));
    return out;
  }

  function _strToBytes(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xFF;
    return out;
  }

  // Build base64 from bytes (no Buffer dependency required, works in browser).
  function _toBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i], b1 = bytes[i+1] || 0, b2 = bytes[i+2] || 0;
      out += CHARS[b0 >>> 2];
      out += CHARS[((b0 & 0x03) << 4) | (b1 >>> 4)];
      out += i + 1 < bytes.length ? CHARS[((b1 & 0x0F) << 2) | (b2 >>> 6)] : "=";
      out += i + 2 < bytes.length ? CHARS[b2 & 0x3F] : "=";
    }
    return out;
  }

  function exportPhoto(photo, opts) {
    if (!photo || !photo.pixels) throw new Error("photo with pixels required");
    opts = opts || {};
    const stampApp = "5DEngine";
    const texts = Object.assign({
      app: stampApp,
      world: (photo.meta && photo.meta.world) || "earth",
      filters: (photo.filters || []).join(","),
      tags: (photo.tags || []).join(","),
      ts: String(photo.ts || Date.now()),
    }, opts.extraTexts || {});

    const pngBytes = encodePNG(photo.pixels, photo.w, photo.h, { texts });
    const dataUrl = "data:image/png;base64," + _toBase64(pngBytes);

    const clipboardRecipe = {
      type: "image/png",
      bytes: pngBytes.length,
      dataUrl,
    };

    return {
      ok: true,
      pngBytes, dataUrl,
      metadataStamp: texts,
      clipboardRecipe,
      shareUrl: opts.shareBase ? opts.shareBase + "?id=" + (photo.id || "") : null,
    };
  }

  // Bulk export → an array of {photoId, ok, ...}.
  function exportGallery(gallery, opts) {
    opts = opts || {};
    const photos = gallery.search ? gallery.search(opts.query || {}) : [];
    return photos.map(p => {
      try {
        const r = exportPhoto(p, opts);
        return Object.assign({ photoId: p.id }, r);
      } catch (e) {
        return { photoId: p.id, ok: false, reason: e.message };
      }
    });
  }

  // Parse tEXt back out — useful for round-trip verification.
  function readTextChunks(pngBytes) {
    if (pngBytes.length < 8) return {};
    const out = {};
    let off = 8;
    while (off + 12 <= pngBytes.length) {
      const len = (pngBytes[off] << 24) | (pngBytes[off+1] << 16) | (pngBytes[off+2] << 8) | pngBytes[off+3];
      const type = String.fromCharCode(pngBytes[off+4], pngBytes[off+5], pngBytes[off+6], pngBytes[off+7]);
      if (type === "tEXt") {
        let k = "", v = "", i = off + 8;
        const end = off + 8 + len;
        while (i < end && pngBytes[i] !== 0) k += String.fromCharCode(pngBytes[i++]);
        i++;
        while (i < end) v += String.fromCharCode(pngBytes[i++]);
        out[k] = v;
      }
      if (type === "IEND") break;
      off += 12 + len;
    }
    return out;
  }

  return {
    encodePNG,
    exportPhoto,
    exportGallery,
    readTextChunks,
    _toBase64,
  };
});
