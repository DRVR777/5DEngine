/** bullet_hit_feedback — kb mult=3.5, kbT=0.1, flinch head=-0.6/norm=-0.3, stagger threshold 0.25*maxHp, staggerT=0.6 */
export default {
  priority: 42,
  tick(_t, data, _dt, _r) {
    const en = data; if (!en) return;
    const bpU = en.bulletU || 0, bpV = en.bulletV || 0;
    const kbLen = Math.hypot((en.u || 0) - bpU, (en.v || 0) - bpV) || 1;
    en.kbU = ((en.u || 0) - bpU) / kbLen * 3.5;
    en.kbV = ((en.v || 0) - bpV) / kbLen * 3.5;
    en.kbT = 0.1;
    en.flinchX = en.headshot ? -0.6 : -0.3;
    if (en.type !== "boss" && (en.dmg || 0) >= (en.maxHp || 100) * 0.25 && (en.hp || 1) > 0) {
      en.staggerT = 0.6;
      en.staggerAngle = Math.atan2((en.u || 0) - bpU, (en.v || 0) - bpV) + Math.PI;
    }
  }
};
