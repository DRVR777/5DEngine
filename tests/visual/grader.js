/**
 * grader.js — optional Ollama visual grading for screenshots.
 * If Ollama is not running or has no vision model, all calls return {skipped:true}.
 * Tests should WARN (not FAIL) when grading is skipped.
 */
"use strict";
const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const OLLAMA_URL  = "http://localhost:11434";
const VISION_MODELS = ["gemma3:4b", "llava:7b", "llava:13b", "moondream", "bakllava"];

async function _fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, { method: opts.method || "GET", headers: opts.headers || {}, timeout: 30000 }, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function _detectVisionModel() {
  try {
    const r = await _fetch(`${OLLAMA_URL}/api/tags`);
    if (r.status !== 200) return null;
    const { models } = JSON.parse(r.body);
    for (const wanted of VISION_MODELS) {
      const found = (models || []).find(m => m.name.startsWith(wanted.split(":")[0]));
      if (found) return found.name;
    }
    return null;
  } catch { return null; }
}

/**
 * Grade a screenshot image file with a yes/no question.
 * @param {string} imagePath  - absolute path to PNG screenshot
 * @param {string} question   - e.g. "Is this a first-person sniper scope view?"
 * @returns {{ skipped, pass, confidence, raw }}
 */
async function grade(imagePath, question) {
  const model = await _detectVisionModel();
  if (!model) return { skipped: true, reason: "no vision model in Ollama" };

  const imageB64 = fs.readFileSync(imagePath).toString("base64");
  const payload = JSON.stringify({
    model,
    prompt: `Answer ONLY "yes" or "no". ${question}`,
    images: [imageB64],
    stream: false,
  });

  try {
    const r = await _fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      body: payload,
    });
    if (r.status !== 200) return { skipped: true, reason: `Ollama ${r.status}` };
    const { response } = JSON.parse(r.body);
    const raw  = (response || "").trim().toLowerCase();
    const pass = raw.startsWith("yes");
    return { skipped: false, pass, raw };
  } catch (e) {
    return { skipped: true, reason: e.message };
  }
}

module.exports = { grade };
