// Quest panel — addQuest/completeQuestStep API + J-key toggleable HUD panel.
// mountQuestPanel({ showToast }) → { addQuest, completeQuestStep, togglePanel, renderQuests, isOpen, getQuests }
export function mountQuestPanel({ showToast }) {
  if (typeof document === "undefined") {
    const _q = [];
    return {
      addQuest: () => {},
      completeQuestStep: () => {},
      togglePanel: () => {},
      renderQuests: () => {},
      get isOpen() { return false; },
      getQuests: () => _q,
    };
  }

  const _quests = [];
  let _questOpen = false;

  function renderQuests() {
    const el = document.getElementById("questList");
    if (!el) return;
    if (!_quests.length) { el.innerHTML = `<div style="color:#4488aa;font-size:10px">No active objectives.</div>`; return; }
    el.innerHTML = _quests.map(q => {
      const allDone = q.steps.every(s => s.done);
      const stepsHtml = q.steps.map(s =>
        `<div style="display:flex;gap:6px;align-items:flex-start;margin-top:3px;opacity:${s.done ? 0.55 : 1}">
          <span style="color:${s.done ? "#00ffaa" : "#4488aa"};flex-shrink:0">${s.done ? "✓" : "○"}</span>
          <span style="color:${s.done ? "#6688aa" : "#b8e8ff"};font-size:10px;text-decoration:${s.done ? "line-through" : "none"}">${s.text}</span>
        </div>`).join("");
      return `<div style="margin-bottom:10px">
        <div style="color:${allDone ? "#00ffaa" : "#ffd166"};font-size:10px;letter-spacing:0.08em">${allDone ? "★ " : "▷ "}${q.title}</div>
        ${stepsHtml}
      </div>`;
    }).join("");
  }

  function addQuest(id, title, steps) {
    _quests.push({ id, title, steps: steps.map(s => ({ text: s, done: false })) });
    renderQuests();
    if (showToast) showToast(`NEW OBJECTIVE: ${title}`, "success");
  }

  function completeQuestStep(questId, stepIdx) {
    const q = _quests.find(q => q.id === questId);
    if (!q || !q.steps[stepIdx] || q.steps[stepIdx].done) return;
    q.steps[stepIdx].done = true;
    renderQuests();
    if (showToast) {
      showToast(`✓ ${q.steps[stepIdx].text}`, "success");
      if (q.steps.every(s => s.done)) showToast(`★ QUEST COMPLETE: ${q.title}`, "success", 5000);
    }
  }

  function togglePanel() {
    _questOpen = !_questOpen;
    const qp = document.getElementById("questPanel");
    if (qp) { qp.style.display = _questOpen ? "block" : "none"; if (_questOpen) renderQuests(); }
  }

  return {
    addQuest,
    completeQuestStep,
    togglePanel,
    renderQuests,
    get isOpen() { return _questOpen; },
    getQuests: () => _quests,
  };
}
