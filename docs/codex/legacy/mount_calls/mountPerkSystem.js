// Legacy clone of mountPerkSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 413..450
// (context lines 409..454)

      if (_p && typeof _p.catch === "function") _p.catch(() => {});
    } catch (_e) {}
  }, 120);
}
const _perkSys        = mountPerkSystem({
  Inv,
  get: {
    perkDmgMul:       () => _perkDmgMul,
    perkSpeedBonus:   () => _perkSpeedBonus,
    perkRegenBonus:   () => _perkRegenBonus,
    perkReloadMul:    () => _perkReloadMul,
    perkMaxHpBonus:   () => _perkMaxHpBonus,
    perkLifesteal:    () => _perkLifesteal,
    grenadeCount:     () => grenadeCount,
    smokeGrenadeCount:() => smokeGrenadeCount,
    heroHp:           () => heroHp,
    heroArmor:        () => heroArmor,
    HERO_MAX_HP:      () => HERO_MAX_HP,
    HERO_MAX_ARMOR:   () => HERO_MAX_ARMOR,
    heroInv:          () => heroInv,
    weapon:           () => getWeapon(),
  },
  set: {
    perkDmgMul:       (v) => { _perkDmgMul = v; },
    perkSpeedBonus:   (v) => { _perkSpeedBonus = v; },
    perkRegenBonus:   (v) => { _perkRegenBonus = v; },
    perkReloadMul:    (v) => { _perkReloadMul = v; },
    perkMaxHpBonus:   (v) => { _perkMaxHpBonus = v; },
    perkLifesteal:    (v) => { _perkLifesteal = v; },
    grenadeCount:     (v) => { grenadeCount = v; },
    smokeGrenadeCount:(v) => { smokeGrenadeCount = v; },
    heroHp:           (v) => { heroHp = v; },
    heroArmor:        (v) => { heroArmor = v; },
  },
  actions: {
    showToast,
    addKillFeedEntry: _addKillFeedEntry,
    playSfx: (t, v) => playSfx(t, v), // lazy — playSfx const is at line 2801
    releasePointer: releasePointerForModal,
    requestGameplayPointer,
  },
});
const _showPerkPicker = _perkSys.showPerkPicker;
const _refreshPerkHud = _perkSys.refreshPerkHud;
const _applyPerk      = _perkSys.applyPerk;
const _activePerkLabels = _perkSys.activePerkLabels;
