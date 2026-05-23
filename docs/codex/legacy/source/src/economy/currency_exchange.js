// currency_exchange.js — ccy-to-ccy market with bid/ask + slippage + depth.
// One order book per (sellCcy, buyCcy) pair (eg. coin→gem).
// Limit orders post liquidity at a price; market orders sweep the book
// from best price outward and report executed amount + slippage.
//
// Order: { id, side:"buy"|"sell", playerId, sellCcy, buyCcy,
//          quantity, price, filled, status }
// Trade: { buyOrderId, sellOrderId, quantity, price, ts }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACurrencyExchange = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _pairKey(sell, buy) { return sell + "::" + buy; }

  function createExchange(opts) {
    opts = opts || {};
    const config = Object.assign({
      feeRate: 0.005,         // 50 bps per side
      maxOrdersPerBook: 1000,
    }, opts.config || {});

    // pairKey → { bids:[], asks:[] }
    // bids = buy orders for this pair, sorted by price DESC (best=highest)
    // asks = sell orders, sorted by price ASC (best=lowest)
    const books = new Map();
    const orders = new Map();       // orderId → order
    const trades = [];
    let nextOrderId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 1000) events.shift();
    }

    function _book(sell, buy) {
      const k = _pairKey(sell, buy);
      if (!books.has(k)) books.set(k, { bids: [], asks: [] });
      return books.get(k);
    }

    // Place a limit order. Returns {ok, orderId, trades:[...]}
    function limitOrder(opts2) {
      if (!opts2 || !opts2.playerId || !opts2.side ||
          !opts2.sellCcy || !opts2.buyCcy ||
          typeof opts2.quantity !== "number" || opts2.quantity <= 0 ||
          typeof opts2.price !== "number" || opts2.price <= 0) {
        return { ok: false, reason: "bad_order" };
      }
      const id = "ord_" + (nextOrderId++);
      const order = {
        id, side: opts2.side, playerId: opts2.playerId,
        sellCcy: opts2.sellCcy, buyCcy: opts2.buyCcy,
        quantity: opts2.quantity, price: opts2.price,
        filled: 0, status: "open",
        kind: "limit", ts: Date.now(),
      };
      orders.set(id, order);
      const book = _book(opts2.sellCcy, opts2.buyCcy);
      if (book.bids.length + book.asks.length >= config.maxOrdersPerBook) {
        return { ok: false, reason: "book_full" };
      }
      // Match
      const ts = _match(order, book, opts2.economy);
      _insertIfRemaining(order, book);
      _log("limit", { id, side: opts2.side, qty: opts2.quantity, price: opts2.price });
      return { ok: true, orderId: id, trades: ts, order };
    }

    function _insertIfRemaining(order, book) {
      if (order.filled >= order.quantity) {
        order.status = "filled";
        return;
      }
      if (order.side === "buy") {
        // Insert into bids sorted DESC by price
        let i = 0;
        while (i < book.bids.length && book.bids[i].price >= order.price) i++;
        book.bids.splice(i, 0, order);
      } else {
        // Insert into asks sorted ASC by price
        let i = 0;
        while (i < book.asks.length && book.asks[i].price <= order.price) i++;
        book.asks.splice(i, 0, order);
      }
    }

    // Match an incoming order against the opposing side.
    function _match(taker, book, econ) {
      const ts = [];
      const oppSide = taker.side === "buy" ? book.asks : book.bids;
      while (taker.filled < taker.quantity && oppSide.length > 0) {
        const maker = oppSide[0];
        // Price-crossing check
        if (taker.side === "buy" && maker.price > taker.price) break;
        if (taker.side === "sell" && maker.price < taker.price) break;
        const qty = Math.min(taker.quantity - taker.filled, maker.quantity - maker.filled);
        const price = maker.price;
        // Settle via economy bridge (optional)
        if (econ) _settle(taker, maker, qty, price, econ);
        taker.filled += qty;
        maker.filled += qty;
        const trade = {
          id: "trade_" + (trades.length + 1),
          buyOrderId: taker.side === "buy" ? taker.id : maker.id,
          sellOrderId: taker.side === "sell" ? taker.id : maker.id,
          quantity: qty, price,
          buyer: taker.side === "buy" ? taker.playerId : maker.playerId,
          seller: taker.side === "sell" ? taker.playerId : maker.playerId,
          sellCcy: taker.sellCcy, buyCcy: taker.buyCcy,
          ts: Date.now(),
        };
        trades.push(trade);
        ts.push(trade);
        if (maker.filled >= maker.quantity) {
          maker.status = "filled";
          oppSide.shift();
        }
      }
      return ts;
    }

    function _settle(taker, maker, qty, price, econ) {
      // Buyer pays (price * qty) buyCcy worth from sellCcy side, gets buyCcy
      // For pair sellCcy→buyCcy: buyer wants to buy buyCcy, pays in sellCcy
      const buyer = taker.side === "buy" ? taker : maker;
      const seller = taker.side === "sell" ? taker : maker;
      const cost = qty * price;        // in sellCcy
      const fee = cost * config.feeRate;
      if (econ.withdraw) econ.withdraw(buyer.playerId, taker.sellCcy, cost + fee);
      if (econ.withdraw) econ.withdraw(seller.playerId, taker.buyCcy, qty);
      if (econ.deposit)  econ.deposit(buyer.playerId, taker.buyCcy, qty);
      if (econ.deposit)  econ.deposit(seller.playerId, taker.sellCcy, cost - fee);
    }

    // Market order — fills at best available price, no limit. Returns
    // {ok, executed, avgPrice, slippage, trades}.
    function marketOrder(opts2) {
      if (!opts2 || !opts2.playerId || !opts2.side ||
          !opts2.sellCcy || !opts2.buyCcy ||
          typeof opts2.quantity !== "number" || opts2.quantity <= 0) {
        return { ok: false, reason: "bad_order" };
      }
      const book = _book(opts2.sellCcy, opts2.buyCcy);
      const oppSide = opts2.side === "buy" ? book.asks : book.bids;
      if (oppSide.length === 0) return { ok: false, reason: "no_liquidity" };
      const id = "ord_" + (nextOrderId++);
      // Best price BEFORE trade (for slippage calc)
      const bestPrice = oppSide[0].price;
      const order = {
        id, side: opts2.side, playerId: opts2.playerId,
        sellCcy: opts2.sellCcy, buyCcy: opts2.buyCcy,
        quantity: opts2.quantity,
        price: opts2.side === "buy" ? Infinity : 0,
        filled: 0, status: "open", kind: "market", ts: Date.now(),
      };
      orders.set(id, order);
      const ts = _match(order, book, opts2.economy);
      let cost = 0;
      let executed = 0;
      for (const t of ts) {
        cost += t.price * t.quantity;
        executed += t.quantity;
      }
      const avgPrice = executed > 0 ? cost / executed : 0;
      const slippage = bestPrice > 0
        ? (avgPrice - bestPrice) / bestPrice * (opts2.side === "buy" ? 1 : -1)
        : 0;
      order.status = order.filled >= order.quantity ? "filled" : "partial";
      _log("market", { id, side: opts2.side, executed, avgPrice });
      return {
        ok: true, orderId: id, trades: ts,
        executed, avgPrice, slippage,
        unfilled: order.quantity - executed,
      };
    }

    function cancelOrder(orderId, playerId) {
      const o = orders.get(orderId);
      if (!o) return { ok: false, reason: "missing" };
      if (o.playerId !== playerId) return { ok: false, reason: "not_owner" };
      if (o.status !== "open") return { ok: false, reason: "not_open" };
      const book = _book(o.sellCcy, o.buyCcy);
      const side = o.side === "buy" ? book.bids : book.asks;
      const idx = side.findIndex(x => x.id === orderId);
      if (idx >= 0) side.splice(idx, 1);
      o.status = "cancelled";
      _log("cancel", { orderId });
      return { ok: true };
    }

    // Top of book / depth queries
    function bestBid(sell, buy) {
      const book = _book(sell, buy);
      return book.bids[0] || null;
    }
    function bestAsk(sell, buy) {
      const book = _book(sell, buy);
      return book.asks[0] || null;
    }
    function spread(sell, buy) {
      const b = bestBid(sell, buy), a = bestAsk(sell, buy);
      if (!b || !a) return null;
      return a.price - b.price;
    }
    function depth(sell, buy, levels) {
      levels = levels || 10;
      const book = _book(sell, buy);
      return {
        bids: book.bids.slice(0, levels).map(o => ({ price: o.price, qty: o.quantity - o.filled })),
        asks: book.asks.slice(0, levels).map(o => ({ price: o.price, qty: o.quantity - o.filled })),
      };
    }

    function getOrder(id) { return orders.get(id) || null; }
    function listOrders(playerId) {
      if (!playerId) return Array.from(orders.values());
      return Array.from(orders.values()).filter(o => o.playerId === playerId);
    }
    function recentTrades(n) { return trades.slice(-(n || 50)); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      limitOrder, marketOrder, cancelOrder,
      bestBid, bestAsk, spread, depth,
      getOrder, listOrders,
      recentTrades, recentEvents,
    };
  }

  return { createExchange };
});
