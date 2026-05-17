// music_selector.js — per-world ambient music with crossfade + weather mod.
// Each world has a track palette. Selector picks based on current context
// (time-of-day, weather, combat) and crossfades between tracks.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMusicSelector = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CONTEXTS = ["day", "night", "rain", "storm", "combat", "menu"];

  function createSelector(opts) {
    opts = opts || {};
    const palettes = new Map();      // worldId → {context → [trackSrc, ...]}
    const audio = opts.audio || null;  // optional audio mixer from iter 46
    const crossfadeMs = opts.crossfadeMs || 2000;

    let currentTrack = null;        // {src, handle, startedAt}
    let nextTrack = null;            // during crossfade
    let crossfadeStart = 0;
    let currentWorld = null;
    let currentContext = null;

    // Palette: {day: [...], night: [...], rain: [...], ...}
    function setPalette(worldId, palette) {
      palettes.set(worldId, Object.assign({}, palette));
    }
    function getPalette(worldId) { return palettes.get(worldId) || null; }
    function listWorlds() { return Array.from(palettes.keys()); }

    // Decide context from inputs.
    function decideContext(opts2) {
      opts2 = opts2 || {};
      if (opts2.combat) return "combat";
      if (opts2.menu) return "menu";
      if (opts2.weather === "storm") return "storm";
      if (opts2.weather === "heavy_rain" || opts2.weather === "light_rain") return "rain";
      if (opts2.hour != null) {
        if (opts2.hour >= 7 && opts2.hour <= 19) return "day";
        return "night";
      }
      return "day";
    }

    // Pick a track from the palette for the given world+context. Returns
    // null if no palette/context defined.
    function pickTrack(worldId, context, rng) {
      const pal = palettes.get(worldId);
      if (!pal) return null;
      const tracks = pal[context];
      if (!tracks || tracks.length === 0) {
        // Fallback chain: combat→day, storm→rain→day, night→day
        const fallbacks = {
          combat: ["day"],
          storm: ["rain", "day"],
          rain: ["day"],
          night: ["day"],
          menu: ["day"],
        };
        for (const fb of (fallbacks[context] || [])) {
          const ftracks = pal[fb];
          if (ftracks && ftracks.length > 0) {
            return ftracks[Math.floor((rng || Math.random)() * ftracks.length)];
          }
        }
        return null;
      }
      return tracks[Math.floor((rng || Math.random)() * tracks.length)];
    }

    // Update: pick a track for this context, start crossfade if different.
    function update(worldId, contextOpts, rng) {
      const context = decideContext(contextOpts);
      const worldChanged = currentWorld !== worldId;
      const ctxChanged = currentContext !== context;
      // No-change if nothing changed AND we have something (current or queued) playing
      if (!worldChanged && !ctxChanged && (currentTrack || nextTrack)) return { changed: false };

      const newSrc = pickTrack(worldId, context, rng);
      if (!newSrc) {
        if (currentTrack && audio && audio.stop) audio.stop(currentTrack.handle);
        if (nextTrack && audio && audio.stop) audio.stop(nextTrack.handle);
        currentTrack = null; nextTrack = null;
        currentWorld = worldId; currentContext = context;
        return { changed: true, newTrack: null, context };
      }
      const playingSrc = currentTrack ? currentTrack.src : (nextTrack ? nextTrack.src : null);
      if (playingSrc === newSrc) {
        currentWorld = worldId; currentContext = context;
        return { changed: false };
      }
      // First-time start (no current, no queued): skip crossfade, just play at vol 1
      if (!currentTrack && !nextTrack) {
        const handle = audio && audio.play
          ? audio.play({ src: newSrc, route: "music", loop: true, volume: 1 })
          : { handle: `stub_${Date.now()}` };
        currentTrack = {
          src: newSrc,
          handle: handle.handle != null ? handle.handle : handle,
          startedAt: Date.now(),
        };
        currentWorld = worldId;
        currentContext = context;
        return { changed: true, newTrack: newSrc, context, crossfade: false };
      }
      // Start crossfade
      const newHandle = audio && audio.play
        ? audio.play({ src: newSrc, route: "music", loop: true, volume: 0 })
        : { handle: `stub_${Date.now()}` };
      nextTrack = {
        src: newSrc,
        handle: newHandle.handle != null ? newHandle.handle : newHandle,
        startedAt: Date.now(),
      };
      crossfadeStart = Date.now();
      currentWorld = worldId;
      currentContext = context;
      return { changed: true, newTrack: newSrc, context, crossfade: true };
    }

    // Tick the crossfade — interpolates volumes; finalizes after crossfadeMs.
    function tickCrossfade() {
      if (!nextTrack) return { mixing: false };
      const elapsed = Date.now() - crossfadeStart;
      const t = Math.min(1, elapsed / crossfadeMs);
      if (audio && audio.setVolume) {
        if (currentTrack) audio.setVolume(currentTrack.handle, 1 - t);
        audio.setVolume(nextTrack.handle, t);
      }
      if (t >= 1) {
        if (currentTrack && audio && audio.stop) audio.stop(currentTrack.handle);
        currentTrack = nextTrack;
        nextTrack = null;
        return { mixing: false, completed: true };
      }
      return { mixing: true, progress: t };
    }

    function getCurrentTrack() { return currentTrack ? currentTrack.src : null; }
    function getCurrentContext() { return currentContext; }
    function getCurrentWorld() { return currentWorld; }
    function isMixing() { return nextTrack !== null; }

    function stop() {
      if (currentTrack && audio && audio.stop) audio.stop(currentTrack.handle);
      if (nextTrack && audio && audio.stop) audio.stop(nextTrack.handle);
      currentTrack = null; nextTrack = null;
      currentContext = null; currentWorld = null;
    }

    return {
      CONTEXTS,
      setPalette, getPalette, listWorlds,
      decideContext, pickTrack, update, tickCrossfade,
      getCurrentTrack, getCurrentContext, getCurrentWorld, isMixing, stop,
    };
  }

  return { createSelector, CONTEXTS };
});
