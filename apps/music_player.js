// apps/music_player.js — simple playlist player.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMusicPlayer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "music_player",
    name: "Music Player",
    icon: "🎵",
    category: "media",
    init: (opts) => ({
      playlist: opts.playlist || [],     // [{title, src, duration}]
      currentIdx: -1,
      playing: false,
      volume: opts.volume != null ? opts.volume : 0.7,
      shuffle: false,
      repeat: "none",                    // "none" | "one" | "all"
    }),
    render: (state) => {
      if (state.playlist.length === 0) return "Music — no tracks.";
      const lines = state.playlist.map((t, i) => {
        const cursor = i === state.currentIdx ? (state.playing ? "▶ " : "⏸ ") : "  ";
        return `${cursor}${i + 1}. ${t.title}`;
      });
      const status = `[vol ${Math.round(state.volume * 100)}% · ${state.shuffle ? "shuffle" : "linear"} · repeat:${state.repeat}]`;
      return status + "\n" + lines.join("\n");
    },
    handleInput: (state, evt) => {
      const lp = state.playlist.length;
      if (evt.type === "play" && lp > 0) {
        const idx = evt.index != null ? evt.index : (state.currentIdx >= 0 ? state.currentIdx : 0);
        if (idx < 0 || idx >= lp) return null;
        return { ...state, currentIdx: idx, playing: true };
      }
      if (evt.type === "pause") return { ...state, playing: false };
      if (evt.type === "stop")  return { ...state, playing: false, currentIdx: -1 };
      if (evt.type === "next" && lp > 0) {
        let nxt;
        if (state.shuffle) {
          nxt = Math.floor(Math.random() * lp);
        } else {
          nxt = state.currentIdx + 1;
          if (nxt >= lp) {
            if (state.repeat === "all") nxt = 0;
            else if (state.repeat === "one") nxt = state.currentIdx;
            else return { ...state, playing: false };  // end of list
          }
        }
        return { ...state, currentIdx: nxt, playing: true };
      }
      if (evt.type === "prev" && lp > 0) {
        const prv = Math.max(0, state.currentIdx - 1);
        return { ...state, currentIdx: prv, playing: true };
      }
      if (evt.type === "set_volume") {
        const v = Math.max(0, Math.min(1, evt.value));
        return { ...state, volume: v };
      }
      if (evt.type === "toggle_shuffle") return { ...state, shuffle: !state.shuffle };
      if (evt.type === "set_repeat" && ["none", "one", "all"].includes(evt.value)) {
        return { ...state, repeat: evt.value };
      }
      if (evt.type === "add" && evt.track) {
        return { ...state, playlist: [...state.playlist, evt.track] };
      }
      if (evt.type === "remove" && typeof evt.index === "number") {
        if (evt.index < 0 || evt.index >= lp) return null;
        const next = state.playlist.slice(); next.splice(evt.index, 1);
        let newIdx = state.currentIdx;
        if (evt.index === state.currentIdx) newIdx = -1;
        else if (evt.index < state.currentIdx) newIdx--;
        return { ...state, playlist: next, currentIdx: newIdx };
      }
      return null;
    },
    ipc: () => null,
  };

  return { APP };
});
