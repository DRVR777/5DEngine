// apps/calculator.js — basic 4-function calc + memory.
// Pure expression eval limited to numbers + ()+-*/.  No eval() — own parser.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACalculator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Tokenize: numbers, ops, parens. Returns [{type, value}].
  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (c === " " || c === "\t") { i++; continue; }
      if ("+-*/()".includes(c)) { tokens.push({ type: c, value: c }); i++; continue; }
      if (c >= "0" && c <= "9" || c === ".") {
        let j = i;
        while (j < expr.length && (expr[j] === "." || expr[j] >= "0" && expr[j] <= "9")) j++;
        const n = parseFloat(expr.slice(i, j));
        if (Number.isNaN(n)) return { error: `bad_number: ${expr.slice(i, j)}` };
        tokens.push({ type: "num", value: n });
        i = j; continue;
      }
      return { error: `bad_char: ${c}` };
    }
    return { tokens };
  }

  // Recursive-descent parser: expr = term (("+"|"-") term)*
  //                        term = factor (("*"|"/") factor)*
  //                        factor = num | "(" expr ")" | "-" factor
  function evalExpr(input) {
    const tk = tokenize(input);
    if (tk.error) return { ok: false, reason: tk.error };
    const tokens = tk.tokens;
    let pos = 0;
    function peek() { return tokens[pos]; }
    function eat() { return tokens[pos++]; }
    function parseFactor() {
      const t = peek();
      if (!t) return { ok: false, reason: "unexpected_end" };
      if (t.type === "num") { eat(); return { ok: true, value: t.value }; }
      if (t.type === "(") {
        eat();
        const r = parseExpr();
        if (!r.ok) return r;
        if (peek() && peek().type === ")") { eat(); return r; }
        return { ok: false, reason: "expected_paren" };
      }
      if (t.type === "-") {
        eat();
        const r = parseFactor();
        if (!r.ok) return r;
        return { ok: true, value: -r.value };
      }
      return { ok: false, reason: `unexpected: ${t.type}` };
    }
    function parseTerm() {
      let r = parseFactor();
      if (!r.ok) return r;
      while (peek() && (peek().type === "*" || peek().type === "/")) {
        const op = eat().type;
        const rhs = parseFactor();
        if (!rhs.ok) return rhs;
        if (op === "/") {
          if (rhs.value === 0) return { ok: false, reason: "div_by_zero" };
          r = { ok: true, value: r.value / rhs.value };
        } else {
          r = { ok: true, value: r.value * rhs.value };
        }
      }
      return r;
    }
    function parseExpr() {
      let r = parseTerm();
      if (!r.ok) return r;
      while (peek() && (peek().type === "+" || peek().type === "-")) {
        const op = eat().type;
        const rhs = parseTerm();
        if (!rhs.ok) return rhs;
        r = { ok: true, value: op === "+" ? r.value + rhs.value : r.value - rhs.value };
      }
      return r;
    }
    const result = parseExpr();
    if (!result.ok) return result;
    if (pos < tokens.length) return { ok: false, reason: `trailing_token` };
    return result;
  }

  const APP = {
    id: "calculator",
    name: "Calculator",
    icon: "🧮",
    category: "productivity",
    init: () => ({
      expr: "",
      history: [],     // [{expr, value | error}]
      memory: 0,
    }),
    render: (state) => {
      const hist = state.history.slice(-8).map(h =>
        h.error ? `${h.expr} = !${h.error}` : `${h.expr} = ${h.value}`
      ).join("\n");
      const mem = `[M=${state.memory}]`;
      return `${mem}\n${hist}\n> ${state.expr}`;
    },
    handleInput: (state, evt) => {
      if (evt.type === "input" && typeof evt.text === "string") {
        return { ...state, expr: state.expr + evt.text };
      }
      if (evt.type === "back") {
        return { ...state, expr: state.expr.slice(0, -1) };
      }
      if (evt.type === "clear") {
        return { ...state, expr: "" };
      }
      if (evt.type === "evaluate") {
        if (!state.expr.trim()) return null;
        const r = evalExpr(state.expr);
        const entry = r.ok ? { expr: state.expr, value: r.value } : { expr: state.expr, error: r.reason };
        return { ...state, expr: "", history: [...state.history, entry] };
      }
      if (evt.type === "memory_store") {
        if (state.history.length === 0) return null;
        const last = state.history[state.history.length - 1];
        if (last.error) return null;
        return { ...state, memory: last.value };
      }
      if (evt.type === "memory_recall") {
        return { ...state, expr: state.expr + String(state.memory) };
      }
      if (evt.type === "memory_clear") {
        return { ...state, memory: 0 };
      }
      return null;
    },
    ipc: (msg) => {
      if (msg.type === "eval" && typeof msg.expr === "string") {
        return evalExpr(msg.expr);
      }
      return null;
    },
  };

  return { APP, evalExpr, tokenize };
});
