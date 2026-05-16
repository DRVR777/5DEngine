// test_iter_99.js — currency exchange: limit/market orders + slippage + depth.
const X = require("./currency_exchange.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    set: (p, c, a) => bal.set(k(p,c), a),
    balance: (p, c) => bal.get(k(p,c)) || 0,
    deposit: (p, c, a) => { bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a); return { ok: true }; },
    withdraw: (p, c, a) => {
      bal.set(k(p,c), Math.max(0, (bal.get(k(p,c)) || 0) - a));
      return { ok: true };
    },
  };
}

// 1. Limit order placement
const ex = X.createExchange();
const buy1 = ex.limitOrder({
  playerId: "alice", side: "buy",
  sellCcy: "coin", buyCcy: "gem", quantity: 10, price: 5,
});
ok(buy1.ok === true, "buy order placed");
ok(buy1.orderId === "ord_1", "ord_1");
ok(buy1.trades.length === 0, "no trades yet");

// Bad orders
ok(ex.limitOrder({}).ok === false, "empty rejected");
ok(ex.limitOrder({ playerId: "x", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 0, price: 1 }).ok === false, "qty 0");
ok(ex.limitOrder({ playerId: "x", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: -1 }).ok === false, "neg price");

// 2. Best bid populated
const bb = ex.bestBid("coin", "gem");
ok(bb && bb.price === 5, `best bid = 5 (got ${bb && bb.price})`);
ok(ex.bestAsk("coin", "gem") === null, "no asks yet");
ok(ex.spread("coin", "gem") === null, "no spread");

// 3. Place sell order that crosses → matches
const sell1 = ex.limitOrder({
  playerId: "bob", side: "sell",
  sellCcy: "coin", buyCcy: "gem", quantity: 3, price: 5,
});
ok(sell1.ok === true, "sell matched");
ok(sell1.trades.length === 1, "1 trade");
ok(sell1.trades[0].quantity === 3, "qty 3");
ok(sell1.trades[0].price === 5, "price 5");
ok(sell1.trades[0].buyer === "alice", "buyer alice");
ok(sell1.trades[0].seller === "bob", "seller bob");

// Buy order partially filled (was 10, now 7 remaining)
ok(ex.bestBid("coin", "gem").quantity === 10, "bid qty unchanged");
ok(ex.getOrder(buy1.orderId).filled === 3, "filled 3");

// 4. Multiple asks at different prices
ex.limitOrder({ playerId: "c", side: "sell", sellCcy: "coin", buyCcy: "gem", quantity: 2, price: 6 });
ex.limitOrder({ playerId: "d", side: "sell", sellCcy: "coin", buyCcy: "gem", quantity: 4, price: 7 });
ok(ex.bestAsk("coin", "gem").price === 6, "best ask = 6");
ok(ex.spread("coin", "gem") === 1, `spread = 1 (6 - 5)`);

// 5. Depth
const d = ex.depth("coin", "gem", 5);
ok(d.bids.length >= 1, "depth has bids");
ok(d.asks.length === 2, "depth 2 asks");
ok(d.asks[0].price === 6 && d.asks[1].price === 7, "asks sorted asc");

// 6. Market order sweeps
const m1 = ex.marketOrder({
  playerId: "e", side: "buy",
  sellCcy: "coin", buyCcy: "gem", quantity: 5,
});
ok(m1.ok === true, "market buy ok");
ok(m1.executed === 5, `executed 5 (got ${m1.executed})`);
// 2 @ 6 = 12, 3 @ 7 = 21; avg = 33/5 = 6.6
ok(Math.abs(m1.avgPrice - 6.6) < 0.001, `avg price 6.6 (got ${m1.avgPrice})`);
ok(m1.slippage > 0, `slippage > 0 (got ${m1.slippage.toFixed(3)})`);

// 7. Market order with no liquidity
const m2 = ex.marketOrder({
  playerId: "f", side: "sell",
  sellCcy: "raredust", buyCcy: "coin", quantity: 10,
});
ok(m2.ok === false && m2.reason === "no_liquidity", "no liquidity rejected");

// 8. Partial fill (not enough liquidity)
ex.limitOrder({ playerId: "g", side: "sell", sellCcy: "x", buyCcy: "y", quantity: 5, price: 1 });
const m3 = ex.marketOrder({
  playerId: "h", side: "buy",
  sellCcy: "x", buyCcy: "y", quantity: 20,
});
ok(m3.ok === true, "market buy ok");
ok(m3.executed === 5, `partial: 5 of 20 (got ${m3.executed})`);
ok(m3.unfilled === 15, "unfilled = 15");

// 9. Cancel limit order
const ord = ex.limitOrder({ playerId: "i", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: 100 });
ok(ex.cancelOrder(ord.orderId, "i").ok === true, "cancel ok");
ok(ex.getOrder(ord.orderId).status === "cancelled", "status cancelled");
ok(ex.cancelOrder(ord.orderId, "i").ok === false, "double cancel fails");

// Cancel by wrong player
const ord2 = ex.limitOrder({ playerId: "j", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: 50 });
ok(ex.cancelOrder(ord2.orderId, "intruder").ok === false, "non-owner can't cancel");

// 10. Limit order that doesn't cross stays open
const stay = ex.limitOrder({ playerId: "k", side: "buy", sellCcy: "p", buyCcy: "q", quantity: 1, price: 1 });
ok(ex.getOrder(stay.orderId).status === "open", "open (no asks to match)");

// 11. Settlement via economy hook — fresh exchange to isolate
const econ = mkEcon();
econ.set("buyer", "coin", 1000);
econ.set("seller", "gem", 100);
const exFresh = X.createExchange();
exFresh.limitOrder({
  playerId: "seller", side: "sell",
  sellCcy: "coin", buyCcy: "gem",
  quantity: 10, price: 5,
});
const t = exFresh.limitOrder({
  playerId: "buyer", side: "buy",
  sellCcy: "coin", buyCcy: "gem",
  quantity: 10, price: 5,
  economy: econ,
});
ok(t.trades.length === 1, "settlement trade");
// Buyer paid 10 * 5 = 50 coin (+ fee 0.25)
ok(econ.balance("buyer", "coin") < 1000, "buyer coin reduced");
ok(econ.balance("buyer", "gem") === 10, "buyer got 10 gem");
ok(econ.balance("seller", "coin") > 0, "seller got coin");
ok(econ.balance("seller", "gem") === 90, "seller gem -10");

// 12. Sort: bids descending price
const ex2 = X.createExchange();
ex2.limitOrder({ playerId: "p1", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: 3 });
ex2.limitOrder({ playerId: "p2", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: 5 });
ex2.limitOrder({ playerId: "p3", side: "buy", sellCcy: "a", buyCcy: "b", quantity: 1, price: 4 });
ok(ex2.bestBid("a", "b").price === 5, "best bid = highest");
const d2 = ex2.depth("a", "b");
ok(d2.bids[0].price === 5 && d2.bids[1].price === 4 && d2.bids[2].price === 3, "bids sorted DESC");

// 13. Asks: ascending
ex2.limitOrder({ playerId: "s1", side: "sell", sellCcy: "a", buyCcy: "b", quantity: 1, price: 10 });
ex2.limitOrder({ playerId: "s2", side: "sell", sellCcy: "a", buyCcy: "b", quantity: 1, price: 8 });
ex2.limitOrder({ playerId: "s3", side: "sell", sellCcy: "a", buyCcy: "b", quantity: 1, price: 9 });
ok(ex2.bestAsk("a", "b").price === 8, "best ask = lowest");

// 14. Limit order that crosses (buy at high price) sweeps multiple asks
const sweep = ex2.limitOrder({
  playerId: "sweeper", side: "buy",
  sellCcy: "a", buyCcy: "b", quantity: 3, price: 100,
});
ok(sweep.trades.length === 3, `swept 3 asks (got ${sweep.trades.length})`);
ok(sweep.trades[0].price === 8, "first @ 8");
ok(sweep.trades[1].price === 9, "second @ 9");
ok(sweep.trades[2].price === 10, "third @ 10");

// 15. listOrders by player
const mine = ex2.listOrders("sweeper");
ok(mine.length === 1, "sweeper has 1 order");
ok(ex2.listOrders().length > 3, "all orders");

// 16. recentTrades
ok(ex2.recentTrades().length > 0, "trades logged");

// 17. recentEvents
ok(ex2.recentEvents().some(e => e.kind === "limit"), "limit event");
ok(ex2.recentEvents().some(e => e.kind === "cancel") === false, "no cancels yet");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
