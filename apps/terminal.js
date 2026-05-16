// apps/terminal.js — REPL with built-in commands over computer state.
// Commands are data: registry of {name, run(args, ctx) → string | object}.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTATerminal = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createBuiltins() {
    return {
      help: (args, ctx) => {
        const names = Object.keys(ctx.commands).sort();
        return "available: " + names.join(", ");
      },
      echo: (args) => args.join(" "),
      ls: (args, ctx) => {
        if (!ctx.computer || !ctx.computer.fileSystem) return "(no fs)";
        const keys = Object.keys(ctx.computer.fileSystem);
        return keys.length === 0 ? "(empty)" : keys.join("\n");
      },
      cat: (args, ctx) => {
        if (!args[0]) return "usage: cat <file>";
        if (!ctx.computer) return "(no fs)";
        const v = ctx.computer.fileSystem[args[0]];
        return v == null ? "(not found)" : String(v);
      },
      write: (args, ctx) => {
        if (args.length < 2) return "usage: write <file> <text...>";
        if (!ctx.computer) return "(no fs)";
        ctx.computer.fileSystem[args[0]] = args.slice(1).join(" ");
        return `wrote ${args[0]}`;
      },
      rm: (args, ctx) => {
        if (!args[0]) return "usage: rm <file>";
        if (!ctx.computer) return "(no fs)";
        const had = args[0] in ctx.computer.fileSystem;
        delete ctx.computer.fileSystem[args[0]];
        return had ? `removed ${args[0]}` : "(not found)";
      },
      apps: (args, ctx) => {
        if (!ctx.computer) return "(no computer)";
        return ctx.computer.installedApps.length === 0 ? "(none)"
          : ctx.computer.installedApps.join("\n");
      },
      clear: () => ({ clear: true }),
      date: () => new Date().toISOString(),
      whoami: (args, ctx) => ctx.handle || "anon",
    };
  }

  function parseLine(line) {
    // Simple tokenizer: handles bare tokens + double-quoted strings.
    const out = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === " " || line[i] === "\t") { i++; continue; }
      if (line[i] === "\"") {
        const start = ++i;
        while (i < line.length && line[i] !== "\"") i++;
        out.push(line.slice(start, i));
        if (line[i] === "\"") i++;
      } else {
        const start = i;
        while (i < line.length && line[i] !== " " && line[i] !== "\t") i++;
        out.push(line.slice(start, i));
      }
    }
    return out;
  }

  const APP = {
    id: "terminal",
    name: "Terminal",
    icon: "💻",
    category: "system",
    init: (opts) => ({
      commands: Object.assign(createBuiltins(), opts.commands || {}),
      computer: opts.computer || null,
      handle: opts.handle || "user",
      input: "",
      output: ["5DEngine Terminal — type `help` to list commands."],
    }),
    render: (state) => {
      const last = state.output.slice(-12).join("\n");
      return `${last}\n${state.handle}@5dengine$ ${state.input}`;
    },
    handleInput: (state, evt, computer) => {
      if (!state.computer && computer) state.computer = computer;
      if (evt.type === "input" && typeof evt.text === "string") {
        return { ...state, input: state.input + evt.text };
      }
      if (evt.type === "back") {
        return { ...state, input: state.input.slice(0, -1) };
      }
      if (evt.type === "submit") {
        const line = state.input.trim();
        if (!line) return null;
        const [cmd, ...args] = parseLine(line);
        const handler = state.commands[cmd];
        let output;
        if (!handler) {
          output = `unknown command: ${cmd}`;
        } else {
          try {
            const r = handler(args, state);
            if (r && r.clear === true) {
              return { ...state, input: "", output: [] };
            }
            output = typeof r === "string" ? r : JSON.stringify(r);
          } catch (e) {
            output = `error: ${e.message}`;
          }
        }
        return { ...state, input: "", output: [...state.output, `> ${line}`, output] };
      }
      if (evt.type === "register" && evt.name && evt.fn) {
        return { ...state, commands: { ...state.commands, [evt.name]: evt.fn } };
      }
      return null;
    },
    ipc: () => null,
  };

  return { APP, parseLine, createBuiltins };
});
