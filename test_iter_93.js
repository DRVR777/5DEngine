// test_iter_93.js — notifications: push, priority sort, dismiss, mute.
const N = require("./notifications.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Categories + priorities
ok(N.CATEGORIES.length === 5, "5 categories");
ok(N.CATEGORIES.includes("info") && N.CATEGORIES.includes("error"), "info/error");
ok(N.PRIORITIES.length === 4, "4 priorities");

// 2. push basics
const sys = N.createSystem();
const t0 = 1000;
const r1 = sys.push({ title: "Hello", message: "world", ts: t0 });
ok(r1.ok && r1.id === "toast_1", "push ok");
ok(r1.toast.category === "info", "default info");
ok(r1.toast.priority === "normal", "default normal");

// Bad pushes
ok(sys.push({}).ok === false, "no content rejected");
ok(sys.push({ title: "x", category: "weird" }).ok === false, "bad category");
ok(sys.push({ title: "x", priority: "weird" }).ok === false, "bad priority");

// 3. Categories
const cats = ["info", "success", "warn", "error", "quest"];
const sys2 = N.createSystem();
for (const c of cats) sys2.push({ title: c, category: c, ts: t0 });
ok(sys2.activeToasts(t0).length === 5, "5 toasts active");

// 4. Priority sort: critical > high > normal > low
const sys3 = N.createSystem();
sys3.push({ title: "low", priority: "low", ts: t0 });
sys3.push({ title: "norm", priority: "normal", ts: t0 + 1 });
sys3.push({ title: "high", priority: "high", ts: t0 + 2 });
sys3.push({ title: "crit", priority: "critical", ts: t0 + 3 });
const sorted = sys3.activeToasts(t0 + 10);
ok(sorted[0].title === "crit", `crit first (got ${sorted[0].title})`);
ok(sorted[1].title === "high", "high second");
ok(sorted[2].title === "norm", "norm third");
ok(sorted[3].title === "low", "low last");

// 5. Newer first within same priority
const sys4 = N.createSystem();
sys4.push({ title: "old", ts: t0 });
sys4.push({ title: "new", ts: t0 + 1000 });
const order = sys4.activeToasts(t0 + 2000);
ok(order[0].title === "new", "newer first");

// 6. Auto-dismiss after duration
const sys5 = N.createSystem();
sys5.push({ title: "fade", category: "info", ts: t0 });  // default 3500ms
ok(sys5.activeToasts(t0 + 100).length === 1, "active at 100ms");
ok(sys5.activeToasts(t0 + 3000).length === 1, "active at 3s");
ok(sys5.activeToasts(t0 + 4000).length === 0, "gone at 4s");

// 7. Custom duration
const sys6 = N.createSystem();
sys6.push({ title: "quick", duration: 500, ts: t0 });
ok(sys6.activeToasts(t0 + 400).length === 1, "active at 400ms");
ok(sys6.activeToasts(t0 + 600).length === 0, "gone at 600ms");

// 8. Sticky never expires
const sys7 = N.createSystem();
sys7.push({ title: "sticky", sticky: true, ts: t0 });
ok(sys7.activeToasts(t0 + 1000000).length === 1, "sticky persists");

// Critical is auto-sticky
sys7.push({ title: "crit", priority: "critical", ts: t0 });
ok(sys7.activeToasts(t0 + 1000000).length === 2, "critical auto-sticky");

// 9. dismiss
const sys8 = N.createSystem();
const p = sys8.push({ title: "x", ts: t0 });
ok(sys8.dismiss(p.id).ok === true, "dismiss ok");
ok(sys8.activeToasts(t0 + 100).length === 0, "gone after dismiss");
ok(sys8.dismiss("ghost").ok === false, "ghost dismiss fails");

// 10. dismissAll
const sys9 = N.createSystem();
sys9.push({ title: "a", ts: t0 });
sys9.push({ title: "b", category: "warn", ts: t0 });
sys9.push({ title: "c", category: "info", ts: t0 });
const da = sys9.dismissAll();
ok(da.dismissed === 3, "3 dismissed");

// dismissAll with category filter
const sys10 = N.createSystem();
sys10.push({ title: "a", category: "info", ts: t0 });
sys10.push({ title: "b", category: "warn", ts: t0 });
sys10.push({ title: "c", category: "info", ts: t0 });
sys10.dismissAll({ category: "info" });
ok(sys10.activeToasts(t0).length === 1, "only warn left");
ok(sys10.activeToasts(t0)[0].title === "b", "warn b remains");

// 11. click + onClick callback
let clicked = false;
const sys11 = N.createSystem();
const c1 = sys11.push({ title: "clickme", ts: t0, onClick: () => { clicked = true; } });
sys11.click(c1.id);
ok(clicked, "onClick called");
ok(sys11.activeToasts(t0 + 100).length === 0, "click dismisses");

// 12. mute / unmute
const sys12 = N.createSystem();
sys12.muteCategory("warn");
ok(sys12.push({ title: "muted", category: "warn", ts: t0 }).ok === false, "warn muted");
sys12.unmuteCategory("warn");
ok(sys12.push({ title: "ok now", category: "warn", ts: t0 }).ok === true, "warn unmuted");

// 13. setCategoryEnabled (hide from view but still queue)
const sys13 = N.createSystem();
sys13.push({ title: "x", category: "quest", ts: t0 });
sys13.setCategoryEnabled("quest", false);
ok(sys13.activeToasts(t0 + 100).length === 0, "disabled category hidden");
sys13.setCategoryEnabled("quest", true);
ok(sys13.activeToasts(t0 + 100).length === 1, "re-enabled shows");

// 14. maxVisible cap
const sys14 = N.createSystem({ config: { maxVisible: 3 } });
for (let i = 0; i < 10; i++) sys14.push({ title: "t" + i, ts: t0 });
ok(sys14.activeToasts(t0 + 100).length === 3, "capped at 3");

// 15. maxQueueDepth cap
const sys15 = N.createSystem({ config: { maxQueueDepth: 5 } });
for (let i = 0; i < 20; i++) sys15.push({ title: "t" + i, ts: t0 });
ok(sys15.listAll().length === 5, "queue depth capped");

// 16. tick prunes old toasts
const sys16 = N.createSystem();
sys16.push({ title: "x", duration: 100, ts: t0 });
sys16.tick(t0 + 1000);
ok(sys16.listAll().length === 0, "pruned");

// Dismissed also pruned
const sys17 = N.createSystem();
const px = sys17.push({ title: "x", ts: t0 });
sys17.dismiss(px.id);
sys17.tick(t0 + 50);
ok(sys17.listAll().length === 0, "dismissed pruned");

// 17. totals
const sys18 = N.createSystem();
sys18.push({ title: "a", category: "info" });
sys18.push({ title: "b", category: "info" });
sys18.push({ title: "c", category: "warn" });
const tot = sys18.totals();
ok(tot.total === 3, "total 3");
ok(tot.info === 2, "info 2");
ok(tot.warn === 1, "warn 1");

// 18. Future toasts not shown yet
const sys19 = N.createSystem();
sys19.push({ title: "future", ts: t0 + 5000 });
ok(sys19.activeToasts(t0).length === 0, "future toast hidden");
ok(sys19.activeToasts(t0 + 5500).length === 1, "future toast appears");

// 19. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "push"), "push event");

// 20. icon + meta passthrough
const sys20 = N.createSystem();
const z = sys20.push({ title: "iconned", icon: "★", meta: { source: "quest" } });
ok(z.toast.icon === "★", "icon preserved");
ok(z.toast.meta.source === "quest", "meta preserved");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
