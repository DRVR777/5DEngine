// Between-wave perk picker system
// mountPerkSystem(deps) → { showPerkPicker, refreshPerkHud, applyPerk }

export function mountPerkSystem({
  Inv,
  get,
  set,
  actions,
}) {
  if (typeof document === "undefined") return { showPerkPicker: () => {}, refreshPerkHud: () => {}, applyPerk: () => {} };

  const activePerkLabels = [];
  let _perkTimerInt = null;

  const PERKS = [
    { id:"dmg",      label:"Power Shot",   desc:"+15% weapon damage",           color:"#ff8844",
      apply: () => { set.perkDmgMul(get.perkDmgMul() * 1.15); } },
    { id:"speed",    label:"Sprinter",     desc:"+1 m/s sprint speed",           color:"#44ffcc",
      apply: () => { set.perkSpeedBonus(get.perkSpeedBonus() + 1); } },
    { id:"regen",    label:"Battle Medic", desc:"+3 HP/s regen rate",            color:"#44ff88",
      apply: () => { set.perkRegenBonus(get.perkRegenBonus() + 3); } },
    { id:"reload",   label:"Quick Hands",  desc:"15% faster reloads",            color:"#88aaff",
      apply: () => { set.perkReloadMul(get.perkReloadMul() * 0.85); } },
    { id:"maxhp",    label:"Resilient",    desc:"+25 max HP, heal 15",           color:"#ff4466",
      apply: () => {
        set.perkMaxHpBonus(get.perkMaxHpBonus() + 25);
        set.heroHp(Math.min(get.heroHp() + 15, get.HERO_MAX_HP() + get.perkMaxHpBonus()));
      } },
    { id:"grenades", label:"Grenadier",    desc:"+3 frag grenades",              color:"#ff6600",
      apply: () => { set.grenadeCount(Math.min(9, get.grenadeCount() + 3)); } },
    { id:"smoke",    label:"Smoke Screen", desc:"+2 smoke grenades",             color:"#aaaacc",
      apply: () => { set.smokeGrenadeCount(Math.min(9, get.smokeGrenadeCount() + 2)); } },
    { id:"armor",    label:"Fortified",    desc:"+30 armor",                     color:"#88ccff",
      apply: () => { set.heroArmor(Math.min(get.HERO_MAX_ARMOR(), get.heroArmor() + 30)); } },
    { id:"vampire",  label:"Vampire",      desc:"Kills restore 3 HP",            color:"#cc44cc",
      apply: () => { set.perkLifesteal(true); } },
    { id:"ammo",     label:"Ammo Dump",    desc:"+40 ammo for active weapon",    color:"#ffd166",
      apply: () => { Inv.addItem(get.heroInv(), get.weapon().ammoItem || "pistol_9mm", 40); } },
  ];

  function refreshPerkHud() {
    const el = document.getElementById("perkHud");
    if (!el) return;
    if (activePerkLabels.length === 0) { el.style.display = "none"; return; }
    el.style.display = "flex";
    el.innerHTML = activePerkLabels.map(p =>
      `<span style="color:${p.color};background:rgba(0,0,0,0.6);border:1px solid ${p.color}55;border-radius:3px;padding:1px 5px;font-size:9px;letter-spacing:0.05em">${p.label}</span>`
    ).join("");
  }

  function applyPerk(perk, waveNum) {
    if (_perkTimerInt) { clearInterval(_perkTimerInt); _perkTimerInt = null; }
    const overlay = document.getElementById("perkPicker");
    if (overlay) overlay.style.display = "none";
    perk.apply();
    activePerkLabels.push({ label: perk.label, color: perk.color });
    refreshPerkHud();
    actions.showToast(`★ PERK: ${perk.label} — ${perk.desc}`, "success", 3000);
    actions.addKillFeedEntry(`★ PERK (W${waveNum}): ${perk.label}`, "#ffd166");
    actions.playSfx("tone:880:80:sine", 0.5); actions.playSfx("tone:1100:60:sine", 0.4);
    if (actions.requestGameplayPointer) setTimeout(() => actions.requestGameplayPointer(), 250);
  }

  function showPerkPicker(waveNum) {
    const overlay = document.getElementById("perkPicker");
    if (!overlay) return;
    const pool = [...PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
    const cards = document.getElementById("perkCards");
    const timerEl = document.getElementById("perkTimer");
    const waveEl  = document.getElementById("perkWaveNum");
    if (waveEl) waveEl.textContent = waveNum;
    if (cards) {
      cards.innerHTML = "";
      pool.forEach(perk => {
        const card = document.createElement("div");
        card.style.cssText = `width:180px;padding:16px 14px;background:rgba(10,10,20,0.92);border:2px solid ${perk.color};border-radius:10px;cursor:pointer;text-align:center;transition:transform 0.12s,box-shadow 0.12s;box-shadow:0 0 10px ${perk.color}44;`;
        card.innerHTML = `<div style="font-size:15px;font-weight:900;color:${perk.color};letter-spacing:0.08em;margin-bottom:6px">${perk.label}</div><div style="font-size:12px;color:#ccc;line-height:1.4">${perk.desc}</div>`;
        card.onmouseenter = () => { card.style.transform = "scale(1.07)"; card.style.boxShadow = `0 0 22px ${perk.color}88`; };
        card.onmouseleave = () => { card.style.transform = ""; card.style.boxShadow = `0 0 10px ${perk.color}44`; };
        card.onclick = () => { applyPerk(perk, waveNum); };
        cards.appendChild(card);
      });
    }
    // Release pointer lock BEFORE showing overlay.
    // exitPointerLock() is async — the browser fires `pointerlockchange` and only
    // then do click events reach elements outside the canvas. Showing the overlay
    // first means cards are visible but unclickable until the lock drops.
    function _startOverlay() {
      overlay.style.display = "flex";
      let secs = 10;
      if (_perkTimerInt) clearInterval(_perkTimerInt);
      _perkTimerInt = setInterval(() => {
        secs--;
        if (timerEl) timerEl.textContent = secs;
        if (secs <= 0) { clearInterval(_perkTimerInt); _perkTimerInt = null; applyPerk(pool[Math.floor(Math.random() * pool.length)], waveNum); }
      }, 1000);
    }
    if (document.pointerLockElement && actions.releasePointer) {
      let _shown = false;
      const _handler = () => {
        document.removeEventListener("pointerlockchange", _handler);
        if (!_shown) { _shown = true; _startOverlay(); }
      };
      document.addEventListener("pointerlockchange", _handler);
      actions.releasePointer();
      // Safety: if pointerlockchange never fires (e.g. lock already releasing), show after 80ms
      setTimeout(() => {
        document.removeEventListener("pointerlockchange", _handler);
        if (!_shown) { _shown = true; _startOverlay(); }
      }, 80);
    } else {
      if (actions.releasePointer) actions.releasePointer();
      _startOverlay();
    }
  }

  function clearTimerAndReset() {
    if (_perkTimerInt) { clearInterval(_perkTimerInt); _perkTimerInt = null; }
    activePerkLabels.length = 0;
  }

  return { showPerkPicker, refreshPerkHud, applyPerk, clearTimerAndReset, activePerkLabels };
}
