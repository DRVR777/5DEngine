export function mountVictoryPlayAgain({ resetGameState }) {
  const btn = document.getElementById("victoryPlayAgain");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const vEl = document.getElementById("victoryOverlay");
    if (vEl) vEl.style.display = "none";
    resetGameState();
  });
}
