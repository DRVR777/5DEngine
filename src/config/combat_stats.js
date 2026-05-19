// Combat scoring constants — kill leveling thresholds, streak, combo decay.
export const LEVEL_THRESHOLDS = [10, 20, 30, 40, 50]; // kills needed per level (0–4)
export const STREAK_WINDOW    = 5;    // seconds between kills to maintain streak
export const COMBO_DECAY      = 3.5;  // seconds without a kill to break the combo
