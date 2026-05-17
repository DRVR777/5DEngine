// test_iter_43.js — calculator + terminal apps.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");
const Calc = require("./apps/calculator.js");
const Term = require("./apps/terminal.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();
Apps.registerApp(Calc.APP);
Apps.registerApp(Term.APP);

// ===== CALCULATOR =====

// 1. Tokenizer
const t1 = Calc.tokenize("12 + 3.5 * (4-1)");
ok(!t1.error, "tokenize valid expr");
ok(t1.tokens.length === 9, `9 tokens (got ${t1.tokens.length})`);

const t2 = Calc.tokenize("abc");
ok(!!t2.error, "tokenize bad char rejected");

// 2. evalExpr basic ops
ok(Calc.evalExpr("1 + 2").value === 3, "1+2=3");
ok(Calc.evalExpr("10 - 4").value === 6, "10-4=6");
ok(Calc.evalExpr("3 * 4").value === 12, "3*4=12");
ok(Calc.evalExpr("15 / 3").value === 5, "15/3=5");

// 3. Precedence + parens
ok(Calc.evalExpr("2 + 3 * 4").value === 14, "precedence: 2+3*4=14");
ok(Calc.evalExpr("(2 + 3) * 4").value === 20, "parens: (2+3)*4=20");
ok(Calc.evalExpr("100 / (2 * 5)").value === 10, "nested: 100/(2*5)=10");

// 4. Unary minus
ok(Calc.evalExpr("-5 + 10").value === 5, "unary minus");
ok(Calc.evalExpr("-(2 + 3)").value === -5, "unary paren");

// 5. Float
const fr = Calc.evalExpr("3.5 * 2");
ok(Math.abs(fr.value - 7) < 1e-9, "float math");

// 6. Error cases
ok(Calc.evalExpr("1 /").ok === false, "trailing operator");
ok(Calc.evalExpr("(1 + 2").ok === false, "unclosed paren");
ok(Calc.evalExpr("10 / 0").ok === false, "div by zero");
ok(Calc.evalExpr("10 / 0").reason === "div_by_zero", "div by zero reason");
ok(Calc.evalExpr("1 + + 2").ok === false, "double op");

// 7. App lifecycle: input → evaluate → history
const pc = Comp.makeComputer();
const calc = Apps.instantiate("calculator", pc).instance;
Apps.input(calc, { type: "input", text: "2+3" });
ok(calc.state.expr === "2+3", "input accumulates");
Apps.input(calc, { type: "back" });
ok(calc.state.expr === "2+", "back deletes one char");
Apps.input(calc, { type: "input", text: "3" });
Apps.input(calc, { type: "evaluate" });
ok(calc.state.history.length === 1, "1 history entry");
ok(calc.state.history[0].value === 5, "history value = 5");
ok(calc.state.expr === "", "expr cleared after evaluate");

// 8. Memory
Apps.input(calc, { type: "memory_store" });
ok(calc.state.memory === 5, "memory stored");
Apps.input(calc, { type: "memory_recall" });
ok(calc.state.expr === "5", "memory recalled into expr");
Apps.input(calc, { type: "memory_clear" });
ok(calc.state.memory === 0, "memory cleared");

// 9. Clear expr
Apps.input(calc, { type: "input", text: "garbage" });
Apps.input(calc, { type: "clear" });
ok(calc.state.expr === "", "expr cleared");

// 10. Bad expr → error in history
Apps.input(calc, { type: "input", text: "1/0" });
Apps.input(calc, { type: "evaluate" });
const last = calc.state.history[calc.state.history.length - 1];
ok(last.error === "div_by_zero", "div_by_zero recorded");

// 11. IPC eval
const ipcReply = Apps.ipc(calc, "calculator", { type: "eval", expr: "100 * 3" });
ok(ipcReply.ok && ipcReply.reply.value === 300, "IPC eval works");

// ===== TERMINAL =====

// 12. parseLine handles quotes
const tokens = Term.parseLine(`echo "hello world" foo`);
ok(tokens.length === 3, `parsed 3 tokens (got ${tokens.length})`);
ok(tokens[1] === "hello world", "quoted arg preserved");

// 13. Built-in commands
const term = Apps.instantiate("terminal", pc, { computer: pc, handle: "alice" }).instance;
Apps.input(term, { type: "input", text: "help" });
Apps.input(term, { type: "submit" });
const r1 = term.state.output[term.state.output.length - 1];
ok(r1.includes("help") && r1.includes("ls"), `help lists commands (${r1.slice(0, 50)})`);

// 14. echo
Apps.input(term, { type: "input", text: "echo hello world" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1] === "hello world", "echo prints args");

// 15. write + ls + cat
Apps.input(term, { type: "input", text: "write notes.txt this is a note" });
Apps.input(term, { type: "submit" });
ok(pc.fileSystem["notes.txt"] === "this is a note", "write wrote to fs");

Apps.input(term, { type: "input", text: "ls" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1].includes("notes.txt"), "ls shows file");

Apps.input(term, { type: "input", text: "cat notes.txt" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1] === "this is a note", "cat prints content");

// 16. rm
Apps.input(term, { type: "input", text: "rm notes.txt" });
Apps.input(term, { type: "submit" });
ok(!("notes.txt" in pc.fileSystem), "rm removed file");

// 17. Unknown command
Apps.input(term, { type: "input", text: "ghost arg" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1].includes("unknown command"),
   "unknown command handled");

// 18. clear
const beforeLines = term.state.output.length;
Apps.input(term, { type: "input", text: "clear" });
Apps.input(term, { type: "submit" });
ok(term.state.output.length === 0, "clear wipes output");

// 19. whoami
Apps.input(term, { type: "input", text: "whoami" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1] === "alice", "whoami returns handle");

// 20. apps lists installed
Comp.installApp(pc, "calculator");
Comp.installApp(pc, "terminal");
Apps.input(term, { type: "input", text: "apps" });
Apps.input(term, { type: "submit" });
const appsOutput = term.state.output[term.state.output.length - 1];
ok(appsOutput.includes("calculator") && appsOutput.includes("terminal"),
   "apps lists both installed");

// 21. Register custom command
Apps.input(term, { type: "register", name: "double", fn: (args) => String(parseInt(args[0]) * 2) });
Apps.input(term, { type: "input", text: "double 21" });
Apps.input(term, { type: "submit" });
ok(term.state.output[term.state.output.length - 1] === "42", "custom command works");

// 22. Back deletes input
Apps.input(term, { type: "input", text: "abc" });
Apps.input(term, { type: "back" });
ok(term.state.input === "ab", "back deletes last char");

// 23. Submit empty does nothing.  Clear input first so we test the empty path.
while (term.state.input.length > 0) Apps.input(term, { type: "back" });
const before = JSON.stringify(term.state);
Apps.input(term, { type: "submit" });
ok(JSON.stringify(term.state) === before, "empty submit is no-op");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
