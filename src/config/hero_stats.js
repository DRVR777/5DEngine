// Hero balance constants — hardcoded game design values + CFG-derived stat caps.
export const HERO_HITBOX     = { w: 0.8, d: 0.8, h: 1.8 };
export const HERO_MAX_ARMOR  = 75;
export const ARMOR_ABSORB    = 0.6;   // fraction of hit taken from armor instead of HP
export const DODGE_DURATION  = 0.25;  // seconds of boost + iframes
export const DODGE_SPEED     = 18;    // units/sec burst
export const DODGE_COOLDOWN  = 1.1;   // seconds before next dodge
export const STAMINA_MAX     = 100;
export const STAMINA_DRAIN   = 22;   // per second while sprinting
export const STAMINA_REGEN   = 14;   // per second when not sprinting
export const STAMINA_LOCKOUT = 15;   // minimum stamina required to re-enter sprint

// makeHeroStats(CFG) → { HERO_MAX_HP, HERO_REGEN_DELAY, HERO_REGEN_RATE }
export function makeHeroStats(CFG) {
  return {
    HERO_MAX_HP:      CFG.heroMaxHp      || 100,
    HERO_REGEN_DELAY: CFG.heroRegenDelay || 5,
    HERO_REGEN_RATE:  CFG.heroRegenRate  || 4,
  };
}
