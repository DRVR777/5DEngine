// banking.js — savings + loans + interest accrual + credit score.
// Per-player accounts hold a balance per currency. Interest accrues
// per second (caller drives tick). Loans require credit-score check;
// missed repayments tank credit. Defaults drop credit below pay-back
// threshold and lock further borrowing.
//
// Credit score 300..850 (FICO-like). Starts at 600. +5 on full
// repayment, -50 on missed payment, -200 on default.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTABanking = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      savingsAPR: 0.02,            // 2% APR
      defaultLoanAPR: 0.10,        // 10% APR
      maxLoanToCreditScore: 100,   // max loan = credit * 100
      minCreditForLoan: 500,
      gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
      defaultsAfterMissesN: 3,
      creditOnRepay: 5,
      creditOnMiss: -50,
      creditOnDefault: -200,
      startingCredit: 600,
    }, opts.config || {});

    const accounts = new Map();    // playerId → {balances:Map<ccy, n>, lastInterestTs}
    const loans = new Map();       // loanId → {playerId, principal, ccy, apr, balance, missedPayments, status, startTs, lastPaymentTs}
    const credit = new Map();      // playerId → score
    let nextLoanId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensureAccount(playerId, now) {
      if (!accounts.has(playerId)) {
        accounts.set(playerId, {
          id: playerId,
          balances: new Map(),
          lastInterestTs: now != null ? now : Date.now(),
        });
      }
      return accounts.get(playerId);
    }

    function _getCredit(playerId) {
      if (!credit.has(playerId)) credit.set(playerId, config.startingCredit);
      return credit.get(playerId);
    }
    function _setCredit(playerId, score) {
      credit.set(playerId, _clamp(score, 300, 850));
    }
    function _adjustCredit(playerId, delta) {
      _setCredit(playerId, _getCredit(playerId) + delta);
    }

    function getCredit(playerId) { return _getCredit(playerId); }
    function balance(playerId, ccy) {
      const a = accounts.get(playerId);
      if (!a) return 0;
      return a.balances.get(ccy) || 0;
    }

    function deposit(playerId, ccy, amount, opts2) {
      opts2 = opts2 || {};
      if (typeof amount !== "number" || amount <= 0) return { ok: false, reason: "bad_amount" };
      const now = opts2.now != null ? opts2.now : Date.now();
      const a = _ensureAccount(playerId, now);
      a.balances.set(ccy, (a.balances.get(ccy) || 0) + amount);
      _log("deposit", { playerId, ccy, amount });
      return { ok: true, balance: a.balances.get(ccy) };
    }

    function withdraw(playerId, ccy, amount, opts2) {
      opts2 = opts2 || {};
      if (typeof amount !== "number" || amount <= 0) return { ok: false, reason: "bad_amount" };
      const a = accounts.get(playerId);
      if (!a) return { ok: false, reason: "no_account" };
      const cur = a.balances.get(ccy) || 0;
      if (cur < amount) return { ok: false, reason: "insufficient" };
      a.balances.set(ccy, cur - amount);
      _log("withdraw", { playerId, ccy, amount });
      return { ok: true, balance: a.balances.get(ccy) };
    }

    // Apply savings interest to all accounts based on time elapsed
    function tickInterest(now) {
      now = now != null ? now : Date.now();
      const ratePerSec = config.savingsAPR / (365 * 24 * 3600);
      for (const a of accounts.values()) {
        const elapsedS = (now - a.lastInterestTs) / 1000;
        if (elapsedS <= 0) continue;
        for (const [ccy, amt] of a.balances) {
          if (amt <= 0) continue;
          const interest = amt * ratePerSec * elapsedS;
          a.balances.set(ccy, amt + interest);
        }
        a.lastInterestTs = now;
      }
    }

    // Apply for a loan
    function applyLoan(playerId, opts2) {
      opts2 = opts2 || {};
      const score = _getCredit(playerId);
      if (score < config.minCreditForLoan) {
        return { ok: false, reason: "credit_too_low", score };
      }
      if (typeof opts2.amount !== "number" || opts2.amount <= 0) {
        return { ok: false, reason: "bad_amount" };
      }
      const maxLoan = score * config.maxLoanToCreditScore;
      if (opts2.amount > maxLoan) {
        return { ok: false, reason: "exceeds_max", maxLoan };
      }
      const now = opts2.now != null ? opts2.now : Date.now();
      const id = "loan_" + (nextLoanId++);
      const loan = {
        id, playerId,
        principal: opts2.amount,
        ccy: opts2.ccy || "coin",
        apr: opts2.apr || config.defaultLoanAPR,
        balance: opts2.amount,
        missedPayments: 0,
        status: "active",
        startTs: now,
        lastPaymentTs: now,
        nextDueTs: now + (opts2.repaymentIntervalMs || (30 * 24 * 60 * 60 * 1000)),
      };
      loans.set(id, loan);
      // Auto-deposit into account
      deposit(playerId, loan.ccy, loan.principal, { now });
      _log("loan_issued", { id, playerId, amount: loan.principal });
      return { ok: true, loanId: id, loan };
    }

    function repayLoan(loanId, amount, opts2) {
      opts2 = opts2 || {};
      const loan = loans.get(loanId);
      if (!loan) return { ok: false, reason: "no_loan" };
      if (loan.status !== "active") return { ok: false, reason: "not_active" };
      const a = accounts.get(loan.playerId);
      if (!a) return { ok: false, reason: "no_account" };
      const avail = a.balances.get(loan.ccy) || 0;
      if (avail < amount) return { ok: false, reason: "insufficient" };
      a.balances.set(loan.ccy, avail - amount);
      const pay = Math.min(amount, loan.balance);
      loan.balance -= pay;
      const now = opts2.now != null ? opts2.now : Date.now();
      loan.lastPaymentTs = now;
      loan.nextDueTs = now + (opts2.repaymentIntervalMs || (30 * 24 * 60 * 60 * 1000));
      if (loan.balance <= 0) {
        loan.balance = 0;
        loan.status = "paid";
        _adjustCredit(loan.playerId, config.creditOnRepay);
        _log("loan_repaid", { id: loanId });
        return { ok: true, paid: pay, paidOff: true, newCredit: _getCredit(loan.playerId) };
      }
      _log("loan_payment", { id: loanId, pay, remaining: loan.balance });
      return { ok: true, paid: pay, remaining: loan.balance };
    }

    // Accrue loan interest + check for missed payments
    function tickLoans(now) {
      now = now != null ? now : Date.now();
      for (const loan of loans.values()) {
        if (loan.status !== "active") continue;
        const elapsedS = (now - loan.lastPaymentTs) / 1000;
        if (elapsedS <= 0) continue;
        const ratePerSec = loan.apr / (365 * 24 * 3600);
        const interest = loan.balance * ratePerSec * elapsedS;
        loan.balance += interest;
        loan.lastPaymentTs = now;
        // Missed payment?
        if (loan.nextDueTs > 0 && now > loan.nextDueTs + config.gracePeriodMs) {
          loan.missedPayments++;
          loan.nextDueTs = now + config.gracePeriodMs;
          _adjustCredit(loan.playerId, config.creditOnMiss);
          _log("payment_missed", { id: loan.id, missed: loan.missedPayments });
          if (loan.missedPayments >= config.defaultsAfterMissesN) {
            loan.status = "defaulted";
            _adjustCredit(loan.playerId, config.creditOnDefault);
            _log("loan_defaulted", { id: loan.id });
          }
        }
      }
    }

    function getLoan(id) { return loans.get(id) || null; }
    function listLoans(playerId) {
      return Array.from(loans.values()).filter(l => !playerId || l.playerId === playerId);
    }

    // Transfer between players
    function transfer(fromId, toId, ccy, amount, opts2) {
      opts2 = opts2 || {};
      if (fromId === toId) return { ok: false, reason: "self_transfer" };
      const w = withdraw(fromId, ccy, amount, opts2);
      if (!w.ok) return w;
      const d = deposit(toId, ccy, amount, opts2);
      _log("transfer", { fromId, toId, ccy, amount });
      return { ok: true, fromBalance: w.balance, toBalance: d.balance };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      balance, getCredit,
      deposit, withdraw, transfer,
      tickInterest, tickLoans,
      applyLoan, repayLoan,
      getLoan, listLoans,
      recentEvents, getConfig,
    };
  }

  return { createSystem };
});
