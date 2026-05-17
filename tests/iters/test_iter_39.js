// test_iter_39.js — music_player + settings + file_manager apps.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");
const Music = require("./apps/music_player.js");
const Sett  = require("./apps/settings.js");
const FM    = require("./apps/file_manager.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();
Apps.registerApp(Music.APP);
Apps.registerApp(Sett.APP);
Apps.registerApp(FM.APP);

ok(Apps.listApps().length === 3, "3 apps registered");

// ===== MUSIC PLAYER =====
const pc = Comp.makeComputer();
const mInst = Apps.instantiate("music_player", pc, {
  playlist: [
    { title: "Track A", src: "a.mp3", duration: 180 },
    { title: "Track B", src: "b.mp3", duration: 200 },
    { title: "Track C", src: "c.mp3", duration: 160 },
  ],
}).instance;
ok(mInst.state.playlist.length === 3, "playlist seeded");
ok(mInst.state.currentIdx === -1, "no track playing initially");

const r0 = Apps.render(mInst);
ok(r0.includes("Track A"), "render lists Track A");
ok(r0.includes("[vol 70%"), "render shows volume");

// Play index 0
Apps.input(mInst, { type: "play", index: 0 });
ok(mInst.state.playing === true && mInst.state.currentIdx === 0, "playing index 0");
ok(Apps.render(mInst).includes("▶ 1. Track A"), "render shows play cursor");

// Pause
Apps.input(mInst, { type: "pause" });
ok(mInst.state.playing === false, "paused");
ok(Apps.render(mInst).includes("⏸ 1. Track A"), "render shows pause cursor");

// Resume + next
Apps.input(mInst, { type: "play" });
Apps.input(mInst, { type: "next" });
ok(mInst.state.currentIdx === 1, "next → idx 1");
Apps.input(mInst, { type: "next" });
ok(mInst.state.currentIdx === 2, "next → idx 2");

// End of list with repeat=none → stop
Apps.input(mInst, { type: "next" });
ok(mInst.state.playing === false, "end of list with repeat=none → stop");

// Repeat all wraps
Apps.input(mInst, { type: "set_repeat", value: "all" });
Apps.input(mInst, { type: "play", index: 2 });
Apps.input(mInst, { type: "next" });
ok(mInst.state.currentIdx === 0, "repeat=all → wraps to 0");

// Repeat one stays AT END (mid-list, next advances normally)
Apps.input(mInst, { type: "set_repeat", value: "one" });
Apps.input(mInst, { type: "play", index: 2 });   // end of list
Apps.input(mInst, { type: "next" });
ok(mInst.state.currentIdx === 2, "repeat=one at end → stays at 2");

// Prev
Apps.input(mInst, { type: "play", index: 2 });
Apps.input(mInst, { type: "prev" });
ok(mInst.state.currentIdx === 1, "prev → idx 1");

// Volume clamp
Apps.input(mInst, { type: "set_volume", value: 1.5 });
ok(mInst.state.volume === 1, "volume clamped at 1");
Apps.input(mInst, { type: "set_volume", value: -0.5 });
ok(mInst.state.volume === 0, "volume clamped at 0");

// Shuffle toggle
Apps.input(mInst, { type: "toggle_shuffle" });
ok(mInst.state.shuffle === true, "shuffle toggled on");

// Add/remove
Apps.input(mInst, { type: "add", track: { title: "Track D", src: "d.mp3" } });
ok(mInst.state.playlist.length === 4, "track added");
Apps.input(mInst, { type: "remove", index: 0 });
ok(mInst.state.playlist.length === 3 && mInst.state.playlist[0].title === "Track B",
   "track removed, ordering preserved");

// Empty playlist
const empty = Apps.instantiate("music_player", pc).instance;
ok(Apps.render(empty) === "Music — no tracks.", "empty playlist render");

// ===== SETTINGS =====
const sInst = Apps.instantiate("settings", pc, { computer: pc }).instance;
ok(sInst.state.values.fov === 60, "default FOV = 60");
ok(sInst.state.values.gameMode === "survival", "default mode = survival");

Apps.input(sInst, { type: "set", key: "fov", value: 75 }, pc);
ok(sInst.state.values.fov === 75, "FOV updated to 75");
ok(pc.fileSystem["settings.json"], "settings persisted to computer fs");

// Bad key ignored
const before = JSON.stringify(sInst.state.values);
Apps.input(sInst, { type: "set", key: "nonsense", value: 999 }, pc);
ok(JSON.stringify(sInst.state.values) === before, "unknown key ignored");

// Reset
Apps.input(sInst, { type: "reset" }, pc);
ok(sInst.state.values.fov === 60, "reset restores default");

// Re-instantiate from persisted (loaded from FS at init)
const sInst2 = Apps.instantiate("settings", pc, { computer: pc }).instance;
ok(sInst2.state.values.fov === 60, "loaded persisted settings on re-init");

// ===== FILE MANAGER =====
pc.fileSystem["doc1.txt"] = "Hello world this is a longer text that should be truncated in preview view";
pc.fileSystem["config.json"] = JSON.stringify({ x: 1 });
pc.fileSystem["empty.dat"] = "";

const fmInst = Apps.instantiate("file_manager", pc).instance;
fmInst.state.computer = pc;  // inject for render
const fmRender = Apps.render(fmInst);
ok(fmRender.includes("doc1.txt"), "fm renders doc1.txt");
ok(fmRender.includes("config.json"), "fm renders config.json");
ok(fmRender.includes("…"), "fm truncates long previews");

Apps.input(fmInst, { type: "select", key: "config.json" }, pc);
ok(fmInst.state.selected === "config.json", "select sets state");
ok(Apps.render(fmInst).includes("▶ config.json"), "render shows selection cursor");

Apps.input(fmInst, { type: "write", key: "newfile.md", value: "# Hello" }, pc);
ok(pc.fileSystem["newfile.md"] === "# Hello", "write created file");
ok(fmInst.state.lastWrite === "newfile.md", "lastWrite recorded");

Apps.input(fmInst, { type: "delete", key: "doc1.txt" }, pc);
ok(!("doc1.txt" in pc.fileSystem), "delete removed file");

// Delete selected file clears selection
Apps.input(fmInst, { type: "select", key: "newfile.md" }, pc);
Apps.input(fmInst, { type: "delete", key: "newfile.md" }, pc);
ok(fmInst.state.selected === null, "selection cleared after deleting selected file");

// Settings IPC
const ipcReply = Apps.ipc(fmInst, "settings", { type: "get", key: "fov" });
ok(ipcReply.ok === true && ipcReply.reply.value === 60, "ipc: settings get fov");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
