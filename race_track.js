// race_track.js — lap timing + checkpoints + ghost cars + leaderboard.
// A track defines waypoint checkpoints in order. A race instance
// tracks each entrant's checkpoint progress + lap times. Ghost cars
// replay a saved fastest run as a transparent overlay.
//
// Flow:
//   defineTrack({id, checkpoints[]}) → track ready
//   startRace({trackId, racers[], laps}) → race id
//   updatePosition(raceId, racerId, pos) → checks crossing
//   tick(raceId, dt) — bookkeeping
//   finishRace → leaderboard entries
//
// Ghost lap = sequence of {dt, pos} captured during fastest lap; can
// be replayed via ghostStep(raceId, racerId, dt).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTARaceTrack = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      checkpointRadius: 5,
      ghostSampleEveryMs: 100,
      defaultLaps: 3,
    }, opts.config || {});

    const tracks = new Map();
    const races = new Map();
    const ghosts = new Map();     // trackId+racerId → recorded fastest lap
    let nextRaceId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function defineTrack(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (tracks.has(opts2.id)) return { ok: false, reason: "duplicate" };
      if (!Array.isArray(opts2.checkpoints) || opts2.checkpoints.length < 2) {
        return { ok: false, reason: "needs_2_checkpoints" };
      }
      tracks.set(opts2.id, {
        id: opts2.id,
        name: opts2.name || opts2.id,
        checkpoints: opts2.checkpoints.slice(),
        checkpointRadius: opts2.checkpointRadius || config.checkpointRadius,
      });
      _log("track", { id: opts2.id, cps: opts2.checkpoints.length });
      return { ok: true };
    }

    function getTrack(id) { return tracks.get(id) || null; }
    function listTracks() { return Array.from(tracks.values()); }

    function startRace(opts2) {
      opts2 = opts2 || {};
      const track = tracks.get(opts2.trackId);
      if (!track) return { ok: false, reason: "no_track" };
      if (!Array.isArray(opts2.racers) || opts2.racers.length === 0) {
        return { ok: false, reason: "no_racers" };
      }
      const id = "race_" + (nextRaceId++);
      const now = opts2.now != null ? opts2.now : Date.now();
      const race = {
        id, trackId: opts2.trackId,
        laps: opts2.laps || config.defaultLaps,
        startedAt: now,
        status: "active",
        racers: new Map(),
        leaderboard: [],
      };
      for (const r of opts2.racers) {
        race.racers.set(r, {
          id: r,
          currentLap: 1,
          currentCheckpoint: 0,
          lapStartTs: now,
          lapTimes: [],
          bestLapMs: Infinity,
          recordingLap: [],
          recordingStart: now,
          finished: false,
          finishedAt: 0,
          totalTimeMs: 0,
        });
      }
      races.set(id, race);
      _log("start_race", { id, trackId: opts2.trackId, racers: opts2.racers.length });
      return { ok: true, raceId: id };
    }

    function _crossCheckpoint(race, racer, now) {
      racer.currentCheckpoint++;
      const track = tracks.get(race.trackId);
      const total = track.checkpoints.length;
      if (racer.currentCheckpoint >= total) {
        // Lap complete
        const lapMs = now - racer.lapStartTs;
        racer.lapTimes.push(lapMs);
        const isBest = lapMs < racer.bestLapMs;
        if (isBest) {
          racer.bestLapMs = lapMs;
          // Save as ghost
          ghosts.set(race.trackId + "::" + racer.id, racer.recordingLap.slice());
        }
        racer.recordingLap = [];
        racer.lapStartTs = now;
        racer.currentLap++;
        racer.currentCheckpoint = 0;
        _log("lap", { raceId: race.id, racerId: racer.id, lapMs, bestLap: racer.bestLapMs });
        if (racer.currentLap > race.laps) {
          racer.finished = true;
          racer.finishedAt = now;
          racer.totalTimeMs = now - race.startedAt;
          race.leaderboard.push({
            racerId: racer.id,
            totalTimeMs: racer.totalTimeMs,
            bestLapMs: racer.bestLapMs,
            lapTimes: racer.lapTimes.slice(),
          });
          _log("finished", { raceId: race.id, racerId: racer.id, totalTimeMs: racer.totalTimeMs });
          // Race ends when all racers finished
          if (Array.from(race.racers.values()).every(r => r.finished)) {
            race.status = "completed";
            race.leaderboard.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
            _log("race_completed", { raceId: race.id });
          }
        }
      }
    }

    // Caller drives position updates; we check checkpoint crossings.
    function updatePosition(raceId, racerId, pos, opts2) {
      opts2 = opts2 || {};
      const race = races.get(raceId);
      if (!race) return { ok: false, reason: "no_race" };
      if (race.status !== "active") return { ok: false, reason: "not_active" };
      const racer = race.racers.get(racerId);
      if (!racer) return { ok: false, reason: "no_racer" };
      if (racer.finished) return { ok: true, finished: true };
      const now = opts2.now != null ? opts2.now : Date.now();
      // Record sample for ghost
      const lapElapsed = now - racer.lapStartTs;
      if (racer.recordingLap.length === 0 ||
          lapElapsed - (racer.recordingLap[racer.recordingLap.length - 1].dt || 0) >= config.ghostSampleEveryMs) {
        racer.recordingLap.push({ dt: lapElapsed, pos: { u: pos.u, v: pos.v } });
      }
      // Check next checkpoint
      const track = tracks.get(race.trackId);
      const cp = track.checkpoints[racer.currentCheckpoint];
      if (_dist(pos, cp) <= track.checkpointRadius) {
        _crossCheckpoint(race, racer, now);
      }
      return { ok: true, lap: racer.currentLap, cp: racer.currentCheckpoint };
    }

    function abortRace(raceId) {
      const race = races.get(raceId);
      if (!race) return { ok: false };
      if (race.status !== "active") return { ok: false, reason: "not_active" };
      race.status = "aborted";
      _log("aborted", { raceId });
      return { ok: true };
    }

    function getRace(id) { return races.get(id) || null; }
    function getRacerProgress(raceId, racerId) {
      const race = races.get(raceId);
      if (!race) return null;
      return race.racers.get(racerId) || null;
    }

    function leaderboard(raceId) {
      const race = races.get(raceId);
      return race ? race.leaderboard.slice() : null;
    }

    // Ghost: replay the fastest lap for a racer on a track
    function getGhost(trackId, racerId) {
      return ghosts.get(trackId + "::" + racerId) || null;
    }

    function ghostPositionAt(trackId, racerId, dt) {
      const ghost = ghosts.get(trackId + "::" + racerId);
      if (!ghost || ghost.length === 0) return null;
      // Find segment around dt
      for (let i = 0; i < ghost.length - 1; i++) {
        if (dt >= ghost[i].dt && dt <= ghost[i + 1].dt) {
          const span = ghost[i + 1].dt - ghost[i].dt;
          const t = span > 0 ? (dt - ghost[i].dt) / span : 0;
          return {
            u: ghost[i].pos.u + (ghost[i + 1].pos.u - ghost[i].pos.u) * t,
            v: ghost[i].pos.v + (ghost[i + 1].pos.v - ghost[i].pos.v) * t,
          };
        }
      }
      if (dt < ghost[0].dt) return ghost[0].pos;
      return ghost[ghost.length - 1].pos;
    }

    function clearGhost(trackId, racerId) {
      return ghosts.delete(trackId + "::" + racerId);
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      defineTrack, getTrack, listTracks,
      startRace, updatePosition, abortRace,
      getRace, getRacerProgress, leaderboard,
      getGhost, ghostPositionAt, clearGhost,
      recentEvents, getConfig,
    };
  }

  return { createSystem };
});
