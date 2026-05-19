const HURT_FREQS = { grunt: 110, fast: 190, heavy: 55, poisoner: 140, incendiary: 120, robot: 400, boss: 42, sniper: 160 };
const HURT_DURS  = { grunt: 45,  fast: 28,  heavy: 85, poisoner: 50,  incendiary: 48,  robot: 32,  boss: 110, sniper: 38  };

export function computeHurtSfx({ enemyType, headshot }) {
  const freq = HURT_FREQS[enemyType] || 110;
  const dur  = HURT_DURS[enemyType]  || 45;
  const wave = enemyType === "robot" ? "square" : "sawtooth";
  return { tone: `tone:${freq}:${dur}:${wave}`, vol: headshot ? 0.32 : 0.18 };
}
