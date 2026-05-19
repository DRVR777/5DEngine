export function mountDifficultySelect({ set, showToast, actions = {} }) {
  const _dScr = document.getElementById("difficultyScreen");
  if (!_dScr) { if (typeof WaveManager !== "undefined") WaveManager.start(); return; }
  const _diffColors = { EASY: "#88ff66", NORMAL: "#66aaff", HARD: "#ffaa44", NIGHTMARE: "#ff4444" };
  _dScr.querySelectorAll(".diffBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      set.diffHpMul(parseFloat(btn.dataset.hp));
      set.diffDmgMul(parseFloat(btn.dataset.dmg));
      const _label = btn.querySelector("div").textContent;
      const _upper = _label.toUpperCase();
      set.diffLabel(_upper);
      const _diffBadge = document.getElementById("difficultyBadge");
      if (_diffBadge) {
        _diffBadge.textContent = _upper;
        _diffBadge.style.color = _diffColors[_upper] || "#aaa";
        _diffBadge.style.display = "inline";
      }
      _dScr.style.display = "none";
      showToast(`Difficulty: ${_label}`, "info", 2500);
      if (actions.requestGameplayPointer) actions.requestGameplayPointer();
      if (typeof WaveManager !== "undefined") WaveManager.start();
    });
    btn.addEventListener("mouseenter", () => { btn.style.background = btn.style.background.replace("0.1", "0.22").replace("0.12", "0.22"); });
    btn.addEventListener("mouseleave", () => { btn.style.background = btn.style.background.replace("0.22", btn.dataset.hp === "1.0" ? "0.12" : "0.1"); });
  });
}
