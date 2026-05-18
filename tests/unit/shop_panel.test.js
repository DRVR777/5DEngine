// Tests for src/economy/shop_panel.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/economy/shop_panel.js"), "utf8");

it("exports mountShopPanel", () => {
  expect(src).toMatch(/export\s+function\s+mountShopPanel/);
});

it("accepts { items, getScore, setScore, showToast, playSfx, isBlocked }", () => {
  expect(src).toContain("items");
  expect(src).toContain("getScore");
  expect(src).toContain("setScore");
  expect(src).toContain("showToast");
  expect(src).toContain("playSfx");
  expect(src).toContain("isBlocked");
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns { open, close, isOpen }", () => {
  expect(src).toContain("return {");
  expect(src).toContain("open,");
  expect(src).toContain("close,");
  expect(src).toContain("get isOpen()");
});

it("open() checks isBlocked guard", () => {
  expect(src).toContain("isBlocked && isBlocked()");
});

it("open() exits pointer lock", () => {
  expect(src).toContain("document.exitPointerLock");
});

it("open() shows shopOverlay", () => {
  expect(src).toContain('"shopOverlay"');
  expect(src).toContain('classList.add("open")');
});

it("open() calls _renderGrid", () => {
  const openIdx = src.indexOf("function open()");
  const renderIdx = src.indexOf("_renderGrid()", openIdx);
  expect(renderIdx).toBeGreaterThan(openIdx);
});

it("close() sets _isOpen = false", () => {
  expect(src).toContain("_isOpen = false");
});

it("close() removes open class from shopOverlay", () => {
  expect(src).toContain('classList.remove("open")');
});

it("close() re-locks gameCanvas pointer", () => {
  expect(src).toContain('"gameCanvas"');
  expect(src).toContain("requestPointerLock");
});

it("_renderGrid reads shopGrid element", () => {
  expect(src).toContain('"shopGrid"');
});

it("_renderGrid updates shopCoinDisplay", () => {
  expect(src).toContain('"shopCoinDisplay"');
});

it("_renderGrid uses getScore()", () => {
  expect(src).toContain("getScore()");
});

it("_renderGrid renders canAfford disabled class", () => {
  expect(src).toContain("shopItem");
  expect(src).toContain("disabled");
});

it("click calls setScore with cost deducted", () => {
  expect(src).toContain("setScore(cur - item.cost)");
});

it("click calls item.action()", () => {
  expect(src).toContain("item.action()");
});

it("click calls showToast with Bought prefix", () => {
  expect(src).toContain("Bought:");
});

it("click calls playSfx", () => {
  expect(src).toContain("playSfx(");
});

it("binds shopClose button at mount time", () => {
  expect(src).toContain('"shopClose"');
  expect(src).toContain('addEventListener("click", close)');
});

describe("null-safety", () => {
  it("stub returns isOpen = false when document unavailable", () => {
    expect(src).toContain("get isOpen() { return false; }");
  });
});
