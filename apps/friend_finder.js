// apps/friend_finder.js — list friends, see who's online and what world.
// Sends/accepts requests through an injected friends list.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFriendFinder = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "friend_finder",
    name: "Friend Finder",
    icon: "👥",
    category: "social",
    init: (opts) => ({
      filter: "all",       // "all" | "online" | "offline"
      friendsList: opts.friendsList || null,   // injected
      lastResult: null,
    }),
    render: (state) => {
      if (!state.friendsList) return "FriendFinder — no friends list provided.";
      const friends = state.friendsList.listFriends(state.filter === "online" ? "online" : null);
      const filtered = state.filter === "offline"
        ? friends.filter(f => f.status !== "online")
        : friends;
      if (filtered.length === 0) return `[${state.filter}] no friends.`;
      return `[${state.filter}] ${filtered.length} friend(s):\n` +
        filtered.map(f => `  ${f.profile.handle} — ${f.status} (${f.profile.worldId || "—"})`).join("\n");
    },
    handleInput: (state, evt) => {
      if (!state.friendsList) return null;
      if (evt.type === "set_filter") {
        if (!["all", "online", "offline"].includes(evt.value)) return null;
        return { ...state, filter: evt.value };
      }
      if (evt.type === "send_request") {
        const r = state.friendsList.sendRequest(evt.handle, evt.profile);
        return { ...state, lastResult: r };
      }
      if (evt.type === "accept_request") {
        const r = state.friendsList.acceptRequest(evt.handle);
        return { ...state, lastResult: r };
      }
      if (evt.type === "decline_request") {
        const r = state.friendsList.declineRequest(evt.handle);
        return { ...state, lastResult: r };
      }
      if (evt.type === "remove_friend") {
        const r = state.friendsList.removeFriend(evt.handle);
        return { ...state, lastResult: r };
      }
      if (evt.type === "block") {
        state.friendsList.block(evt.handle);
        return { ...state, lastResult: { ok: true } };
      }
      return null;
    },
    ipc: (msg, computer) => {
      if (msg.type === "online_count" && msg.friendsList) {
        return { count: msg.friendsList.listFriends("online").length };
      }
      return null;
    },
  };

  return { APP };
});
