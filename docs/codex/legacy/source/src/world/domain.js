// domain.js — domain authority + handoff per
// DECENTRALIZED_GAME_SERVER_NETWORKING_STRATEGY.md.
//
// Each spatial sector has exactly one authoritative node (domain_id).
// When a player crosses a sector boundary, the protocol fires:
//   DOMAIN_HINT  → "you might be entering my sector"
//   HANDOFF_PREPARE → "I'll take authority on tick T"
//   HANDOFF_COMMIT  → "you're mine now; old owner releases"
// Dual-connect during transition replaces loading screens.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADomain = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Sector grid: world divided into N×N cells of size cellSize.
  function createSectorGrid(cellSize) {
    cellSize = cellSize || 200;
    const sectors = new Map();    // "sx,sy" → { sectorId, ownerNodeId, replicas:Set }

    function key(sx, sy) { return `${sx},${sy}`; }
    function sectorOfPos(pos) {
      return { sx: Math.floor(pos.u / cellSize), sy: Math.floor(pos.v / cellSize) };
    }
    function ensureSector(sx, sy) {
      const k = key(sx, sy);
      if (!sectors.has(k)) {
        sectors.set(k, { sectorId: k, sx, sy, ownerNodeId: null, replicas: new Set() });
      }
      return sectors.get(k);
    }
    function claimSector(sx, sy, nodeId) {
      const s = ensureSector(sx, sy);
      if (s.ownerNodeId && s.ownerNodeId !== nodeId) return { ok: false, reason: "owned_by_other", by: s.ownerNodeId };
      s.ownerNodeId = nodeId;
      s.replicas.delete(nodeId);
      return { ok: true, sector: s };
    }
    function addReplica(sx, sy, nodeId) {
      const s = ensureSector(sx, sy);
      if (s.ownerNodeId === nodeId) return false;
      s.replicas.add(nodeId);
      return true;
    }
    function getOwner(pos) {
      const { sx, sy } = sectorOfPos(pos);
      const s = sectors.get(key(sx, sy));
      return s ? s.ownerNodeId : null;
    }

    return {
      cellSize,
      sectors,
      sectorOfPos, ensureSector, claimSector, addReplica, getOwner, key,
    };
  }

  // Handoff state machine. One per (player, target sector).
  function createHandoff(grid, opts) {
    opts = opts || {};
    const transfers = new Map();   // "playerId__sectorKey" → state

    function transferKey(playerId, sx, sy) { return `${playerId}__${sx},${sy}`; }

    // Step 1: DOMAIN_HINT — when current owner notices the player approaching
    // the boundary of an adjacent sector.
    function hint(playerId, currentPos, neighborOwnerId) {
      const { sx, sy } = grid.sectorOfPos(currentPos);
      // Detect approaching neighbor sector: which side of the cell is the
      // player closer to? Use simple in-cell offset.
      const cu = currentPos.u - sx * grid.cellSize;
      const cv = currentPos.v - sy * grid.cellSize;
      // Closeness threshold = 20% of cell
      const margin = grid.cellSize * 0.2;
      const targets = [];
      if (cu < margin)              targets.push({ sx: sx - 1, sy });
      if (cu > grid.cellSize - margin) targets.push({ sx: sx + 1, sy });
      if (cv < margin)              targets.push({ sx, sy: sy - 1 });
      if (cv > grid.cellSize - margin) targets.push({ sx, sy: sy + 1 });

      const hints = [];
      for (const t of targets) {
        const k = transferKey(playerId, t.sx, t.sy);
        if (!transfers.has(k)) {
          transfers.set(k, {
            playerId, targetSx: t.sx, targetSy: t.sy,
            state: "HINT", since: Date.now(),
            currentOwner: grid.getOwner(currentPos),
            neighborOwner: neighborOwnerId,
          });
          hints.push(transfers.get(k));
        }
      }
      return hints;
    }

    // Step 2: HANDOFF_PREPARE — neighbor owner signals "I'll take auth at tick T"
    function prepare(playerId, sx, sy, takeoverTick) {
      const k = transferKey(playerId, sx, sy);
      const t = transfers.get(k);
      if (!t || t.state !== "HINT") return { ok: false, reason: "no_hint" };
      t.state = "PREPARE";
      t.takeoverTick = takeoverTick;
      return { ok: true, transfer: t };
    }

    // Step 3: HANDOFF_COMMIT — actually move authority
    function commit(playerId, sx, sy, newOwnerId) {
      const k = transferKey(playerId, sx, sy);
      const t = transfers.get(k);
      if (!t || t.state !== "PREPARE") return { ok: false, reason: "not_prepared" };
      const claim = grid.claimSector(sx, sy, newOwnerId);
      if (!claim.ok) return claim;
      t.state = "COMMIT";
      t.committedOwner = newOwnerId;
      // Old owner becomes a replica during dual-connect window
      if (t.currentOwner && t.currentOwner !== newOwnerId) {
        grid.addReplica(sx, sy, t.currentOwner);
      }
      return { ok: true, transfer: t };
    }

    function status(playerId, sx, sy) {
      const t = transfers.get(transferKey(playerId, sx, sy));
      return t ? t.state : null;
    }

    function clear(playerId, sx, sy) {
      transfers.delete(transferKey(playerId, sx, sy));
    }

    return { transfers, hint, prepare, commit, status, clear };
  }

  return { createSectorGrid, createHandoff };
});
