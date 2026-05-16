// test_iter_72.js — emotes + emoji.
const E = require("./emotes.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Palette
ok(E.listEmotes().length >= 12, ">= 12 emotes");
ok(E.getEmote("wave") !== null, "wave");
ok(E.getEmote("dance").loops === true, "dance loops");
ok(E.getEmote("sit").duration === -1, "sit is indefinite");
ok(E.getEmote("ghost") === null, "unknown emote");

// 2. Emoji library
ok(E.listEmojis().length >= 18, ">= 18 emojis");
ok(E.getEmoji("smile") === "😀", "smile glyph");
ok(E.getEmoji("ghost") === null, "unknown emoji");

// 3. Register custom
E.registerEmote("dab", { animation: "dab", duration: 2.0, kind: "gesture" });
ok(E.getEmote("dab") !== null, "custom emote registered");

E.registerEmoji("rocket", "🚀");
ok(E.getEmoji("rocket") === "🚀", "custom emoji");

let threw = false;
try { E.registerEmote("wave", {}); } catch (e) { threw = true; }
ok(threw, "duplicate emote throws");

threw = false;
try { E.registerEmoji("smile", "x"); } catch (e) { threw = true; }
ok(threw, "duplicate emoji throws");

// 4. trigger broadcasts + tracks
const sent = [];
const sys = E.createEmoteSystem({ sender: env => sent.push(env) });

const r1 = sys.trigger("alice", "wave");
ok(r1.ok === true, "trigger wave");
ok(typeof r1.expiresAt === "number", "expiresAt set");
ok(sent.length === 1 && sent[0].type === "emote.trigger", "broadcast fired");
ok(sent[0].payload.playerId === "alice", "playerId in payload");
ok(sent[0].payload.emote === "wave", "emote name in payload");
ok(sent[0].payload.kind === "gesture", "kind in payload");

ok(sys.isEmoting("alice") === true, "alice emoting");
ok(sys.isEmoting("bob") === false, "bob not emoting");

// Bad emote name
const rBad = sys.trigger("alice", "ghost_dance");
ok(rBad.ok === false && rBad.reason === "no_such_emote", "unknown emote rejected");

// 5. Triggering a new emote cancels the previous
const beforeLen = sent.length;
const r2 = sys.trigger("alice", "salute");
ok(r2.ok === true, "salute triggered");
ok(sent[beforeLen].type === "emote.cancel", "previous emote canceled first");
ok(sys.getActive("alice").emote === "salute", "active is now salute");

// 6. cancel
ok(sys.cancel("alice") === true, "cancel ok");
ok(!sys.isEmoting("alice"), "no longer emoting");
ok(sys.cancel("ghost") === false, "cancel ghost → false");

// 7. tick expires non-loop emotes
sys.trigger("bob", "wave", { ts: 1000 });
// wave is 1.5s = 1500ms; expiresAt = 1000+1500 = 2500. Tick past it.
const expired1 = sys.tick(2600);
ok(expired1.includes("bob"), "wave expired after 1.5s");
ok(!sys.isEmoting("bob"), "bob no longer emoting");

// Loops don't expire via tick
sys.trigger("carol", "dance", { ts: 1000 });
const expired2 = sys.tick(99999999);
ok(!expired2.includes("carol"), "dance loops, doesn't expire");
ok(sys.isEmoting("carol"), "carol still dancing");

// Stance (sit) doesn't expire
sys.trigger("dave", "sit", { ts: 1000 });
const expired3 = sys.tick(99999999);
ok(!expired3.includes("dave"), "sit doesn't expire");

// 8. listActive
const active = sys.listActive();
ok(active.length === 2, `2 active emoters (got ${active.length})`);

// 9. sendEmoji
const beforeEmoji = sent.length;
const e1 = sys.sendEmoji("alice", "fire");
ok(e1.ok === true, "sendEmoji ok");
ok(e1.glyph === "🔥", "fire glyph");
ok(sent[beforeEmoji].type === "emote.emoji", "emoji broadcast type");
ok(sent[beforeEmoji].payload.glyph === "🔥", "glyph in payload");

const eBad = sys.sendEmoji("alice", "ghost");
ok(eBad.ok === false, "unknown emoji rejected");

// 10. Recent broadcasts
const rec = sys.recentBroadcasts();
ok(rec.length >= 5, "recent broadcasts logged");
const types = new Set(rec.map(r => r.type));
ok(types.has("emote.trigger") && types.has("emote.emoji"), "multiple types in recent");

// 11. Custom timestamp
const tsTrigger = sys.trigger("eve", "salute", { ts: 5000 });
const eveActive = sys.getActive("eve");
ok(eveActive.startedAt === 5000, "custom ts honored");
ok(eveActive.expiresAt === 5000 + 1200, "expiresAt = ts + duration*1000");

// 12. tick with no expirations
const expired4 = sys.tick(1);
ok(expired4.length === 0, "no expirations at very early tick");

// 13. emote.expired events fire on expiration
const beforeExpire = sent.length;
sys.trigger("frank", "wave", { ts: 100 });
sys.tick(100 + 2000);
const expireEvents = sent.slice(beforeExpire).filter(e => e.type === "emote.expired");
ok(expireEvents.length >= 1, "expired event broadcast");
ok(expireEvents[expireEvents.length - 1].payload.playerId === "frank", "frank's expire");

// 14. Multiple players coexist
sys.trigger("g1", "laugh");
sys.trigger("g2", "cry");
sys.trigger("g3", "point");
const allActive = sys.listActive();
ok(allActive.length >= 5, `5+ emoters tracked (got ${allActive.length})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
