// NPC Dialog system — E key near an NPC opens a branching text conversation.
// mountNpcDialog(dialogs) → { open(npcId), close(), isOpen }
// dialogs = { npcId: { name, lines: [{ text, choices: [{ label, next }] }] } }
export function mountNpcDialog(dialogs) {
  if (typeof document === "undefined") return { open: () => {}, close: () => {}, get isOpen() { return false; } };

  let _isOpen = false;
  let _activeId = null;
  let _lineIdx = 0;

  function _render(line) {
    const def = dialogs[_activeId];
    const nameEl   = document.getElementById("npcDialogName");
    const textEl   = document.getElementById("npcDialogText");
    const choicesEl = document.getElementById("npcDialogChoices");
    if (nameEl)    nameEl.textContent = def.name;
    if (textEl)    textEl.textContent = line.text;
    if (!choicesEl) return;
    choicesEl.innerHTML = "";
    for (const choice of (line.choices || [])) {
      const btn = document.createElement("button");
      btn.textContent = choice.label;
      btn.style.cssText = "background:rgba(0,200,255,0.1);border:1px solid rgba(0,200,255,0.3);color:#b8e8ff;padding:8px 14px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;text-align:left";
      btn.onmouseover = () => { btn.style.background = "rgba(0,200,255,0.2)"; btn.style.color = "#00ccff"; };
      btn.onmouseout  = () => { btn.style.background = "rgba(0,200,255,0.1)"; btn.style.color = "#b8e8ff"; };
      btn.onclick = () => {
        if (choice.next == null) {
          close();
        } else {
          _lineIdx = choice.next;
          _render(def.lines[choice.next]);
        }
      };
      choicesEl.appendChild(btn);
    }
  }

  function open(npcId) {
    const def = dialogs[npcId];
    if (!def) return;
    _activeId = npcId;
    _lineIdx  = 0;
    _isOpen   = true;
    _render(def.lines[0]);
    const panel = document.getElementById("npcDialog");
    if (panel) panel.style.display = "block";
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function close() {
    _isOpen   = false;
    _activeId = null;
    const panel = document.getElementById("npcDialog");
    if (panel) panel.style.display = "none";
  }

  return {
    open,
    close,
    get isOpen() { return _isOpen; },
  };
}

// Default NPC dialog data for the base game
export const DEFAULT_NPC_DIALOGS = {
  npc_red: {
    name: "ROGUE_RED",
    lines: [
      { text: "Yo, watch your back out here. The orange ones hit hard.", choices: [{ label: "Got it.", next: null }, { label: "Who are you?", next: 1 }] },
      { text: "Nobody. Just a ghost in the grid. Keep moving.", choices: [{ label: "Thanks.", next: null }] },
    ],
  },
  npc_blue: {
    name: "BYTE_BLUE",
    lines: [
      { text: "I've been patching my firmware for the last three cycles. Don't interrupt me.", choices: [{ label: "Sorry.", next: null }, { label: "What are you patching?", next: 1 }] },
      { text: "The rain subroutine. It keeps triggering at noon. Press H to see what I mean.", choices: [{ label: "Interesting.", next: null }] },
    ],
  },
  npc_green: {
    name: "GRN_GHOST",
    lines: [
      { text: "Coins are scattered all over the arena. Collect them all for... bragging rights.", choices: [{ label: "Cool.", next: null }] },
    ],
  },
  npc_white: {
    name: "PALE_UNIT",
    lines: [
      { text: "Build mode (B) lets you reshape this whole world. Pretty powerful.", choices: [{ label: "I know.", next: null }, { label: "Tell me more.", next: 1 }] },
      { text: "Drop GLB files to replace objects. N to place spawn points. K to tune physics.", choices: [{ label: "Thanks.", next: null }] },
    ],
  },
};
