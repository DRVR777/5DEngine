export function computeBulletDamage({ bullet, enemy, dmgMul, lvlDmgMul, perkDmgMul }) {
  const headshot = bullet.posY > 1.35;
  const bsDot = bullet.dirU * Math.sin(enemy.heading) + bullet.dirV * Math.cos(enemy.heading);
  const backstab = !headshot && bsDot > 0.55;
  const frontalBlock = !headshot && !backstab && bsDot < -0.55 && (enemy.type === "boss" || enemy.type === "heavy");
  const wResist = (dmgMul[enemy.type] || {})[bullet.weaponId || "pistol"] || 1.0;
  const isCrit = !headshot && !backstab && !frontalBlock && Math.random() < 0.10;
  const falloffMul = bullet.falloff ? Math.max(0.15, 1 - (bullet.traveled / (bullet.range || 1)) * bullet.falloff) : 1;
  const dmg = Math.round(
    bullet.damage *
    (headshot ? 1.85 : backstab ? 1.5 : frontalBlock ? 0.5 : isCrit ? 2.5 : 1) *
    wResist * lvlDmgMul * perkDmgMul * falloffMul
  );
  return { dmg, headshot, backstab, frontalBlock, isCrit };
}
