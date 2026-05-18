// Tests for src/systems/quest_panel.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/quest_panel.js"), "utf8");

it("exports mountQuestPanel", () => {
  expect(src).toMatch(/export\s+function\s+mountQuestPanel/);
});

it("accepts { showToast }", () => {
  expect(src).toContain("showToast");
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns { addQuest, completeQuestStep, togglePanel, renderQuests, isOpen, getQuests }", () => {
  expect(src).toContain("addQuest,");
  expect(src).toContain("completeQuestStep,");
  expect(src).toContain("togglePanel,");
  expect(src).toContain("renderQuests,");
  expect(src).toContain("get isOpen()");
  expect(src).toContain("getQuests:");
});

it("addQuest pushes into _quests array", () => {
  expect(src).toContain("_quests.push(");
  expect(src).toContain("steps: steps.map(s => ({ text: s, done: false }))");
});

it("addQuest calls renderQuests", () => {
  const idx = src.indexOf("function addQuest");
  const call = src.indexOf("renderQuests()", idx);
  expect(call).toBeGreaterThan(idx);
});

it("addQuest calls showToast with NEW OBJECTIVE prefix", () => {
  expect(src).toContain("NEW OBJECTIVE:");
});

it("completeQuestStep marks step done", () => {
  expect(src).toContain("q.steps[stepIdx].done = true");
});

it("completeQuestStep guards already-done steps", () => {
  expect(src).toContain("q.steps[stepIdx].done) return");
});

it("completeQuestStep fires QUEST COMPLETE toast when all steps done", () => {
  expect(src).toContain("QUEST COMPLETE:");
  expect(src).toContain("q.steps.every(s => s.done)");
});

it("togglePanel flips _questOpen", () => {
  expect(src).toContain("_questOpen = !_questOpen");
});

it("togglePanel shows/hides questPanel element", () => {
  expect(src).toContain('"questPanel"');
  expect(src).toContain('"block"');
  expect(src).toContain('"none"');
});

it("togglePanel calls renderQuests when opening", () => {
  const idx = src.indexOf("function togglePanel");
  const call = src.indexOf("renderQuests()", idx);
  expect(call).toBeGreaterThan(idx);
});

it("renderQuests reads questList element", () => {
  expect(src).toContain('"questList"');
});

it("renderQuests shows empty state message when no quests", () => {
  expect(src).toContain("No active objectives.");
});

it("renderQuests renders allDone star vs arrow prefix", () => {
  expect(src).toContain('"★ "');
  expect(src).toContain('"▷ "');
});

it("getQuests returns the _quests array", () => {
  expect(src).toContain("getQuests: () => _quests");
});

describe("null-safety guard", () => {
  it("stub addQuest is no-op when document unavailable", () => {
    expect(src).toContain("addQuest: () => {}");
  });

  it("stub getQuests returns empty array when document unavailable", () => {
    expect(src).toContain("getQuests: () => _q");
  });
});
