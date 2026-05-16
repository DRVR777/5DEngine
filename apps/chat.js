// apps/chat.js — text chat over the sidecar pubsub.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAChat = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "chat",
    name: "Chat",
    icon: "💬",
    category: "social",
    init: (opts) => ({
      messages: [],         // [{from, text, ts}]
      handle: opts.handle || "anon",
      room: opts.room || "global",
      sidecar: opts.sidecar || null,
      sidecarToken: opts.sidecarToken || null,
      _unsubscribe: null,
    }),
    render: (state) => {
      if (state.messages.length === 0) return `[${state.room}] (no messages)`;
      return state.messages.slice(-15).map(m => `${m.from}: ${m.text}`).join("\n");
    },
    handleInput: (state, evt) => {
      if (evt.type === "send" && evt.text) {
        const msg = { from: state.handle, text: evt.text, ts: Date.now() };
        if (state.sidecar && state.sidecarToken) {
          state.sidecar.pubsubPublish(state.sidecarToken, `chat/${state.room}`, msg);
        }
        return { ...state, messages: [...state.messages, msg] };
      }
      if (evt.type === "receive" && evt.message) {
        return { ...state, messages: [...state.messages, evt.message] };
      }
      if (evt.type === "set_room" && evt.room) {
        return { ...state, room: evt.room, messages: [] };
      }
      if (evt.type === "subscribe" && state.sidecar && state.sidecarToken) {
        const sub = state.sidecar.pubsubSubscribe(state.sidecarToken, `chat/${state.room}`,
          (m) => state.messages.push(m));
        return { ...state, _unsubscribe: sub.ok ? sub.unsubscribe : null };
      }
      return null;
    },
    ipc: () => null,
  };

  return { APP };
});
