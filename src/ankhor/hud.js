/**
 * Ankhor HUD Module — loaded by index.html.
 * Weapon bob, sprint FOV, scope sway, crouch indicator, v-sync tear fix.
 * Minimal DOM manipulation. Feeds into existing tick wrapper.
 */

export function initHUD(ankhor) {
  // Scope sway element
  const scope = document.createElement('div');
  scope.id = 'scope';
  scope.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:98;border:40px solid rgba(0,0,0,0.85);opacity:0;transition:opacity 0.3s;border-radius:50%;';
  document.body.appendChild(scope);

  // Crouch indicator
  const crouch = document.createElement('div');
  crouch.id = 'crouchInd';
  crouch.style.cssText = 'position:absolute;bottom:100px;left:20px;color:#8af;font:11px monospace;background:rgba(0,0,0,0.4);padding:3px 8px;border-radius:3px;opacity:0;';
  document.getElementById('hud').appendChild(crouch);

  // State
  let bobT = 0;
  const stage = document.getElementById('stage');
  const hudState = { _lastScore: 0 };

  function tick(dt) {
    bobT += dt * 7;
    const hero = ankhor.byKind('hero')[0];
    if (!hero) return;
    
    const inputs = ankhor.byKind('input')[0];
    const fd = inputs ? ankhor.facetData(inputs.id, 'input-state') : null;
    if (!fd) return;

    const keys = fd.keys || {};
    const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
    const sprinting = keys.ShiftLeft && moving;

    // Weapon bob
    const bobY = moving ? Math.sin(bobT) * 0.012 : 0;
    stage.style.transform = sprinting
      ? `translateY(${bobY * 100}px) scale(1.02)`
      : `translateY(${bobY * 100}px)`;

    // Sprint indicator
    document.getElementById('sprint').style.opacity = sprinting ? '1' : '0';

    // Crouch
    crouch.style.opacity = keys.CtrlLeft || keys.ControlLeft ? '1' : '0';

    // Score popup on kill
    const scoreNow = ankhor.facetData(hero.id, 'inventory')?.score || 0;
    if (scoreNow > (hudState._lastScore || 0)) {
      const popup = document.createElement('div');
      popup.textContent = '+' + (scoreNow - (hudState._lastScore||0)) + ' XP';
      popup.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ff0;font:bold 24px monospace;text-shadow:0 0 10px #ff0;pointer-events:none;animation:floatUp 1s ease-out forwards;';
      document.body.appendChild(popup);
      setTimeout(()=>popup.remove(), 1000);
    }
    hudState._lastScore = scoreNow;

    // Kill counter
    document.getElementById('kills').textContent = ((ankhor.facetData(hero.id, 'enemy-kill')?.enemyKills)||0) + ' kills';

    // Combo
    const streak = ankhor.facetData(hero.id, 'enemy-kill')?.killStreak || 0;
    const comboEl = document.getElementById('combo');
    if (comboEl) {
      comboEl.textContent = streak > 1 ? streak + 'x COMBO' : '';
      comboEl.style.opacity = streak > 1 ? '1' : '0';
    }
  }

  return { tick };
}
