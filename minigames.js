// minigames.js — pluggable mini-game framework.
// A mini-game is a state machine + render fn registered against this hub.
// They run in-game (e.g. on the in-game computer or at a board entity).
// Two reference games shipped: tic-tac-toe and a coin-flip dice game.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMinigames = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createHub() {
    const games = new Map();   // gameId → def
    const sessions = new Map(); // sessionId → { gameId, state, players:[...], status }
    let nextId = 1;

    function registerGame(def) {
      if (!def || !def.id) throw new Error("game must have id");
      if (games.has(def.id)) throw new Error(`game ${def.id} already registered`);
      games.set(def.id, def);
    }

    function listGames() { return Array.from(games.keys()); }
    function getGame(id) { return games.get(id) || null; }

    function startSession(gameId, players, opts) {
      const def = games.get(gameId);
      if (!def) return { ok: false, reason: "no_such_game" };
      if (def.minPlayers && players.length < def.minPlayers) {
        return { ok: false, reason: "too_few_players", need: def.minPlayers };
      }
      if (def.maxPlayers && players.length > def.maxPlayers) {
        return { ok: false, reason: "too_many_players", max: def.maxPlayers };
      }
      const sessionId = `s_${nextId++}`;
      const state = def.init(players, opts || {});
      sessions.set(sessionId, {
        gameId, state, players: players.slice(),
        status: "active",
        startedAt: Date.now(),
      });
      return { ok: true, sessionId };
    }

    function move(sessionId, playerId, action) {
      const sess = sessions.get(sessionId);
      if (!sess) return { ok: false, reason: "no_session" };
      if (sess.status !== "active") return { ok: false, reason: `session_${sess.status}` };
      if (!sess.players.includes(playerId)) return { ok: false, reason: "not_in_game" };
      const def = games.get(sess.gameId);
      const result = def.move(sess.state, playerId, action);
      if (!result || result.ok === false) {
        return { ok: false, reason: result ? result.reason : "rejected" };
      }
      sess.state = result.state;
      if (result.winner !== undefined) {
        sess.status = "finished";
        sess.winner = result.winner;
      }
      if (result.draw) {
        sess.status = "finished";
        sess.draw = true;
      }
      return { ok: true, state: sess.state, winner: result.winner, draw: result.draw };
    }

    function render(sessionId) {
      const sess = sessions.get(sessionId);
      if (!sess) return "(no session)";
      const def = games.get(sess.gameId);
      return def.render(sess.state, sess);
    }

    function getSession(sessionId) { return sessions.get(sessionId) || null; }
    function endSession(sessionId) {
      const sess = sessions.get(sessionId);
      if (!sess) return false;
      sess.status = "ended";
      sessions.delete(sessionId);
      return true;
    }

    return { registerGame, listGames, getGame, startSession, move, render, getSession, endSession };
  }

  // ===== Sample game 1: Tic-Tac-Toe =====
  const TIC_TAC_TOE = {
    id: "tic_tac_toe",
    name: "Tic-Tac-Toe",
    minPlayers: 2, maxPlayers: 2,
    init: (players) => ({
      board: [null, null, null, null, null, null, null, null, null],
      turn: players[0],
      symbols: { [players[0]]: "X", [players[1]]: "O" },
      players,
      moves: 0,
    }),
    move: (state, playerId, action) => {
      if (playerId !== state.turn) return { ok: false, reason: "not_your_turn" };
      const i = action.cell;
      if (typeof i !== "number" || i < 0 || i > 8) return { ok: false, reason: "bad_cell" };
      if (state.board[i] !== null) return { ok: false, reason: "occupied" };
      const sym = state.symbols[playerId];
      const newBoard = state.board.slice();
      newBoard[i] = sym;
      const newState = {
        ...state, board: newBoard, moves: state.moves + 1,
        turn: state.players[(state.players.indexOf(playerId) + 1) % state.players.length],
      };
      const w = TIC_TAC_TOE._winner(newBoard);
      if (w) {
        const winnerPid = state.players.find(p => state.symbols[p] === w);
        return { ok: true, state: newState, winner: winnerPid };
      }
      if (newState.moves >= 9) return { ok: true, state: newState, draw: true };
      return { ok: true, state: newState };
    },
    render: (state) => {
      const b = state.board.map(c => c || "·");
      return `${b[0]}|${b[1]}|${b[2]}\n${b[3]}|${b[4]}|${b[5]}\n${b[6]}|${b[7]}|${b[8]}\nTurn: ${state.turn} (${state.symbols[state.turn]})`;
    },
    _winner: (b) => {
      const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6],
      ];
      for (const [a, b1, c] of lines) {
        if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
      }
      return null;
    },
  };

  // ===== Sample game 2: Coin Flip =====
  const COIN_FLIP = {
    id: "coin_flip",
    name: "Coin Flip",
    minPlayers: 1, maxPlayers: 4,
    init: (players, opts) => ({
      players, scores: Object.fromEntries(players.map(p => [p, 0])),
      target: opts.target || 5,
      turn: players[0],
      lastFlip: null,
    }),
    move: (state, playerId, action) => {
      if (playerId !== state.turn) return { ok: false, reason: "not_your_turn" };
      if (action.type !== "call" || !["heads", "tails"].includes(action.guess)) {
        return { ok: false, reason: "bad_action" };
      }
      const result = (action.rng || Math.random)() < 0.5 ? "heads" : "tails";
      const newScores = { ...state.scores };
      if (result === action.guess) newScores[playerId]++;
      const nextTurn = state.players[(state.players.indexOf(playerId) + 1) % state.players.length];
      const newState = { ...state, scores: newScores, turn: nextTurn, lastFlip: result };
      // Check winner
      const winner = state.players.find(p => newScores[p] >= state.target);
      if (winner) return { ok: true, state: newState, winner };
      return { ok: true, state: newState };
    },
    render: (state) => {
      const sc = state.players.map(p => `${p}:${state.scores[p]}`).join(" ");
      return `Coin Flip · ${sc} · target ${state.target}\nLast: ${state.lastFlip || "—"}\nTurn: ${state.turn}`;
    },
  };

  return { createHub, TIC_TAC_TOE, COIN_FLIP };
});
