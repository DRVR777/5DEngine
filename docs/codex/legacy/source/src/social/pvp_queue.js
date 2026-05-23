// pvp_queue.js — PvP matchmaking queue + lobby formation + map vote.
// Players queue with (skillRating, region, preferredMode); ticker
// pairs/groups them when their wait time + skill spread converge.
// Once N players collect, a lobby forms and runs a map-vote.
//
// Skill matching: starts strict (±50 rating), widens by widenPerSec
// rating-units per second of waiting time. Region matched first;
// after a fallback timeout, cross-region matches allowed.
//
// Modes: "1v1" (2 players), "2v2" (4), "5v5" (10), "ffa_8" (8).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPvPQueue = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MODES = {
    "1v1":    { teams: 2, perTeam: 1 },
    "2v2":    { teams: 2, perTeam: 2 },
    "5v5":    { teams: 2, perTeam: 5 },
    "ffa_8":  { teams: 8, perTeam: 1 },
  };

  function createQueue(opts) {
    opts = opts || {};
    const config = Object.assign({
      initialSkillSpread: 50,
      widenPerSec: 10,
      crossRegionAfterMs: 30 * 1000,
      maxLobbies: 100,
      voteWindowMs: 15 * 1000,
    }, opts.config || {});

    const tickets = new Map();     // ticketId → {playerId, mode, region, skill, queuedAt, status}
    const lobbies = new Map();     // lobbyId → lobby
    let nextTicketId = 1;
    let nextLobbyId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function enqueue(opts2) {
      opts2 = opts2 || {};
      if (!opts2.playerId || !opts2.mode || !MODES[opts2.mode]) {
        return { ok: false, reason: "bad_request" };
      }
      if (typeof opts2.skill !== "number") {
        return { ok: false, reason: "bad_skill" };
      }
      // Player can only have one active ticket
      for (const t of tickets.values()) {
        if (t.status === "queued" && t.playerId === opts2.playerId) {
          return { ok: false, reason: "already_queued" };
        }
      }
      const id = "ticket_" + (nextTicketId++);
      const ticket = {
        id, playerId: opts2.playerId,
        mode: opts2.mode,
        region: opts2.region || "global",
        skill: opts2.skill,
        queuedAt: opts2.ts != null ? opts2.ts : Date.now(),
        status: "queued",
        preferredMaps: opts2.preferredMaps || [],
      };
      tickets.set(id, ticket);
      _log("enqueue", { id, mode: ticket.mode });
      return { ok: true, ticketId: id };
    }

    function cancel(ticketId, playerId) {
      const t = tickets.get(ticketId);
      if (!t) return { ok: false, reason: "missing" };
      if (t.playerId !== playerId) return { ok: false, reason: "not_owner" };
      if (t.status !== "queued") return { ok: false, reason: "not_queued" };
      t.status = "cancelled";
      _log("cancel", { id: ticketId });
      return { ok: true };
    }

    function _eligible(t, now) {
      if (t.status !== "queued") return false;
      return true;
    }

    function _spread(t, now) {
      const waitMs = now - t.queuedAt;
      return config.initialSkillSpread + (waitMs / 1000) * config.widenPerSec;
    }

    // Find a group of N tickets that are mutually compatible
    function _tryFormGroup(modeTickets, mode, now) {
      const required = MODES[mode].teams * MODES[mode].perTeam;
      if (modeTickets.length < required) return null;
      // Greedy: sort by queue time (longest waiting first) to be fair
      const sorted = modeTickets.slice().sort((a, b) => a.queuedAt - b.queuedAt);
      // Try anchoring on each ticket as a "host" and pulling in the closest ones
      for (const host of sorted) {
        const hostSpread = _spread(host, now);
        const candidates = sorted.filter(t => {
          if (t.id === host.id) return false;
          const tSpread = _spread(t, now);
          const allowSpread = Math.min(hostSpread, tSpread);
          if (Math.abs(t.skill - host.skill) > allowSpread) return false;
          if (t.region !== host.region && now - t.queuedAt < config.crossRegionAfterMs) {
            return false;
          }
          return true;
        });
        if (candidates.length + 1 >= required) {
          // Take the closest-skill candidates
          const pick = candidates
            .map(c => ({ t: c, dist: Math.abs(c.skill - host.skill) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, required - 1)
            .map(x => x.t);
          return [host].concat(pick);
        }
      }
      return null;
    }

    function _formLobby(group, mode, now) {
      if (lobbies.size >= config.maxLobbies) return null;
      const lobbyId = "lobby_" + (nextLobbyId++);
      const teams = [];
      const perTeam = MODES[mode].perTeam;
      const nTeams = MODES[mode].teams;
      // Snake-draft to balance: sort group by skill desc, alternate
      const sorted = group.slice().sort((a, b) => b.skill - a.skill);
      for (let i = 0; i < nTeams; i++) teams.push([]);
      for (let i = 0; i < sorted.length; i++) {
        const teamIdx = i % nTeams;
        teams[teamIdx].push(sorted[i].playerId);
      }
      // Mark tickets as matched
      for (const t of group) t.status = "matched";
      const mapVotes = {};
      const candidateMaps = _collectMaps(group);
      const lobby = {
        id: lobbyId, mode, teams,
        members: group.map(t => t.playerId),
        candidateMaps,
        votes: mapVotes,
        formedAt: now,
        voteDeadline: now + config.voteWindowMs,
        chosenMap: null,
        state: "voting",
      };
      lobbies.set(lobbyId, lobby);
      _log("form", { lobbyId, mode, members: lobby.members });
      return lobby;
    }

    function _collectMaps(group) {
      const counts = new Map();
      for (const t of group) {
        for (const m of (t.preferredMaps || [])) {
          counts.set(m, (counts.get(m) || 0) + 1);
        }
      }
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      // Top 4 maps as vote candidates; if none, default
      if (sorted.length === 0) return ["arena_a", "arena_b", "arena_c"];
      return sorted.slice(0, 4).map(([m]) => m);
    }

    // Ticker — call periodically; tries to form lobbies from queued tickets
    function tick(now) {
      now = now != null ? now : Date.now();
      const formed = [];
      const byMode = new Map();
      for (const t of tickets.values()) {
        if (!_eligible(t, now)) continue;
        if (!byMode.has(t.mode)) byMode.set(t.mode, []);
        byMode.get(t.mode).push(t);
      }
      for (const [mode, modeTickets] of byMode) {
        let group;
        while ((group = _tryFormGroup(modeTickets, mode, now)) != null) {
          const lobby = _formLobby(group, mode, now);
          if (!lobby) break;
          formed.push(lobby);
          // Remove from local list before next pass
          for (const t of group) {
            const idx = modeTickets.indexOf(t);
            if (idx >= 0) modeTickets.splice(idx, 1);
          }
        }
      }
      // Expire vote-window in lobbies
      for (const l of lobbies.values()) {
        if (l.state === "voting" && now > l.voteDeadline) {
          _finalizeMap(l);
        }
      }
      return formed;
    }

    function voteMap(lobbyId, playerId, mapName) {
      const l = lobbies.get(lobbyId);
      if (!l) return { ok: false, reason: "missing" };
      if (l.state !== "voting") return { ok: false, reason: "not_voting" };
      if (!l.members.includes(playerId)) return { ok: false, reason: "not_in_lobby" };
      if (!l.candidateMaps.includes(mapName)) return { ok: false, reason: "bad_map" };
      l.votes[playerId] = mapName;
      _log("vote", { lobbyId, playerId, mapName });
      // If all voted, finalize
      if (Object.keys(l.votes).length === l.members.length) _finalizeMap(l);
      return { ok: true };
    }

    function _finalizeMap(lobby) {
      const counts = {};
      for (const m of Object.values(lobby.votes)) counts[m] = (counts[m] || 0) + 1;
      let winner = lobby.candidateMaps[0];
      let max = -1;
      for (const m of lobby.candidateMaps) {
        const c = counts[m] || 0;
        if (c > max) { max = c; winner = m; }
      }
      lobby.chosenMap = winner;
      lobby.state = "ready";
      _log("map_chosen", { lobbyId: lobby.id, map: winner });
    }

    function getLobby(id) { return lobbies.get(id) || null; }
    function listLobbies() { return Array.from(lobbies.values()); }
    function listQueue(mode) {
      const out = [];
      for (const t of tickets.values()) {
        if (t.status === "queued" && (!mode || t.mode === mode)) out.push(t);
      }
      return out;
    }
    function listTickets() { return Array.from(tickets.values()); }

    function startMatch(lobbyId) {
      const l = lobbies.get(lobbyId);
      if (!l) return { ok: false, reason: "missing" };
      if (l.state !== "ready") return { ok: false, reason: "not_ready" };
      l.state = "in_match";
      _log("start_match", { lobbyId });
      return { ok: true, lobby: l };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      MODES,
      enqueue, cancel, tick,
      voteMap, startMatch,
      getLobby, listLobbies, listQueue, listTickets,
      recentEvents,
    };
  }

  return { MODES, createQueue };
});
