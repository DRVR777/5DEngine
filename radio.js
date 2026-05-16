// radio.js — in-game radio with curated playlists + context-aware
// genre shifts. Stations are named buckets of tracks; the active
// station drives playback. The "auto-DJ" picks the next track based
// on rules: location-tagged stations, mission-mood overrides, history-
// based no-repeat windows.
//
// Distinct from music_selector.js (iter 70) which picks per-context
// from a palette: this one drives a continuous playback queue with
// scheduling, crossfades, station presets, and listener tuning.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTARadio = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createRadio(opts) {
    opts = opts || {};
    const config = Object.assign({
      crossfadeMs: 2000,
      noRepeatWindow: 5,          // last N tracks won't replay
      autoAdvance: true,
    }, opts.config || {});

    const stations = new Map();      // stationId → {id, name, genre, tracks[], tags}
    const trackInfo = new Map();     // trackId → {id, duration, genre, mood, tags}
    let activeStationId = null;
    let nowPlaying = null;           // {trackId, startedAt, duration}
    const recentTrackIds = [];
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerTrack(track) {
      if (!track || !track.id) return { ok: false, reason: "missing_id" };
      if (trackInfo.has(track.id)) return { ok: false, reason: "duplicate" };
      trackInfo.set(track.id, {
        id: track.id,
        duration: track.duration || 180,    // seconds default 3min
        genre: track.genre || "ambient",
        mood: track.mood || "neutral",
        tags: (track.tags || []).slice(),
      });
      return { ok: true };
    }

    function createStation(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (stations.has(opts2.id)) return { ok: false, reason: "duplicate" };
      const station = {
        id: opts2.id,
        name: opts2.name || opts2.id,
        genre: opts2.genre || "mixed",
        tags: (opts2.tags || []).slice(),
        tracks: [],
      };
      for (const t of (opts2.tracks || [])) station.tracks.push(t);
      stations.set(opts2.id, station);
      _log("station_created", { id: opts2.id });
      return { ok: true };
    }

    function addTrackToStation(stationId, trackId) {
      const s = stations.get(stationId);
      if (!s) return { ok: false, reason: "no_station" };
      if (!trackInfo.has(trackId)) return { ok: false, reason: "no_track" };
      if (s.tracks.includes(trackId)) return { ok: false, reason: "already_in" };
      s.tracks.push(trackId);
      return { ok: true };
    }

    function tuneTo(stationId, opts2) {
      opts2 = opts2 || {};
      if (!stations.has(stationId)) return { ok: false, reason: "no_station" };
      if (activeStationId === stationId) return { ok: false, reason: "already_tuned" };
      const prev = activeStationId;
      activeStationId = stationId;
      _log("tune", { from: prev, to: stationId });
      if (opts2.autoplay !== false) return play(opts2);
      return { ok: true, station: stations.get(stationId) };
    }

    function play(opts2) {
      opts2 = opts2 || {};
      if (!activeStationId) return { ok: false, reason: "no_station" };
      const s = stations.get(activeStationId);
      if (!s || s.tracks.length === 0) return { ok: false, reason: "empty_station" };
      // Pick a track that's not in the no-repeat window
      const eligible = s.tracks.filter(t => !recentTrackIds.includes(t));
      const pool = eligible.length > 0 ? eligible : s.tracks;
      const trackId = opts2.trackId && pool.includes(opts2.trackId)
        ? opts2.trackId
        : pool[Math.floor((opts2.rng || Math.random)() * pool.length)];
      const info = trackInfo.get(trackId);
      nowPlaying = {
        trackId, station: activeStationId,
        startedAt: opts2.now != null ? opts2.now : Date.now(),
        duration: info.duration,
        crossfadingFrom: opts2.crossfadeFrom || null,
      };
      recentTrackIds.push(trackId);
      while (recentTrackIds.length > config.noRepeatWindow) recentTrackIds.shift();
      _log("play", { trackId, station: activeStationId });
      return { ok: true, nowPlaying };
    }

    function skip(opts2) {
      opts2 = opts2 || {};
      if (!nowPlaying) return { ok: false, reason: "nothing_playing" };
      const prevTrackId = nowPlaying.trackId;
      _log("skip", { from: prevTrackId });
      return play(Object.assign({}, opts2, { crossfadeFrom: prevTrackId }));
    }

    function tick(now) {
      now = now != null ? now : Date.now();
      if (!nowPlaying) return null;
      const elapsed = (now - nowPlaying.startedAt) / 1000;
      if (elapsed >= nowPlaying.duration) {
        if (config.autoAdvance) {
          const r = skip({ now });
          if (!r.ok || !nowPlaying) return null;
          const e2 = (now - nowPlaying.startedAt) / 1000;
          return { trackId: nowPlaying.trackId, elapsed: e2, remaining: nowPlaying.duration - e2 };
        }
        nowPlaying = null;
        _log("ended", {});
        return null;
      }
      return { trackId: nowPlaying.trackId, elapsed, remaining: nowPlaying.duration - elapsed };
    }

    // Context-aware station selection
    function suggestStationForContext(ctx) {
      ctx = ctx || {};
      let best = null, bestScore = -Infinity;
      for (const s of stations.values()) {
        let score = 0;
        if (ctx.locationTag && s.tags.includes(ctx.locationTag)) score += 10;
        if (ctx.missionMood && s.tags.includes(ctx.missionMood)) score += 15;
        if (ctx.genre && s.genre === ctx.genre) score += 5;
        if (s.id === activeStationId) score -= 1;     // prefer different
        if (score > bestScore) { bestScore = score; best = s; }
      }
      return best ? best.id : null;
    }

    function autoTuneByContext(ctx, opts2) {
      const suggested = suggestStationForContext(ctx);
      if (!suggested) return { ok: false, reason: "no_match" };
      if (suggested === activeStationId) return { ok: true, kept: true };
      return tuneTo(suggested, opts2);
    }

    function getNowPlaying() { return nowPlaying; }
    function getActiveStation() { return activeStationId ? stations.get(activeStationId) : null; }
    function listStations() { return Array.from(stations.values()); }
    function listTracks() { return Array.from(trackInfo.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function recentTracks() { return recentTrackIds.slice(); }
    function getConfig() { return Object.assign({}, config); }

    return {
      registerTrack, createStation, addTrackToStation,
      tuneTo, play, skip, tick,
      suggestStationForContext, autoTuneByContext,
      getNowPlaying, getActiveStation,
      listStations, listTracks, recentEvents, recentTracks,
      getConfig,
    };
  }

  return { createRadio };
});
