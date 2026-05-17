// economy.js — per-world currencies + exchange rates + tax/fees.
// Worlds (per conviction.pdf) can each have their own currency. When
// players cross worlds, conversions happen at posted rates with optional
// transaction tax.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAEconomy = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createEconomy(opts) {
    opts = opts || {};
    const currencies = new Map();   // code → {code, name, decimals, worldId, supply}
    // rates[from][to] = price of 1 from in to
    const rates = new Map();
    const balances = new Map();     // playerId → Map<currency, amount>
    const txLog = [];               // {from, to, fromCcy, toCcy, amount, tax, ts, kind}

    const taxRate = opts.taxRate != null ? opts.taxRate : 0.02;   // 2% default

    function defineCurrency(code, def) {
      if (currencies.has(code)) throw new Error(`currency ${code} exists`);
      currencies.set(code, Object.assign({
        code, name: def && def.name || code,
        decimals: def && def.decimals != null ? def.decimals : 0,
        worldId: def && def.worldId || null,
        supply: 0,
      }, def || {}));
    }
    function getCurrency(code) { return currencies.get(code) || null; }
    function listCurrencies() { return Array.from(currencies.keys()); }

    function setRate(from, to, rate) {
      if (!currencies.has(from) || !currencies.has(to)) return false;
      if (rate <= 0) throw new Error("rate must be > 0");
      if (!rates.has(from)) rates.set(from, new Map());
      rates.get(from).set(to, rate);
      // Auto-set inverse if not explicitly set
      if (!rates.has(to)) rates.set(to, new Map());
      if (!rates.get(to).has(from)) {
        rates.get(to).set(from, 1 / rate);
      }
      return true;
    }
    function getRate(from, to) {
      if (from === to) return 1;
      const r = rates.get(from);
      return (r && r.get(to)) || null;
    }

    // Player balance management
    function _wallet(playerId) {
      if (!balances.has(playerId)) balances.set(playerId, new Map());
      return balances.get(playerId);
    }
    function balance(playerId, ccy) {
      const w = balances.get(playerId);
      return w ? (w.get(ccy) || 0) : 0;
    }
    function deposit(playerId, ccy, amount) {
      if (!currencies.has(ccy)) return { ok: false, reason: "unknown_currency" };
      if (amount <= 0) return { ok: false, reason: "non_positive" };
      const w = _wallet(playerId);
      w.set(ccy, (w.get(ccy) || 0) + amount);
      const c = currencies.get(ccy);
      c.supply += amount;
      txLog.push({ from: null, to: playerId, fromCcy: null, toCcy: ccy, amount, tax: 0, ts: Date.now(), kind: "mint" });
      return { ok: true, balance: w.get(ccy) };
    }
    function withdraw(playerId, ccy, amount) {
      const cur = balance(playerId, ccy);
      if (cur < amount) return { ok: false, reason: "insufficient_funds", balance: cur };
      const w = _wallet(playerId);
      w.set(ccy, cur - amount);
      const c = currencies.get(ccy);
      if (c) c.supply -= amount;
      txLog.push({ from: playerId, to: null, fromCcy: ccy, toCcy: null, amount, tax: 0, ts: Date.now(), kind: "burn" });
      return { ok: true, balance: w.get(ccy) };
    }

    // Convert one currency to another, applying tax.
    function convert(playerId, fromCcy, toCcy, amount) {
      const r = getRate(fromCcy, toCcy);
      if (r == null) return { ok: false, reason: "no_rate" };
      const cur = balance(playerId, fromCcy);
      if (cur < amount) return { ok: false, reason: "insufficient_funds", balance: cur };
      const grossOut = amount * r;
      const tax = Math.floor(grossOut * taxRate * 100) / 100;
      const netOut = grossOut - tax;
      // Mutate balances
      const w = _wallet(playerId);
      w.set(fromCcy, cur - amount);
      w.set(toCcy, (w.get(toCcy) || 0) + netOut);
      // Supply: from-supply down by amount, to-supply up by netOut
      const fromC = currencies.get(fromCcy);
      const toC = currencies.get(toCcy);
      if (fromC) fromC.supply -= amount;
      if (toC) toC.supply += netOut;
      txLog.push({
        from: playerId, to: playerId, fromCcy, toCcy,
        amount, tax, netOut, rate: r, ts: Date.now(), kind: "convert",
      });
      return { ok: true, fromBalance: w.get(fromCcy), toBalance: w.get(toCcy), netOut, tax };
    }

    // Transfer between players, same currency (no conversion).
    function transfer(fromId, toId, ccy, amount) {
      if (!currencies.has(ccy)) return { ok: false, reason: "unknown_currency" };
      const cur = balance(fromId, ccy);
      if (cur < amount) return { ok: false, reason: "insufficient_funds" };
      const tax = Math.floor(amount * taxRate * 100) / 100;
      const net = amount - tax;
      const wFrom = _wallet(fromId), wTo = _wallet(toId);
      wFrom.set(ccy, cur - amount);
      wTo.set(ccy, (wTo.get(ccy) || 0) + net);
      txLog.push({ from: fromId, to: toId, fromCcy: ccy, toCcy: ccy, amount, tax, ts: Date.now(), kind: "transfer" });
      return { ok: true, sentNet: net, tax };
    }

    function recentLog(n) { return txLog.slice(-(n || 50)); }

    return {
      currencies, rates, balances, txLog, taxRate,
      defineCurrency, getCurrency, listCurrencies,
      setRate, getRate,
      balance, deposit, withdraw, convert, transfer,
      recentLog,
    };
  }

  return { createEconomy };
});
