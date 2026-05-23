const LABELS = { 2: "DOUBLE KILL!", 4: "QUAD KILL!", 6: "RAMPAGE!", 8: "GODLIKE!" };
const FREQS  = { 2: 660, 4: 880, 6: 1100, 8: 1400 };
const COLORS = { 2: "warning", 4: "danger", 6: "danger", 8: "success" };
const MILESTONES = [2, 4, 6, 8];

export function mountComboAnnouncer({ DECAY, get, set, actions }) {
  function tick(nowSec) {
    if (get.comboCount() > 0 && nowSec - get.comboLastT() > DECAY) {
      set.comboCount(0);
      set.comboAnnouncedMul(0);
    }
    const curMul = Math.min(8, get.comboCount());
    if (curMul < 2) return;
    for (const m of MILESTONES) {
      if (curMul >= m && get.comboAnnouncedMul() < m) {
        set.comboAnnouncedMul(m);
        actions.showToast(`${LABELS[m]} x${m}`, COLORS[m], 1800);
        actions.playSfx(`tone:${FREQS[m]}:80:sine`, 0.45);
        actions.playSfx(`tone:${FREQS[m] * 1.5}:60:sine`, 0.25);
        break;
      }
    }
  }
  return { tick };
}
