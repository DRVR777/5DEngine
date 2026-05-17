// clans.js — clan/crew registry with ranks, permissions, treasury.
// A clan = {id, name, founder, members:Map<playerId, {rank, joinedAt>}>,
// treasury:Map<ccy, amount>, applications:[], invites:[], settings}.
//
// Built-in ranks (rank value → permissions):
//   "leader"    (4): everything, including disband + promote-to-leader
//   "officer"   (3): invite, kick non-officers, withdraw treasury,
//                    edit clan settings, accept applications
//   "veteran"   (2): invite (subject to setting), deposit treasury
//   "member"    (1): deposit treasury, view roster
//   "recruit"   (0): view roster only
//
// Custom ranks can be added at clan creation.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAClans = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_RANKS = {
    leader:  { rank: 4, perms: new Set(["invite", "kick", "promote", "demote", "withdraw", "deposit", "settings", "disband", "accept_app", "reject_app"]) },
    officer: { rank: 3, perms: new Set(["invite", "kick", "promote", "demote", "withdraw", "deposit", "settings", "accept_app", "reject_app"]) },
    veteran: { rank: 2, perms: new Set(["invite", "deposit"]) },
    member:  { rank: 1, perms: new Set(["deposit"]) },
    recruit: { rank: 0, perms: new Set([]) },
  };

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxMembers: 50,
      maxClansPerPlayer: 1,
      defaultRank: "member",
    }, opts.config || {});

    const clans = new Map();
    const playerClan = new Map();   // playerId → clanId
    let nextClanId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _resolveRanks(extra) {
      const ranks = {};
      for (const [k, v] of Object.entries(DEFAULT_RANKS)) {
        ranks[k] = { rank: v.rank, perms: new Set(v.perms) };
      }
      if (extra) {
        for (const [name, def] of Object.entries(extra)) {
          ranks[name] = { rank: def.rank, perms: new Set(def.perms || []) };
        }
      }
      return ranks;
    }

    function createClan(founderId, opts2) {
      opts2 = opts2 || {};
      if (!founderId) return { ok: false, reason: "missing_founder" };
      if (playerClan.has(founderId)) return { ok: false, reason: "already_in_clan" };
      if (!opts2.name) return { ok: false, reason: "missing_name" };
      const id = opts2.id || ("clan_" + (nextClanId++));
      if (clans.has(id)) return { ok: false, reason: "duplicate_id" };
      const clan = {
        id, name: opts2.name, tag: opts2.tag || null,
        founder: founderId,
        members: new Map(),
        ranks: _resolveRanks(opts2.customRanks),
        treasury: new Map(),
        applications: [],
        invites: [],
        settings: Object.assign({
          public: false,
          autoAcceptApps: false,
          veteranCanInvite: true,
        }, opts2.settings || {}),
        createdAt: Date.now(),
      };
      clan.members.set(founderId, { rank: "leader", joinedAt: Date.now() });
      clans.set(id, clan);
      playerClan.set(founderId, id);
      _log("create", { id, founder: founderId });
      return { ok: true, id, clan };
    }

    function disband(clanId, byPlayerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, byPlayerId, "disband")) return { ok: false, reason: "no_permission" };
      for (const mid of c.members.keys()) playerClan.delete(mid);
      clans.delete(clanId);
      _log("disband", { clanId, by: byPlayerId });
      return { ok: true };
    }

    function _hasPerm(clan, playerId, perm) {
      const m = clan.members.get(playerId);
      if (!m) return false;
      const r = clan.ranks[m.rank];
      return r && r.perms.has(perm);
    }

    function _rankValue(clan, playerId) {
      const m = clan.members.get(playerId);
      if (!m) return -1;
      const r = clan.ranks[m.rank];
      return r ? r.rank : -1;
    }

    // Invite a player; they accept to join
    function invitePlayer(clanId, fromPlayerId, toPlayerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, fromPlayerId, "invite")) return { ok: false, reason: "no_permission" };
      if (c.members.has(toPlayerId)) return { ok: false, reason: "already_member" };
      if (playerClan.has(toPlayerId)) return { ok: false, reason: "in_other_clan" };
      if (c.members.size >= config.maxMembers) return { ok: false, reason: "full" };
      const inv = { id: "inv_" + (events.length + 1), to: toPlayerId, from: fromPlayerId, createdAt: Date.now() };
      c.invites.push(inv);
      _log("invite", { clanId, from: fromPlayerId, to: toPlayerId });
      return { ok: true, inviteId: inv.id };
    }

    function acceptInvite(clanId, playerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      const i = c.invites.findIndex(v => v.to === playerId);
      if (i < 0) return { ok: false, reason: "no_invite" };
      if (playerClan.has(playerId)) return { ok: false, reason: "in_other_clan" };
      if (c.members.size >= config.maxMembers) return { ok: false, reason: "full" };
      c.invites.splice(i, 1);
      c.members.set(playerId, { rank: config.defaultRank, joinedAt: Date.now() });
      playerClan.set(playerId, clanId);
      _log("joined", { clanId, playerId });
      return { ok: true };
    }

    function declineInvite(clanId, playerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      const i = c.invites.findIndex(v => v.to === playerId);
      if (i < 0) return { ok: false, reason: "no_invite" };
      c.invites.splice(i, 1);
      return { ok: true };
    }

    // Player-initiated application (open enrollment)
    function apply(clanId, playerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (playerClan.has(playerId)) return { ok: false, reason: "in_other_clan" };
      if (c.members.has(playerId)) return { ok: false, reason: "already_member" };
      if (c.applications.find(a => a.playerId === playerId)) return { ok: false, reason: "already_applied" };
      const app = { id: "app_" + (events.length + 1), playerId, ts: Date.now() };
      c.applications.push(app);
      if (c.settings.autoAcceptApps && c.members.size < config.maxMembers) {
        c.applications = c.applications.filter(a => a.playerId !== playerId);
        c.members.set(playerId, { rank: config.defaultRank, joinedAt: Date.now() });
        playerClan.set(playerId, clanId);
        _log("auto_accepted", { clanId, playerId });
        return { ok: true, auto: true };
      }
      _log("application", { clanId, playerId });
      return { ok: true, applicationId: app.id };
    }

    function acceptApplication(clanId, byPlayerId, applicantId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, byPlayerId, "accept_app")) return { ok: false, reason: "no_permission" };
      const i = c.applications.findIndex(a => a.playerId === applicantId);
      if (i < 0) return { ok: false, reason: "no_application" };
      if (c.members.size >= config.maxMembers) return { ok: false, reason: "full" };
      if (playerClan.has(applicantId)) return { ok: false, reason: "in_other_clan" };
      c.applications.splice(i, 1);
      c.members.set(applicantId, { rank: config.defaultRank, joinedAt: Date.now() });
      playerClan.set(applicantId, clanId);
      _log("accepted_app", { clanId, applicantId, by: byPlayerId });
      return { ok: true };
    }

    function rejectApplication(clanId, byPlayerId, applicantId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, byPlayerId, "reject_app")) return { ok: false, reason: "no_permission" };
      const before = c.applications.length;
      c.applications = c.applications.filter(a => a.playerId !== applicantId);
      if (before === c.applications.length) return { ok: false, reason: "no_application" };
      _log("rejected_app", { clanId, applicantId, by: byPlayerId });
      return { ok: true };
    }

    function kick(clanId, byPlayerId, targetId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, byPlayerId, "kick")) return { ok: false, reason: "no_permission" };
      if (targetId === c.founder) return { ok: false, reason: "cant_kick_founder" };
      if (!c.members.has(targetId)) return { ok: false, reason: "not_member" };
      if (_rankValue(c, targetId) >= _rankValue(c, byPlayerId)) {
        return { ok: false, reason: "rank_too_high" };
      }
      c.members.delete(targetId);
      playerClan.delete(targetId);
      _log("kick", { clanId, target: targetId, by: byPlayerId });
      return { ok: true };
    }

    function leave(clanId, playerId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!c.members.has(playerId)) return { ok: false, reason: "not_member" };
      if (playerId === c.founder) return { ok: false, reason: "founder_must_transfer" };
      c.members.delete(playerId);
      playerClan.delete(playerId);
      _log("leave", { clanId, playerId });
      return { ok: true };
    }

    function promote(clanId, byPlayerId, targetId, newRank) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, byPlayerId, "promote")) return { ok: false, reason: "no_permission" };
      if (!c.members.has(targetId)) return { ok: false, reason: "not_member" };
      if (!c.ranks[newRank]) return { ok: false, reason: "bad_rank" };
      // Can't promote above own rank
      const byVal = _rankValue(c, byPlayerId);
      if (c.ranks[newRank].rank >= byVal) {
        if (!(newRank === "leader" && byPlayerId === c.founder)) {
          return { ok: false, reason: "above_own_rank" };
        }
      }
      c.members.get(targetId).rank = newRank;
      _log("promote", { clanId, target: targetId, to: newRank });
      return { ok: true };
    }

    function transferLeadership(clanId, byPlayerId, newLeaderId) {
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (byPlayerId !== c.founder) return { ok: false, reason: "not_founder" };
      if (!c.members.has(newLeaderId)) return { ok: false, reason: "not_member" };
      c.founder = newLeaderId;
      c.members.get(newLeaderId).rank = "leader";
      c.members.get(byPlayerId).rank = "officer";
      _log("transfer", { clanId, from: byPlayerId, to: newLeaderId });
      return { ok: true };
    }

    // Treasury
    function deposit(clanId, playerId, ccy, amount, opts2) {
      opts2 = opts2 || {};
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, playerId, "deposit")) return { ok: false, reason: "no_permission" };
      if (typeof amount !== "number" || amount <= 0) return { ok: false, reason: "bad_amount" };
      if (opts2.economy && opts2.economy.withdraw) {
        const w = opts2.economy.withdraw(playerId, ccy, amount);
        if (!w.ok) return { ok: false, reason: "insufficient" };
      }
      c.treasury.set(ccy, (c.treasury.get(ccy) || 0) + amount);
      _log("deposit", { clanId, playerId, ccy, amount });
      return { ok: true, balance: c.treasury.get(ccy) };
    }

    function withdraw(clanId, playerId, ccy, amount, opts2) {
      opts2 = opts2 || {};
      const c = clans.get(clanId);
      if (!c) return { ok: false, reason: "missing" };
      if (!_hasPerm(c, playerId, "withdraw")) return { ok: false, reason: "no_permission" };
      if (typeof amount !== "number" || amount <= 0) return { ok: false, reason: "bad_amount" };
      const cur = c.treasury.get(ccy) || 0;
      if (cur < amount) return { ok: false, reason: "insufficient" };
      c.treasury.set(ccy, cur - amount);
      if (opts2.economy && opts2.economy.deposit) opts2.economy.deposit(playerId, ccy, amount);
      _log("withdraw", { clanId, playerId, ccy, amount });
      return { ok: true, balance: c.treasury.get(ccy) };
    }

    function treasury(clanId) {
      const c = clans.get(clanId);
      if (!c) return null;
      return Object.fromEntries(c.treasury);
    }

    function getClan(clanId) { return clans.get(clanId) || null; }
    function listClans() { return Array.from(clans.values()); }
    function clanOf(playerId) { return playerClan.get(playerId) || null; }
    function memberRank(clanId, playerId) {
      const c = clans.get(clanId);
      if (!c) return null;
      const m = c.members.get(playerId);
      return m ? m.rank : null;
    }
    function hasPerm(clanId, playerId, perm) {
      const c = clans.get(clanId);
      return c ? _hasPerm(c, playerId, perm) : false;
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      DEFAULT_RANKS,
      createClan, disband,
      invitePlayer, acceptInvite, declineInvite,
      apply, acceptApplication, rejectApplication,
      kick, leave, promote, transferLeadership,
      deposit, withdraw, treasury,
      getClan, listClans, clanOf, memberRank, hasPerm,
      recentEvents,
    };
  }

  return { DEFAULT_RANKS, createSystem };
});
