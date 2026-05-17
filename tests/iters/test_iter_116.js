// test_iter_116.js — banking: deposit/withdraw + interest + loans + credit.
const B = require("./banking.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. deposit + balance
const sys = B.createSystem();
ok(sys.balance("alice", "coin") === 0, "initial 0");
ok(sys.deposit("alice", "coin", 100).ok, "deposit 100");
ok(sys.balance("alice", "coin") === 100, "balance 100");

// Bad deposit
ok(sys.deposit("alice", "coin", -1).ok === false, "neg amount");
ok(sys.deposit("alice", "coin", 0).ok === false, "zero");

// 2. withdraw
const w1 = sys.withdraw("alice", "coin", 30);
ok(w1.ok && w1.balance === 70, "withdraw 30 → 70");
ok(sys.withdraw("alice", "coin", 999).ok === false, "insufficient");
ok(sys.withdraw("ghost", "coin", 1).ok === false, "no account");

// 3. Multiple currencies independent
sys.deposit("alice", "gem", 5);
ok(sys.balance("alice", "gem") === 5, "gem 5");
ok(sys.balance("alice", "coin") === 70, "coin unchanged");

// 4. transfer
sys.deposit("bob", "coin", 0);   // create account
const t1 = sys.transfer("alice", "bob", "coin", 20);
ok(t1.ok && t1.fromBalance === 50, "from balance 50");
ok(sys.balance("bob", "coin") === 20, "bob got 20");

ok(sys.transfer("alice", "alice", "coin", 1).ok === false, "self transfer");
ok(sys.transfer("alice", "bob", "coin", 9999).ok === false, "insufficient transfer");

// 5. Savings interest
const sys2 = B.createSystem({ config: { savingsAPR: 0.365 } });   // 36.5% APR = 0.1% per day
sys2.deposit("p", "coin", 10000, { now: 0 });
sys2.tickInterest(86400 * 1000);   // 1 day later
// Daily rate = 0.365 / 365 = 0.001; 10000 * 0.001 = 10 interest
const bal2 = sys2.balance("p", "coin");
ok(bal2 > 10000 && bal2 < 10020, `interest applied (got ${bal2.toFixed(2)})`);

// Tick again same now → no double interest
sys2.tickInterest(86400 * 1000);
ok(Math.abs(sys2.balance("p", "coin") - bal2) < 0.001, "no double interest");

// 6. Credit score default
ok(sys.getCredit("alice") === 600, "default credit 600");

// 7. Apply loan — sufficient credit
const sys3 = B.createSystem({ config: { minCreditForLoan: 500, maxLoanToCreditScore: 10 } });
sys3.deposit("p", "coin", 0);
const loan1 = sys3.applyLoan("p", { amount: 1000, ccy: "coin", now: 0 });
ok(loan1.ok === true, "loan approved");
ok(sys3.balance("p", "coin") === 1000, "principal deposited");

// Exceeds max
const tooBig = sys3.applyLoan("p", { amount: 99999 });
ok(tooBig.ok === false && tooBig.reason === "exceeds_max", "too big rejected");

// Bad amount
ok(sys3.applyLoan("p", { amount: 0 }).ok === false, "0 amount");

// 8. Low credit can't borrow
const sys4 = B.createSystem({ config: { minCreditForLoan: 700, startingCredit: 500 } });
const denied = sys4.applyLoan("badcredit", { amount: 100 });
ok(denied.ok === false && denied.reason === "credit_too_low", "low credit denied");

// 9. Repay loan
const sys5 = B.createSystem();
sys5.deposit("p", "coin", 5000);
const ln = sys5.applyLoan("p", { amount: 1000, ccy: "coin", now: 0 });
// p now has 6000 coin
const r1 = sys5.repayLoan(ln.loanId, 500, { now: 1000 });
ok(r1.ok === true, "partial repay");
ok(sys5.balance("p", "coin") === 5500, "balance reduced");

// Pay off in full
const r2 = sys5.repayLoan(ln.loanId, 600, { now: 2000 });
ok(r2.paidOff === true, "paid off");
ok(r2.newCredit > 600, `credit boosted (got ${r2.newCredit})`);

// Repay after paid off
ok(sys5.repayLoan(ln.loanId, 100).ok === false, "can't repay paid loan");

// Insufficient funds
const sys6 = B.createSystem();
const ln6 = sys6.applyLoan("broke", { amount: 100 });
sys6.withdraw("broke", "coin", 100);   // drain account
ok(sys6.repayLoan(ln6.loanId, 50).ok === false, "broke can't repay");

// Repay missing
ok(sys5.repayLoan("ghost", 10).ok === false, "ghost loan");

// 10. Loan interest accrual
const sys7 = B.createSystem({ config: { defaultLoanAPR: 0.365 } });   // 0.1%/day
const ln7 = sys7.applyLoan("p", { amount: 10000, ccy: "coin", now: 0 });
sys7.tickLoans(86400 * 1000);
const loan7 = sys7.getLoan(ln7.loanId);
ok(loan7.balance > 10000 && loan7.balance < 10020, `loan grew with interest (${loan7.balance.toFixed(2)})`);

// 11. Missed payment → credit penalty
const sys8 = B.createSystem({ config: { gracePeriodMs: 100, defaultsAfterMissesN: 3 } });
const ln8 = sys8.applyLoan("p", { amount: 100, repaymentIntervalMs: 100, now: 0 });
sys8.tickLoans(500);   // past due + grace
const creditAfter1 = sys8.getCredit("p");
ok(creditAfter1 < 600, `credit dropped after miss (got ${creditAfter1})`);

// 12. Default after 3 misses
const sys9 = B.createSystem({ config: { gracePeriodMs: 100, defaultsAfterMissesN: 2 } });
const ln9 = sys9.applyLoan("p", { amount: 100, repaymentIntervalMs: 100, now: 0 });
sys9.tickLoans(500);
sys9.tickLoans(1000);   // 2nd miss
const loan9 = sys9.getLoan(ln9.loanId);
ok(loan9.status === "defaulted", `defaulted (status ${loan9.status})`);
ok(sys9.getCredit("p") < 500, "credit tanked");

// 13. Credit floor/ceiling
const sys10 = B.createSystem();
// Trigger many misses
for (let i = 0; i < 20; i++) {
  const ln = sys10.applyLoan("p" + i, { amount: 1 });
  // can't trigger many quickly; just verify clamp
}
sys10.deposit("clamp", "coin", 100);
// Manually adjust to test clamp by triggering defaults
const cl = sys10.applyLoan("clamp", { amount: 1, repaymentIntervalMs: 1, now: 0 });
// Force defaults
const sysC = B.createSystem({ config: { gracePeriodMs: 0, defaultsAfterMissesN: 100,
                                          creditOnMiss: -1000, startingCredit: 300 } });
const lnC = sysC.applyLoan("p", { amount: 1, repaymentIntervalMs: 1, now: 0 });
sysC.tickLoans(1000);
ok(sysC.getCredit("p") === 300, "credit floor at 300");

// 14. listLoans + getLoan
const sys11 = B.createSystem();
sys11.applyLoan("a", { amount: 100 });
sys11.applyLoan("a", { amount: 200 });
sys11.applyLoan("b", { amount: 50 });
ok(sys11.listLoans().length === 3, "3 total loans");
ok(sys11.listLoans("a").length === 2, "2 a loans");

// 15. getLoan
ok(sys11.getLoan("ghost") === null, "ghost loan null");

// 16. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "deposit"), "deposit event");

// 17. getConfig
ok(sys.getConfig().savingsAPR >= 0, "config");

// 18. Loan adds to credit on full repayment
const sys12 = B.createSystem({ config: { creditOnRepay: 20 } });
sys12.deposit("p", "coin", 10000);
const ln12 = sys12.applyLoan("p", { amount: 100 });
const r12 = sys12.repayLoan(ln12.loanId, 200);
ok(r12.paidOff && r12.newCredit === 620, `credit bumped 20 (got ${r12.newCredit})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
