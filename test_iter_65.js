// test_iter_65.js — chat: rooms, mentions, mute, history, broadcast.
const C = require("./chat.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const sent = [];
const chat = C.createChatSystem({ sender: env => sent.push(env), maxHistory: 5 });

// 1. createRoom
ok(chat.createRoom("global").ok === true, "create global");
ok(chat.createRoom("global").ok === false, "duplicate room rejected");
ok(chat.listRooms().includes("global"), "listRooms");

// 2. join / leave
ok(chat.join("global", "alice").ok === true, "alice joins");
ok(chat.join("global", "alice").ok === false, "double-join rejected");
ok(chat.members("global").includes("alice"), "alice in members");
ok(sent[0].type === "chat.join", "join broadcast");

chat.join("global", "bob");
chat.join("global", "carol");
ok(chat.members("global").length === 3, "3 members");

ok(chat.leave("global", "carol").ok === true, "carol leaves");
ok(!chat.members("global").includes("carol"), "carol removed");
ok(chat.leave("global", "ghost").ok === false, "non-member leave rejected");

// 3. parseMentions
ok(JSON.stringify(chat.parseMentions("hi @alice and @bob_42!")) ===
   JSON.stringify(["alice", "bob_42"]), "two mentions extracted");
ok(chat.parseMentions("no mentions here").length === 0, "no mentions");
ok(chat.parseMentions(123).length === 0, "non-string rejected");
ok(chat.parseMentions("multi-@stuff and @things @yes").length === 3, "multiple parsed");

// 4. send + history
const msg1 = chat.send("global", "alice", "hello world");
ok(msg1.ok === true, "alice sends");
ok(typeof msg1.msgId === "string", "msgId returned");
ok(msg1.mentions.length === 0, "no mentions");

const h1 = chat.history("global");
ok(h1.length === 1, "history has 1");
ok(h1[0].text === "hello world", "text preserved");
ok(h1[0].from === "alice", "from preserved");

// 5. Non-member can't send
chat.createRoom("private");
const denied = chat.send("private", "alice", "hi");
ok(denied.ok === false && denied.reason === "not_in_room", "non-member send rejected");

// Missing room
ok(chat.send("ghost", "alice", "hi").ok === false, "missing room rejected");

// Empty message rejected
ok(chat.send("global", "alice", "").ok === false, "empty message rejected");
ok(chat.send("global", "alice", "   ").ok === false, "whitespace message rejected");

// 6. @mention triggers mention event
const mentions = [];
chat.on("mention", e => mentions.push(e));
const msgMention = chat.send("global", "alice", "@bob check this out");
ok(msgMention.ok === true, "mention message sent");
ok(msgMention.mentions[0] === "bob", "bob extracted");
ok(mentions.length === 1, "1 mention event");
ok(mentions[0].to === "bob", "bob is mentioned");
ok(mentions[0].from === "alice", "alice is mentioner");

// Multiple mentions
mentions.length = 0;
chat.send("global", "alice", "hello @bob and @carol");
// carol is not in the room anymore (left earlier), so no event for her
ok(mentions.length === 1, `only in-room mentions fire (got ${mentions.length})`);

// 7. Message events fire for all OTHER members
const recv = [];
chat.on("message", e => recv.push(e));
const beforeLen = recv.length;
chat.send("global", "alice", "broadcast");
// alice + bob in room. alice sent; bob receives.
ok(recv.length - beforeLen === 1, "1 recipient event");
ok(recv[recv.length-1].to === "bob", "bob received");

// 8. Mute
chat.mute("bob", "alice");
ok(chat.isMuted("bob", "alice") === true, "bob muted alice");
ok(chat.mutedList("bob")[0] === "alice", "muted list");

const beforeMute = recv.length;
chat.send("global", "alice", "alice talks");
ok(recv.length - beforeMute === 0, "bob did not get muted alice's message");

chat.unmute("bob", "alice");
ok(!chat.isMuted("bob", "alice"), "unmuted");
chat.send("global", "alice", "unmuted now");
ok(recv.length - beforeMute === 1, "bob gets message after unmute");

// 9. History trim (maxHistory=5)
for (let i = 0; i < 10; i++) chat.send("global", "alice", `msg ${i}`);
const trimmed = chat.history("global");
ok(trimmed.length === 5, `history capped at 5 (got ${trimmed.length})`);
ok(trimmed[4].text === "msg 9", "latest at end");
ok(trimmed[0].text === "msg 5", "oldest in window is msg 5");

// history(n)
ok(chat.history("global", { n: 2 }).length === 2, "history n=2");

// history since — use a cutoff well in the past so we get all 5 back
const cutoff = 0;  // since the dawn of time
const since = chat.history("global", { since: cutoff });
ok(since.length === 5, `history since 0 returns all 5 (got ${since.length})`);

// Empty room → no history
chat.createRoom("empty_room");
ok(chat.history("empty_room").length === 0, "empty room → no history");

// 10. getRoomsFor
chat.createRoom("alice_only");
chat.join("alice_only", "alice");
const aliceRooms = chat.getRoomsFor("alice");
ok(aliceRooms.includes("global") && aliceRooms.includes("alice_only"), "alice in 2 rooms");
ok(chat.getRoomsFor("ghost").length === 0, "ghost in 0 rooms");

// 11. Sender (Net broadcast) wraps every event
const beforeSent = sent.length;
chat.send("global", "alice", "broadcast me");
const newSent = sent.slice(beforeSent);
ok(newSent.some(e => e.type === "chat.message"), "chat.message broadcast");

const beforeJoin = sent.length;
chat.createRoom("more");
chat.join("more", "bob");
ok(sent.length - beforeJoin >= 1, "join broadcast");

chat.leave("more", "bob");
ok(sent.some(e => e.type === "chat.leave"), "leave broadcast");

// 12. Multiple rooms maintain independent history
chat.createRoom("room_a");
chat.createRoom("room_b");
chat.join("room_a", "x"); chat.join("room_b", "x");
chat.send("room_a", "x", "in A");
chat.send("room_b", "x", "in B");
ok(chat.history("room_a")[0].text === "in A", "room_a history");
ok(chat.history("room_b")[0].text === "in B", "room_b history");
ok(chat.history("room_a").length === 1, "room_a has 1");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
