// test_iter_107.js — codex: register, auto-unlock, refs, search.
const C = require("./codex.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. register
const cdx = C.createCodex();
ok(cdx.register({ id: "alice_npc", category: "characters", title: "Alice",
                  body: "A wandering merchant from the north." }).ok, "register alice");
ok(cdx.register({}).ok === false, "missing id");
ok(cdx.register({ id: "alice_npc" }).ok === false, "duplicate");

// 2. Categories + meta
cdx.register({ id: "northhold", category: "locations", title: "Northhold",
               body: "Ancient stronghold in the mountains." });
cdx.register({ id: "war_001", category: "history", title: "The War",
               body: "A long conflict.", refs: ["northhold", "alice_npc"] });

ok(cdx.categories().length === 3, "3 categories");
ok(cdx.categories().includes("history"), "history cat");

// 3. unlock + isUnlocked
ok(!cdx.isUnlocked("p1", "alice_npc"), "p1 locked");
ok(cdx.unlock("p1", "alice_npc").ok === true, "unlock");
ok(cdx.isUnlocked("p1", "alice_npc"), "p1 unlocked");
ok(cdx.unlock("p1", "alice_npc").ok === false, "double unlock");
ok(cdx.unlock("p1", "ghost").ok === false, "missing entry");

// 4. readEntry — locked vs unlocked
const lockedRead = cdx.readEntry("p1", "northhold");
ok(lockedRead.ok === false && lockedRead.reason === "locked", "locked read fails");

const peekRead = cdx.readEntry("p1", "northhold", { peek: true });
ok(peekRead.ok === true, "peek returns content");
ok(peekRead.unlocked === false, "peek shows locked flag");

cdx.unlock("p1", "northhold");
const unlockedRead = cdx.readEntry("p1", "northhold");
ok(unlockedRead.ok === true, "unlocked read ok");
ok(unlockedRead.title === "Northhold", "title returned");

// 5. Cross-refs in readEntry
cdx.unlock("p1", "war_001");
const warRead = cdx.readEntry("p1", "war_001");
ok(warRead.refs.length === 2, "2 refs");
const northRef = warRead.refs.find(r => r.id === "northhold");
ok(northRef && northRef.unlocked === true, "northhold ref unlocked");
ok(northRef.title === "Northhold", "ref title");

// Missing ref
cdx.register({ id: "with_bad_ref", title: "x", refs: ["nonexistent"] });
cdx.unlock("p1", "with_bad_ref");
const badRefRead = cdx.readEntry("p1", "with_bad_ref");
ok(badRefRead.refs[0].missing === true, "missing ref flagged");

// 6. trigger — auto-unlock by event
cdx.register({
  id: "first_blood",
  title: "First Blood",
  body: "You took your first life.",
  unlockBy: { kind: "kill_first" },
});
const newly = cdx.trigger("p2", { kind: "kill_first" });
ok(newly.length === 1, "1 entry unlocked");
ok(cdx.isUnlocked("p2", "first_blood"), "first_blood unlocked");

// Re-trigger doesn't re-unlock
const again = cdx.trigger("p2", { kind: "kill_first" });
ok(again.length === 0, "already unlocked");

// 7. trigger with param match
cdx.register({
  id: "wolf_kill",
  title: "Wolf Slayer",
  unlockBy: { kind: "kill", tag: "wolf" },
});
const noMatch = cdx.trigger("p3", { kind: "kill", tag: "bear" });
ok(noMatch.length === 0, "wrong tag → no unlock");
const match = cdx.trigger("p3", { kind: "kill", tag: "wolf" });
ok(match.length === 1, "matching tag → unlock");

// Multiple params
cdx.register({
  id: "boss_room",
  title: "Throne Room",
  unlockBy: { kind: "enter", zone: "castle", region: "north" },
});
ok(cdx.trigger("p3", { kind: "enter", zone: "castle", region: "south" }).length === 0,
   "partial match → no unlock");
ok(cdx.trigger("p3", { kind: "enter", zone: "castle", region: "north" }).length === 1,
   "full match → unlock");

// Invalid event
ok(cdx.trigger("p3", null).length === 0, "null event");
ok(cdx.trigger("p3", {}).length === 0, "no kind");

// 8. listFor
const list1 = cdx.listFor("p1");
ok(list1.length >= 3, `p1 sees ≥ 3 (got ${list1.length})`);

// Hidden entries
cdx.register({ id: "secret_lore", title: "Secret", body: "shh", hidden: true });
const listHidden = cdx.listFor("p1");
ok(!listHidden.find(e => e.id === "secret_lore"), "hidden not listed");

// includeHidden
const listAll = cdx.listFor("p1", { includeHidden: true });
ok(listAll.find(e => e.id === "secret_lore"), "include hidden");

// Hidden displayed as "???" when locked but visible
const hiddenLocked = listAll.find(e => e.id === "secret_lore");
ok(hiddenLocked.title === "???", "hidden locked shows ???");

// Unlock secret → revealed
cdx.unlock("p1", "secret_lore");
const list2 = cdx.listFor("p1");
const sec = list2.find(e => e.id === "secret_lore");
ok(sec && sec.title === "Secret", "unlocked secret shown");

// Category filter
const histList = cdx.listFor("p1", { category: "history" });
ok(histList.every(e => e.id === "war_001" || e.category === "history"), "category filter");

// unlockedOnly filter
const unlockedOnly = cdx.listFor("p1", { unlockedOnly: true });
ok(unlockedOnly.every(e => e.unlocked), "all unlocked");

// 9. search
cdx.unlock("p1", "alice_npc");
const s1 = cdx.search("p1", "merchant");
ok(s1.length >= 1, "search merchant");
ok(s1[0].id === "alice_npc", "alice matched");

const s2 = cdx.search("p1", "MERCHANT");
ok(s2.length >= 1, "case insensitive");

// Search excludes locked
const s3 = cdx.search("p4", "merchant");
ok(s3.length === 0, "locked excluded from search");

// includeLocked
const s4 = cdx.search("p4", "merchant", { includeLocked: true });
ok(s4.length >= 1, "includeLocked finds it");

// Empty / non-string text
ok(cdx.search("p1", "").length === 0, "empty text = no results");
ok(cdx.search("p1", null).length === 0, "null text = no results");

// 10. unlockedCount + totalCount + completionPct
const total = cdx.totalCount();
ok(total > 0, "total > 0");
const totalWithHidden = cdx.totalCount({ includeHidden: true });
ok(totalWithHidden > total, "includeHidden adds entries");

const u = cdx.unlockedCount("p1");
ok(u > 0, "p1 has unlocks");

const pct = cdx.completionPct("p1");
ok(pct > 0 && pct <= 1, `pct in (0,1] (got ${pct})`);
ok(cdx.completionPct("zero") === 0, "no unlocks = 0");

// 11. unregister
ok(cdx.unregister("with_bad_ref") === true, "unreg");
ok(cdx.getEntry("with_bad_ref") === null, "removed");
ok(cdx.unregister("ghost") === false, "ghost unreg");

// 12. Recent events
ok(cdx.recentEvents().length > 0, "events");
ok(cdx.recentEvents().some(e => e.kind === "unlock"), "unlock events");

// 13. Multiple players independent
const cdx2 = C.createCodex();
cdx2.register({ id: "a", title: "A" });
cdx2.unlock("p1", "a");
ok(cdx2.isUnlocked("p1", "a"), "p1 has a");
ok(!cdx2.isUnlocked("p2", "a"), "p2 doesn't");

// 14. getEntry — returns def regardless of player
ok(cdx2.getEntry("a").id === "a", "getEntry");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
