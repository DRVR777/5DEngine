export function mountDamageFeedback({ get, set, actions }) {
  function flashDamage() {
    set.waveChallengeNoDmg(false);
    set.vignetteAmt(1.0);
    actions.playSfx("tone:90:35:sawtooth", 0.18);
    set.hitPunchPitch(Math.min(0.12, get.hitPunchPitch() + 0.05 + Math.random() * 0.04));
    if (get.heroHp() > 0 && get.heroHp() <= 10 && !get.nearDeathFired()) {
      set.nearDeathFired(true);
      set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.45));
      actions.playSfx("tone:60:200:sine", 0.45);
      actions.playSfx("tone:80:180:sine", 0.3);
      actions.showToast("CRITICAL!", "danger", 900);
    }
  }

  function applyScreenShake(intensity) {
    set.camShakeAmt(Math.min(1, get.camShakeAmt() + intensity));
  }

  return { flashDamage, applyScreenShake };
}
