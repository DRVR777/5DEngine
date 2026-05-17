// test_iter_80.js — streaming overlay: chat, donations, viewers, hype.
const S = require("./stream_overlay.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createOverlay defaults
const ov = S.createOverlay();
const st0 = ov.getState();
ok(st0.viewers === 0 && st0.hype === 0, "zeros");
ok(ov.activeChat().length === 0, "empty chat");
ok(ov.pendingAlerts().length === 0, "no alerts");

// 2. Chat
const t0 = 100000;
const c1 = ov.push({ kind: "chat", user: "alice", text: "hi!", ts: t0 });
ok(c1.ok === true && c1.id === "chat_1", "chat pushed");
ok(ov.activeChat(t0).length === 1, "1 active chat");
ok(ov.getState().totalChats === 1, "totalChats incremented");

ok(ov.push({ kind: "chat", user: "" }).ok === false, "missing user/text rejected");

// 3. Chat fade
for (let i = 0; i < 10; i++) {
  ov.push({ kind: "chat", user: "u" + i, text: "msg " + i, ts: t0 + 1000 + i * 100 });
}
ok(ov.activeChat(t0 + 2000).length === 6, "chat capped at chatMaxVisible=6");

// Chat fades after 8s
ov.tick(0, t0 + 20000);
ok(ov.activeChat(t0 + 20000).length === 0, "all chat faded after 20s");

// 4. Donation
const d1 = ov.push({ kind: "donation", user: "bob", amount: 10, currency: "USD", message: "thanks!", ts: t0 });
ok(d1.ok === true, "donation pushed");
ok(ov.getState().totalDonations === 10, "totalDonations = 10");
// hype = 10 * 5 = 50
ok(ov.getState().hype === 50, `hype = 50 (got ${ov.getState().hype})`);

ok(ov.push({ kind: "donation", user: "x", amount: -1 }).ok === false, "negative amount rejected");
ok(ov.push({ kind: "donation", user: "x", amount: 0 }).ok === false, "zero amount rejected");
ok(ov.push({ kind: "donation", user: "x" }).ok === false, "missing amount rejected");

// 5. Pending alerts
const pa = ov.pendingAlerts(t0);
ok(pa.length === 1 && pa[0].kind === "donation", "donation in alerts");

// 6. Hype capping
for (let i = 0; i < 20; i++) ov.push({ kind: "donation", user: "z", amount: 10, ts: t0 });
ok(ov.getState().hype === 100, `hype capped at 100 (got ${ov.getState().hype})`);

// 7. Hype decay
ov.tick(50, t0);     // 50s * 1.0/s = 50 decay → 50
ok(Math.abs(ov.getState().hype - 50) < 0.01, `hype after decay = 50 (got ${ov.getState().hype})`);

ov.tick(1000, t0);    // way more than 50 → clamp to 0
ok(ov.getState().hype === 0, "hype clamps at 0");

// 8. Follow ribbon
ov.push({ kind: "follow", user: "newbie1", ts: t0 });
ov.push({ kind: "follow", user: "newbie2", ts: t0 });
ok(ov.recentFollows().length === 2, "2 follows in ribbon");
ok(ov.getState().totalFollows === 2, "totalFollows = 2");

// Ribbon capacity
for (let i = 0; i < 30; i++) ov.push({ kind: "follow", user: "f" + i, ts: t0 });
ok(ov.recentFollows(50).length === 20, "ribbon capped at 20");

// 9. Subscribe
const sub1 = ov.push({ kind: "subscribe", user: "carl", tier: 3, months: 12, ts: t0 });
ok(sub1.ok && sub1.alert.tier === 3, "sub tier 3");
ok(ov.getState().totalSubs === 1, "totalSubs = 1");

ok(ov.push({ kind: "subscribe" }).ok === false, "missing user rejected");

// 10. Cheer
const ch1 = ov.push({ kind: "cheer", user: "dave", bits: 500, message: "cheer500", ts: t0 });
ok(ch1.ok === true, "cheer ok");
ok(ov.push({ kind: "cheer", user: "x", bits: 0 }).ok === false, "0 bits rejected");

// 11. Raid
const rd1 = ov.push({ kind: "raid", user: "eve", raiderCount: 100, ts: t0 });
ok(rd1.ok === true, "raid ok");
ok(ov.push({ kind: "raid", user: "x" }).ok === false, "raid missing count rejected");

// 12. Viewer update
const v1 = ov.push({ kind: "viewer_update", count: 1234, ts: t0 });
ok(v1.ok === true, "viewer update ok");
ok(ov.getState().viewers === 1234, "viewers = 1234");
ok(ov.push({ kind: "viewer_update", count: -1 }).ok === false, "negative count rejected");

// 13. topDonation
const ov2 = S.createOverlay();
ov2.push({ kind: "donation", user: "a", amount: 5, ts: t0 });
ov2.push({ kind: "donation", user: "b", amount: 100, ts: t0 });
ov2.push({ kind: "donation", user: "c", amount: 25, ts: t0 });
ok(ov2.topDonation().amount === 100, "top donation = 100");

// 14. tick expires alerts
const ov3 = S.createOverlay();
ov3.push({ kind: "donation", user: "x", amount: 1, ts: t0 });
ov3.tick(0, t0 + 5000);
ok(ov3.pendingAlerts(t0 + 5000).length === 1, "alert still alive at 5s");
ov3.tick(0, t0 + 7000);
ok(ov3.pendingAlerts(t0 + 7000).length === 0, "alert expired at 7s");

// 15. pushAll
const ov4 = S.createOverlay();
const results = ov4.pushAll([
  { kind: "chat", user: "a", text: "1" },
  { kind: "chat", user: "b", text: "2" },
  { kind: "follow", user: "c" },
]);
ok(results.length === 3 && results.every(r => r.ok), "pushAll ok");

// 16. Unknown event kind
ok(ov4.push({ kind: "ghost" }).ok === false, "unknown kind rejected");

// 17. clearChat / clearAlerts / reset
ov2.clearAlerts();
ok(ov2.pendingAlerts().length === 0, "alerts cleared");
ov2.reset();
const stReset = ov2.getState();
ok(stReset.viewers === 0 && stReset.hype === 0 && stReset.totalDonations === 0, "reset");

// 18. Sub tier multiplier for hype
const ov5 = S.createOverlay();
ov5.push({ kind: "subscribe", user: "a", tier: 1, ts: t0 });
ok(ov5.getState().hype === 10, "tier 1 = 10 hype");
ov5.push({ kind: "subscribe", user: "b", tier: 3, ts: t0 });
ok(ov5.getState().hype === 40, `tier 3 = +30 (total 40) (got ${ov5.getState().hype})`);

// 19. recentEvents
const ev = ov.recentEvents();
ok(ev.length > 0, "events logged");

// 20. Custom config
const ovC = S.createOverlay({ config: { chatMaxVisible: 2, hypePerDollar: 1 } });
for (let i = 0; i < 5; i++) ovC.push({ kind: "chat", user: "u", text: "x" + i, ts: t0 });
ok(ovC.activeChat(t0).length === 2, "custom chatMaxVisible respected");
ovC.push({ kind: "donation", user: "x", amount: 10, ts: t0 });
ok(ovC.getState().hype === 10, "custom hypePerDollar");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
