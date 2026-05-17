// test_iter_96.js — clans: registry, ranks, permissions, treasury.
const C = require("./clans.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Mock economy for treasury tests
function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    deposit: (p, c, a) => { bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a); return { ok: true }; },
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a); return { ok: true };
    },
    balance: (p, c) => bal.get(k(p,c)) || 0,
  };
}

// 1. createClan
const sys = C.createSystem();
const c1 = sys.createClan("alice", { name: "Sky Wolves", tag: "SW" });
ok(c1.ok === true, "create ok");
ok(c1.clan.founder === "alice", "founder");
ok(sys.memberRank(c1.id, "alice") === "leader", "founder is leader");
ok(sys.clanOf("alice") === c1.id, "playerClan mapping");

// Duplicates
ok(sys.createClan("alice", { name: "x" }).ok === false, "already in clan");
ok(sys.createClan("bob", {}).ok === false, "missing name");
ok(sys.createClan(null, { name: "x" }).ok === false, "missing founder");

// 2. invite + accept
const inv1 = sys.invitePlayer(c1.id, "alice", "bob");
ok(inv1.ok === true, "invite ok");
ok(sys.acceptInvite(c1.id, "bob").ok === true, "accept ok");
ok(sys.memberRank(c1.id, "bob") === "member", "bob is member");
ok(sys.clanOf("bob") === c1.id, "bob in clan");

// Accept missing invite
ok(sys.acceptInvite(c1.id, "ghost").ok === false, "no invite");

// 3. Already-member can't be re-invited
ok(sys.invitePlayer(c1.id, "alice", "bob").ok === false, "already member");

// 4. Decline invite
sys.invitePlayer(c1.id, "alice", "carol");
ok(sys.declineInvite(c1.id, "carol").ok === true, "decline ok");
ok(sys.clanOf("carol") === null, "carol not in clan");

// 5. Apply (closed)
ok(sys.apply(c1.id, "dave").ok === true, "dave applies");
ok(sys.apply(c1.id, "dave").ok === false, "duplicate app rejected");
ok(sys.acceptApplication(c1.id, "alice", "dave").ok === true, "alice accepts dave");
ok(sys.memberRank(c1.id, "dave") === "member", "dave is member");

// Reject application
sys.apply(c1.id, "eve");
ok(sys.rejectApplication(c1.id, "alice", "eve").ok === true, "reject ok");
ok(sys.rejectApplication(c1.id, "alice", "eve").ok === false, "no application");

// 6. Auto-accept apps
const sys2 = C.createSystem();
const c2 = sys2.createClan("leader", { name: "Open", settings: { autoAcceptApps: true } });
const aa = sys2.apply(c2.id, "newbie");
ok(aa.ok === true && aa.auto === true, "auto-accepted");
ok(sys2.memberRank(c2.id, "newbie") === "member", "newbie is member");

// 7. Permissions: member can't invite
const inv2 = sys.invitePlayer(c1.id, "bob", "frank");
ok(inv2.ok === false && inv2.reason === "no_permission", "member can't invite");

// Promote bob to officer
ok(sys.promote(c1.id, "alice", "bob", "officer").ok === true, "promote bob");
ok(sys.memberRank(c1.id, "bob") === "officer", "bob is officer");

// Officer can invite
ok(sys.invitePlayer(c1.id, "bob", "frank").ok === true, "officer invites");

// Promote above own rank fails
ok(sys.promote(c1.id, "bob", "dave", "leader").ok === false, "above-own-rank rejected");

// 8. Kick: officer kicks member but not other officers
sys.acceptInvite(c1.id, "frank");
ok(sys.kick(c1.id, "bob", "dave").ok === true, "officer kicks member");
ok(sys.clanOf("dave") === null, "dave gone");

// Kick founder fails
ok(sys.kick(c1.id, "bob", "alice").ok === false, "can't kick founder");

// Promote frank to officer then bob can't kick (equal rank)
sys.promote(c1.id, "alice", "frank", "officer");
ok(sys.kick(c1.id, "bob", "frank").ok === false, "can't kick equal rank");

// 9. leave
sys.invitePlayer(c1.id, "alice", "grace");
sys.acceptInvite(c1.id, "grace");
ok(sys.leave(c1.id, "grace").ok === true, "grace leaves");
ok(sys.clanOf("grace") === null, "grace gone");

// Founder can't leave (must transfer)
ok(sys.leave(c1.id, "alice").ok === false, "founder can't just leave");

// 10. transferLeadership
ok(sys.transferLeadership(c1.id, "alice", "bob").ok === true, "transfer to bob");
ok(sys.getClan(c1.id).founder === "bob", "bob is founder");
ok(sys.memberRank(c1.id, "bob") === "leader", "bob is leader");
ok(sys.memberRank(c1.id, "alice") === "officer", "alice demoted to officer");

// Only founder can transfer
ok(sys.transferLeadership(c1.id, "alice", "frank").ok === false, "non-founder can't transfer");

// 11. Treasury
const econ = mkEcon();
econ.deposit("alice", "coin", 1000);

// Member without deposit perm cannot deposit
// (frank is officer now, alice is officer)
const dep1 = sys.deposit(c1.id, "alice", "coin", 500, { economy: econ });
ok(dep1.ok === true, "officer deposits");
ok(econ.balance("alice", "coin") === 500, "withdrawn from alice");
ok(sys.treasury(c1.id).coin === 500, "treasury has 500");

// Bad amount
ok(sys.deposit(c1.id, "alice", "coin", -10).ok === false, "negative rejected");
ok(sys.deposit(c1.id, "alice", "coin", 0).ok === false, "zero rejected");

// Insufficient from player
const big = sys.deposit(c1.id, "alice", "coin", 99999, { economy: econ });
ok(big.ok === false && big.reason === "insufficient", "insufficient funds");

// Withdraw
const wd = sys.withdraw(c1.id, "bob", "coin", 100, { economy: econ });
ok(wd.ok === true, "leader withdraws");
ok(econ.balance("bob", "coin") === 100, "bob got 100");
ok(sys.treasury(c1.id).coin === 400, "treasury = 400");

// Insufficient treasury
ok(sys.withdraw(c1.id, "bob", "coin", 9999).ok === false, "treasury insufficient");

// Non-officer can't withdraw
sys.invitePlayer(c1.id, "bob", "henry");
sys.acceptInvite(c1.id, "henry");
ok(sys.withdraw(c1.id, "henry", "coin", 1).ok === false, "member can't withdraw");

// 12. hasPerm
ok(sys.hasPerm(c1.id, "bob", "disband") === true, "leader can disband");
ok(sys.hasPerm(c1.id, "henry", "disband") === false, "member can't");
ok(sys.hasPerm("ghost", "x", "y") === false, "ghost clan no perm");

// 13. Disband
ok(sys.disband(c1.id, "henry").ok === false, "member can't disband");
ok(sys.disband(c1.id, "bob").ok === true, "leader disbands");
ok(sys.getClan(c1.id) === null, "clan gone");
ok(sys.clanOf("bob") === null, "bob no longer in clan");
ok(sys.clanOf("henry") === null, "henry no longer in clan");

// 14. Max members
const sys3 = C.createSystem({ config: { maxMembers: 2 } });
const c3 = sys3.createClan("a", { name: "Small" });
sys3.invitePlayer(c3.id, "a", "b");
sys3.acceptInvite(c3.id, "b");
ok(sys3.invitePlayer(c3.id, "a", "c").ok === false, "max members enforced");

// 15. Custom ranks
const sys4 = C.createSystem();
const c4 = sys4.createClan("z", {
  name: "Custom",
  customRanks: {
    captain: { rank: 3, perms: ["invite", "kick"] },
    swabbie: { rank: 0, perms: [] },
  },
});
ok(c4.clan.ranks.captain !== undefined, "custom captain rank");
ok(c4.clan.ranks.captain.perms.has("invite"), "captain can invite");

// 16. Events
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "create"), "create event");
ok(ev.some(e => e.kind === "disband"), "disband event");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
