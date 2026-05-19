export function mountComboHudTick() {
  function tick(nowSec, comboCount, comboLastT, comboDecay, els) {
    const { comboHud, comboMulText, comboFill } = els;
    if (!comboHud) return;
    if (comboCount >= 2) {
      comboHud.style.display = "block";
      const mul = Math.min(8, comboCount);
      if (comboMulText) {
        comboMulText.textContent = `x${mul}`;
        const hue = mul >= 6 ? "#ff4466" : mul >= 4 ? "#ff8800" : "#ffd166";
        comboMulText.style.color = hue;
        comboMulText.style.textShadow = `0 0 14px ${hue}cc`;
        const pulse = 1 + 0.08 * Math.sin(nowSec * 12);
        comboMulText.style.transform = `scale(${pulse.toFixed(3)})`;
      }
      if (comboFill) {
        const frac = Math.min(1, Math.max(0, 1 - (nowSec - comboLastT) / comboDecay));
        comboFill.style.width = (frac * 100).toFixed(1) + "%";
      }
    } else {
      comboHud.style.display = "none";
    }
  }
  return { tick };
}
